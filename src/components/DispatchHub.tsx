import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { DispatchList } from './DispatchList';
import { DispatchWizard } from './DispatchWizard';
import { DispatchDetails, DispatchRecord } from './DispatchDetails';
import { ReceivingWizard } from './ReceivingWizard';
import { Icon } from './Icon';

const LOCAL_DISPATCHES_KEY = 'tsj_dispatches_v1';

const INITIAL_MOCK_DISPATCHES: DispatchRecord[] = [
  {
    id: 'dsp-001',
    dispatchNumber: 'DSP-2026-1001',
    customer: 'Waterfront Luxury Hotel',
    project: 'Penthouse Presidential Suite Joinery',
    destinationBranch: 'Cape Town',
    installer: 'Johan Van Der Merwe',
    courier: 'RAM Hand-to-Hand Couriers',
    trackingNumber: 'TRK-982103-CPT',
    notes: 'High-gloss walnut veneer headboard and bedside pedestals. Handle with foam corner guards.',
    status: 'Dispatched',
    googleDriveFolderId: 'drv_fld_DSP_2026_1001',
    googleDriveFolderName: 'Waterfront_DSP-2026-1001_Penthouse',
    googleDriveFolderUrl: 'https://drive.google.com/drive/folders/drv_fld_DSP_2026_1001',
    photoCount: 3,
    photos: [
      {
        id: 'p1',
        name: 'headboard_packaging_01.jpg',
        url: '',
        uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        size: 420000,
        mimeType: 'image/jpeg'
      },
      {
        id: 'p2',
        name: 'quality_check_signoff.jpg',
        url: '',
        uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        size: 380000,
        mimeType: 'image/jpeg'
      }
    ],
    createdBy: 'Factory Supervisor',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'dsp-002',
    dispatchNumber: 'DSP-2026-1002',
    customer: 'Clifton Beach Villa',
    project: 'Wine Cellar Oak Shelving',
    destinationBranch: 'Cape Town',
    installer: 'Gareth Smith',
    courier: 'The Courier Guy',
    trackingNumber: 'TCG-441209-ZA',
    notes: 'Solid white oak slatted rack assemblies with matte sealer.',
    status: 'Ready for Dispatch',
    googleDriveFolderId: 'drv_fld_DSP_2026_1002',
    googleDriveFolderName: 'Clifton_DSP-2026-1002_WineCellar',
    googleDriveFolderUrl: 'https://drive.google.com/drive/folders/drv_fld_DSP_2026_1002',
    photoCount: 1,
    photos: [],
    createdBy: 'Dispatch Manager',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'dsp-003',
    dispatchNumber: 'DSP-2026-1003',
    customer: 'Stellenbosch Wine Estate',
    project: 'Tasting Room Reception Counter',
    destinationBranch: 'Johannesburg',
    installer: 'Pieter Marais',
    courier: 'Mainline Freight Logistics',
    trackingNumber: 'MFL-881023-JHB',
    notes: 'Draft packing list prepared. Awaiting final quality check photos.',
    status: 'Draft',
    googleDriveFolderId: 'drv_fld_DSP_2026_1003',
    googleDriveFolderName: 'Stellenbosch_DSP-2026-1003_Reception',
    googleDriveFolderUrl: 'https://drive.google.com/drive/folders/drv_fld_DSP_2026_1003',
    photoCount: 0,
    photos: [],
    createdBy: 'Super Admin',
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 1).toISOString()
  }
];

interface DispatchHubProps {
  currentUser?: any;
  announce?: (msg: string) => void;
}

export const DispatchHub: React.FC<DispatchHubProps> = ({ currentUser, announce }) => {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active modal/wizard view
  const [activeView, setActiveView] = useState<'list' | 'wizard' | 'details' | 'receiving'>('list');
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchRecord | null>(null);

  // User permissions
  const role = currentUser?.role || '';
  const isAdmin = role === 'Admin';
  const isManager = ['Supervisor', 'HR', 'Stock Manager'].includes(role);
  const isDispatchOrFactorySupervisor = role.toLowerCase().includes('dispatch') || role.toLowerCase().includes('factory');
  
  const canCreateOrEdit = isAdmin || isManager || isDispatchOrFactorySupervisor;

  // Load dispatches from Firestore / localStorage fallback
  useEffect(() => {
    let isMounted = true;
    const fetchDispatches = async () => {
      setIsLoading(true);
      let loadedData: DispatchRecord[] = [];

      if (db) {
        try {
          const snap = await db.collection('dispatches').orderBy('createdAt', 'desc').get();
          if (!snap.empty) {
            snap.forEach((docSnap) => {
              loadedData.push({ id: docSnap.id, ...docSnap.data() } as DispatchRecord);
            });
          }
        } catch (e) {
          console.warn('Error reading dispatches from Firestore:', e);
        }
      }

      if (loadedData.length === 0) {
        try {
          const local = localStorage.getItem(LOCAL_DISPATCHES_KEY);
          if (local) {
            loadedData = JSON.parse(local);
          } else {
            loadedData = INITIAL_MOCK_DISPATCHES;
            localStorage.setItem(LOCAL_DISPATCHES_KEY, JSON.stringify(loadedData));
          }
        } catch (e) {
          loadedData = INITIAL_MOCK_DISPATCHES;
        }
      }

      if (isMounted) {
        setDispatches(loadedData);
        setIsLoading(false);
      }
    };

    fetchDispatches();
    return () => { isMounted = false; };
  }, []);

  const saveToLocalCache = (data: DispatchRecord[]) => {
    try {
      localStorage.setItem(LOCAL_DISPATCHES_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to cache dispatches in localStorage:', e);
    }
  };

  const handleSaveDispatch = async (
    payload: Partial<DispatchRecord>,
    finalStatus: 'Draft' | 'Ready for Dispatch' | 'Dispatched'
  ) => {
    const isEdit = !!selectedDispatch;
    const dispatchId = selectedDispatch ? selectedDispatch.id : `dsp-${Date.now()}`;
    const now = new Date().toISOString();

    const recordToSave: DispatchRecord = {
      id: dispatchId,
      dispatchNumber: payload.dispatchNumber || `DSP-${Date.now()}`,
      customer: payload.customer || 'Client',
      project: payload.project || 'Project',
      destinationBranch: payload.destinationBranch || 'Cape Town',
      installer: payload.installer || '',
      courier: payload.courier || '',
      trackingNumber: payload.trackingNumber || '',
      notes: payload.notes || '',
      status: finalStatus,
      googleDriveFolderId: payload.googleDriveFolderId || '',
      googleDriveFolderName: payload.googleDriveFolderName || '',
      googleDriveFolderUrl: payload.googleDriveFolderUrl || '',
      photoCount: payload.photos?.length || 0,
      photos: payload.photos || [],
      createdBy: payload.createdBy || currentUser?.fullName || 'Dispatch Supervisor',
      createdAt: selectedDispatch?.createdAt || now,
      updatedAt: now
    };

    // Update local state first
    let updatedList: DispatchRecord[];
    if (isEdit) {
      updatedList = dispatches.map((d) => (d.id === dispatchId ? recordToSave : d));
    } else {
      updatedList = [recordToSave, ...dispatches];
    }

    setDispatches(updatedList);
    saveToLocalCache(updatedList);

    // Sync to Firestore
    if (db) {
      try {
        await db.collection('dispatches').doc(dispatchId).set(recordToSave, { merge: true });
      } catch (err) {
        console.warn('Firestore dispatch save error:', err);
      }
    }

    setActiveView('list');
    setSelectedDispatch(null);
    announce?.(`Dispatch ${recordToSave.dispatchNumber} ${isEdit ? 'updated' : 'created'} successfully.`);
  };

  const handleDeleteDispatch = async (dispatch: DispatchRecord) => {
    if (dispatch.status !== 'Draft') {
      alert('Only Draft dispatches can be deleted.');
      return;
    }

    if (!confirm(`Are you sure you want to delete draft dispatch ${dispatch.dispatchNumber}?`)) return;

    const updated = dispatches.filter((d) => d.id !== dispatch.id);
    setDispatches(updated);
    saveToLocalCache(updated);

    if (db) {
      try {
        await db.collection('dispatches').doc(dispatch.id).delete();
      } catch (e) {
        console.warn('Firestore delete error:', e);
      }
    }

    announce?.(`Dispatch ${dispatch.dispatchNumber} deleted.`);
  };

  const handleDispatchShipment = async (dispatch: DispatchRecord) => {
    const now = new Date().toISOString();
    const updatedRecord: DispatchRecord = {
      ...dispatch,
      status: 'Dispatched',
      updatedAt: now
    };

    const updatedList = dispatches.map((d) => (d.id === dispatch.id ? updatedRecord : d));
    setDispatches(updatedList);
    saveToLocalCache(updatedList);

    if (db) {
      try {
        await db.collection('dispatches').doc(dispatch.id).set({ status: 'Dispatched', updatedAt: now }, { merge: true });
      } catch (e) {
        console.warn('Firestore dispatch status error:', e);
      }
    }

    if (selectedDispatch?.id === dispatch.id) {
      setSelectedDispatch(updatedRecord);
    }

    announce?.(`Shipment ${dispatch.dispatchNumber} marked as Dispatched!`);
  };

  const handleSaveReceiving = async (
    updatedRecord: DispatchRecord,
    newStatus: 'Received' | 'Partially Received' | 'Issue Logged'
  ) => {
    const updatedList = dispatches.map((d) => (d.id === updatedRecord.id ? updatedRecord : d));
    setDispatches(updatedList);
    saveToLocalCache(updatedList);

    if (db) {
      try {
        await db.collection('dispatches').doc(updatedRecord.id).set(updatedRecord, { merge: true });
      } catch (e) {
        console.warn('Firestore receiving update error:', e);
      }
    }

    setActiveView('list');
    setSelectedDispatch(null);
    announce?.(`Receiving completed for ${updatedRecord.dispatchNumber} as ${newStatus}`);
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center bg-black/40 border border-white/10 rounded-3xl space-y-3 font-sans">
        <div className="w-10 h-10 border-4 border-[#ff8c00] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs font-black uppercase tracking-wider text-gray-400">Loading Dispatch Hub...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Dispatch List */}
      <DispatchList
        dispatches={dispatches}
        onView={(item) => {
          setSelectedDispatch(item);
          setActiveView('details');
        }}
        onEdit={(item) => {
          setSelectedDispatch(item);
          setActiveView('wizard');
        }}
        onDelete={handleDeleteDispatch}
        onDispatchShipment={handleDispatchShipment}
        onReceive={(item) => {
          setSelectedDispatch(item);
          setActiveView('receiving');
        }}
        onNewDispatch={() => {
          setSelectedDispatch(null);
          setActiveView('wizard');
        }}
        canCreateOrEdit={canCreateOrEdit}
        currentUser={currentUser}
      />

      {/* Multi-Step Dispatch Wizard Modal */}
      {activeView === 'wizard' && (
        <DispatchWizard
          initialDispatch={selectedDispatch}
          onSave={handleSaveDispatch}
          onCancel={() => {
            setActiveView('list');
            setSelectedDispatch(null);
          }}
          currentUser={currentUser}
          announce={announce}
        />
      )}

      {/* Dispatch Details Modal */}
      {activeView === 'details' && selectedDispatch && (
        <DispatchDetails
          dispatch={selectedDispatch}
          onClose={() => {
            setActiveView('list');
            setSelectedDispatch(null);
          }}
          onEdit={(item) => {
            setSelectedDispatch(item);
            setActiveView('wizard');
          }}
          onDispatchShipment={handleDispatchShipment}
          canEdit={canCreateOrEdit}
        />
      )}

      {/* Receiving Wizard Modal */}
      {activeView === 'receiving' && selectedDispatch && (
        <ReceivingWizard
          dispatch={selectedDispatch}
          onSaveReceiving={handleSaveReceiving}
          onCancel={() => {
            setActiveView('list');
            setSelectedDispatch(null);
          }}
          currentUser={currentUser}
          announce={announce}
        />
      )}
    </div>
  );
};
