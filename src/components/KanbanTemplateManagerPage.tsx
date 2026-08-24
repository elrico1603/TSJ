import React, { useState } from 'react';
import { db, APP_ID_PATH } from '../firebase';
import { KanbanTemplate } from '../types';
import { CardPreview } from './CardPreview';
import { TemplatePropertiesPanel } from './TemplatePropertiesPanel';
import { Icon } from './Icon';

export const DEFAULT_SAMPLE_TEMPLATE: KanbanTemplate = {
  id: 'sample-template-local',
  templateName: "Sample A6 Portrait Card",
  dimensions: { width: 105, height: 148, margin: 5, sectionGap: 3 },
  layout: {
    section1: { 
      width: 46, 
      height: 46.2, 
      fields: [ 
        { id: "f1", type: "productImage", x: 5, y: 5, width: 40, height: 80, visible: true }, 
        { id: "f2", type: "partDescription", x: 50, y: 10, width: 45, height: 20, visible: true, fontSize: 14, fontWeight: "bold" }, 
        { id: "f3", type: "partNumber", x: 50, y: 40, width: 45, height: 15, visible: true, fontSize: 10 } 
      ],
      picture: { x: 15, y: 15, width: 110, height: 110 },
      qr: { x: 210, y: 15, width: 110, height: 110 }
    },
    section2: { 
      width: 46, 
      height: 46.2, 
      fields: [ 
        { id: "f4", type: "qrCode", sourceField: "partNumber", x: 20, y: 10, width: 60, height: 60, visible: true } 
      ],
      picture: { x: 15, y: 15, width: 110, height: 110 },
      qr: { x: 210, y: 15, width: 110, height: 110 }
    },
    section3: { 
      width: 46, 
      height: 46.2, 
      fields: [],
      picture: { x: 15, y: 15, width: 110, height: 110 },
      qr: { x: 210, y: 15, width: 110, height: 110 }
    },
    section4: { 
      width: 46, 
      height: 46.2, 
      style: { text: "KANBAN PULLED", fontColor: "#FFFFFF", backgroundColor: "#EF4444", borderWidth: 0 }, 
      fields: [],
      picture: { x: 15, y: 15, width: 110, height: 110 },
      qr: { x: 210, y: 15, width: 110, height: 110 }
    },
    section5: { 
      width: 95, 
      height: 39.6, 
      fields: [ 
        { id: "f5", type: "customText", value: "Summary Section", x: 5, y: 25, width: 90, height: 50, visible: true, fontSize: 12 } 
      ],
      picture: { x: 15, y: 15, width: 110, height: 110 },
      qr: { x: 210, y: 15, width: 110, height: 110 }
    },
    picture: { x: 15, y: 15, width: 110, height: 110 },
    qr: { x: 210, y: 15, width: 110, height: 110 }
  },
  picture: { x: 15, y: 15, width: 110, height: 110 },
  qr: { x: 210, y: 15, width: 110, height: 110 },
  meta: { createdBy: "system", createdDate: "2024-01-01T00:00:00.000Z" }
};

interface KanbanTemplateManagerPageProps {
  kanbanTemplates: KanbanTemplate[];
  currentUser: any;
  announce: (txt: string) => void;
  onPrintTemplate: (tpl: KanbanTemplate, sampleData: any) => void;
}

export const KanbanTemplateManagerPage: React.FC<KanbanTemplateManagerPageProps> = ({
  kanbanTemplates,
  currentUser,
  announce,
  onPrintTemplate
}) => {
  const [editingTemplate, setEditingTemplate] = useState<KanbanTemplate | null>(null);
  const [editorTab, setEditorTab] = useState('dimensions');
  const [activeField, setActiveField] = useState<string | null>(null);
  const [sampleImage, setSampleImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedTemplateId = editingTemplate?.id || null;

  const filteredTemplates = kanbanTemplates.filter(t => {
    if (!searchQuery || searchQuery.trim() === '') return true;
    const q = searchQuery.toLowerCase().trim();
    if (!q || q === '') return true;

    const name = (t?.templateName || (t as any)?.productName || (t as any)?.name || '').toLowerCase();
    const desc = ((t as any)?.description || (t as any)?.productDescription || '').toLowerCase();
    const kanbanId = (
      (t as any)?.kanbanId || 
      (t as any)?.code || 
      t?.id || 
      (t as any)?.internalProductNumber || 
      (t as any)?.internalProductCode || 
      ''
    ).toLowerCase();
    const supplierName = ((t as any)?.supplier || (t as any)?.supplierName || (t as any)?.supName || '').toLowerCase();
    const supplierNo = (
      (t as any)?.supplierPartNumber ||
      (t as any)?.supplierNo ||
      (t as any)?.supplierNumber ||
      (t as any)?.supNo ||
      (t as any)?.supplierCode ||
      (t as any)?.supplierItemCode ||
      ''
    ).toLowerCase();
    const category = ((t as any)?.category || '').toLowerCase();
    const location = ((t as any)?.location || '').toLowerCase();

    return (
      name.includes(q) ||
      desc.includes(q) ||
      kanbanId.includes(q) ||
      supplierName.includes(q) ||
      supplierNo.includes(q) ||
      category.includes(q) ||
      location.includes(q)
    );
  });

  const handlePrintPreview = () => {
    if (!editingTemplate) return;
    const previewData = {
      productImage: sampleImage,
      partDescription: 'Sample Part Description',
      partNumber: 'PN-12345-SAMPLE',
      supplierPartNumber: 'SPN-98765',
      supplier: 'Sample Supplier Inc.',
      orderQuantity: '100',
      reorderPoint: '25',
      deliveryTime: '5 Days',
      location: 'Aisle 5, Bin 3',
      notes: 'These are sample notes for the print preview.',
      contactDetails: 'Sample Contact Details',
      reorderInfo: 'Sample Reorder Info',
    };
    onPrintTemplate(editingTemplate, previewData);
  };

  const handleNewTemplate = () => {
    if (editingTemplate && !confirm('You have unsaved changes that will be lost. Are you sure you want to create a new template?')) {
      return;
    }
    const newTpl: KanbanTemplate = {
      templateName: "New Unnamed Template",
      dimensions: { width: 105, height: 148, margin: 5, sectionGap: 3 },
      layout: {
        section1: { width: 46, height: 46.2, fields: [] },
        section2: { width: 46, height: 46.2, fields: [] },
        section3: { width: 46, height: 46.2, fields: [] },
        section4: { width: 46, height: 46.2, style: { text: "PULLED", fontSize: 18, fontColor: "#FFFFFF", backgroundColor: "#EF4444", borderWidth: 0 }, fields: [] },
        section5: { width: 95, height: 39.6, fields: [] }
      },
      meta: { createdBy: currentUser?.uid || currentUser?.id || 'unknown', createdDate: new Date().toISOString() }
    };
    setEditingTemplate(newTpl);
    setActiveField(null);
    setSampleImage(null);
    setEditorTab('dimensions');
  };

  const handleSelectTemplate = (template: KanbanTemplate) => {
    if (editingTemplate && !confirm('You have unsaved changes. Are you sure you want to discard them?')) {
      return;
    }
    setEditingTemplate(JSON.parse(JSON.stringify(template)));
    setActiveField(null);
    setSampleImage(null);
    setEditorTab('dimensions');
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    const collectionRef = db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('kanbanTemplates');
    
    if (editingTemplate.id && editingTemplate.id !== 'sample-template-local') {
      await collectionRef.doc(selectedTemplateId!).update(editingTemplate);
      announce('Template updated.');
    } else {
      const { id, ...templateToSave } = editingTemplate as any;
      const docRef = await collectionRef.add(templateToSave);
      setEditingTemplate(prev => prev ? { ...prev, id: docRef.id } : null);
      announce('Template created.');
    }
  };

  const handleDuplicateTemplate = async () => {
    if (!editingTemplate) return;

    const duplicatedTemplate = {
      ...JSON.parse(JSON.stringify(editingTemplate)),
      templateName: `${editingTemplate.templateName} (Copy)`,
      meta: {
        createdBy: currentUser?.uid || currentUser?.id || 'unknown',
        createdDate: new Date().toISOString()
      }
    };
    delete duplicatedTemplate.id;

    const collectionRef = db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('kanbanTemplates');
    const docRef = await collectionRef.add(duplicatedTemplate);
    
    setEditingTemplate({ ...duplicatedTemplate, id: docRef.id });
    announce('Template duplicated and selected for editing.');
  };

  const handleDeleteTemplate = async () => {
    if (selectedTemplateId && confirm('Are you sure you want to permanently delete this template?')) {
      await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('kanbanTemplates').doc(selectedTemplateId).delete();
      setEditingTemplate(null);
      announce('Template deleted.');
    }
  };

  return (
    <div className="h-full flex animate-in fade-in duration-500 font-sans">
      {!editingTemplate && (
        <aside className="w-96 bg-black/30 p-6 flex flex-col gap-6 border-r border-white/10 shrink-0 font-sans animate-in slide-in-from-left duration-300">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black uppercase tracking-wider text-white font-sans">Templates</h2>
            <div className="flex gap-2">
              <button 
                onClick={handleDuplicateTemplate} 
                disabled={!selectedTemplateId || selectedTemplateId === 'sample-template-local'} 
                className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold uppercase text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Duplicate
              </button>
              <button onClick={handleNewTemplate} className="px-4 py-2 bg-[#ff8c00] hover:bg-[#e07b00] rounded-lg text-xs font-black uppercase tracking-widest text-white transition-colors">
                New
              </button>
            </div>
          </div>
          <div className="relative">
            <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Kanban ID, supplier #, name..."
              className="w-full pl-9 pr-7 py-2 bg-neutral-900 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
              >
                <Icon name="x" size={12} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar -mr-3 pr-3 space-y-3">
            {filteredTemplates.map(t => (
              <div key={t.id} onClick={() => handleSelectTemplate(t)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedTemplateId === t.id ? 'bg-purple-500/10 border-purple-500' : 'bg-black/40 border-transparent hover:border-white/20'}`}>
                <h3 className="font-bold text-white mb-1 font-sans">{t.templateName}</h3>
                <p className="text-xs text-gray-400 font-sans">{t.dimensions.width}mm x {t.dimensions.height}mm</p>
              </div>
            ))}
            {filteredTemplates.length === 0 && (
              <div className="text-center py-20 font-sans">
                <Icon name="layout-template" size={48} className="text-gray-700 mx-auto" />
                <p className="text-xs text-gray-600 font-bold uppercase mt-4">No templates match query.</p>
                <p className="text-xs text-gray-600 mt-1">Try adjusting your search criteria.</p>
              </div>
            )}
          </div>
          {selectedTemplateId && selectedTemplateId !== 'sample-template-local' && (
            <button onClick={handleDeleteTemplate} className="w-full py-3 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-lg text-xs font-black uppercase text-red-500 font-sans">Delete Selected</button>
          )}
        </aside>
      )}
      <div className="flex-1 flex overflow-hidden">
        {editingTemplate ? (
          <React.Fragment>
            <CardPreview 
              template={editingTemplate} 
              setTemplate={setEditingTemplate} 
              activeField={activeField} 
              setActiveField={setActiveField} 
              sampleImage={sampleImage}
              activeTab={editorTab}
              setActiveTab={setEditorTab}
            />
            <TemplatePropertiesPanel 
              template={editingTemplate} setTemplate={setEditingTemplate} 
              activeTab={editorTab} setActiveTab={setEditorTab} 
              onSave={handleSaveTemplate} 
              onCancel={() => { setEditingTemplate(null); setActiveField(null); setSampleImage(null); }} 
              activeField={activeField}
              setSampleImage={setSampleImage}
              onPrint={handlePrintPreview} />
          </React.Fragment>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-black/20 font-sans">
            <div className="text-center space-y-4">
              <div className="p-4 bg-purple-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-purple-500/20">
                <Icon name="layout-template" size={32} className="text-purple-400" />
              </div>
              <div className="space-y-1">
                <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Kanban Template Workspace</p>
                <p className="text-xs text-gray-500 max-w-sm font-sans">Select an existing template from the list on the left, or click <strong className="text-orange-400">"New"</strong> to design or customize a new card layout.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
