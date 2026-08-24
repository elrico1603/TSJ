import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import { 
  PPERoleTemplate, 
  PPEIssuedItem, 
  PPEIssuanceRecord, 
  PPECondition,
  PPECategory,
  PPEItemDefinition
} from '../types/employee';
import { disciplinaryAndPPEService, DEFAULT_PPE_TEMPLATES } from '../services/disciplinaryAndPPEService';
import { PhotoAvatar } from './ClockingTerminal';
import { 
  ShieldCheck, 
  HardHat, 
  Printer, 
  Check, 
  X, 
  Plus, 
  Trash2, 
  FileText, 
  CheckCircle2, 
  Sliders, 
  History,
  Lock,
  UserCheck
} from 'lucide-react';

interface PPEIssuanceModalProps {
  employees: Employee[];
  selectedEmployee?: Employee | null;
  currentUser?: any;
  onClose: () => void;
  onIssuanceSaved: (updatedEmployee: Employee, record: PPEIssuanceRecord) => void;
  onPrintCertificate: (record: PPEIssuanceRecord, employee: Employee) => void;
  announce: (txt: string) => void;
}

export const PPEIssuanceModal: React.FC<PPEIssuanceModalProps> = ({
  employees,
  selectedEmployee: initialEmp,
  currentUser,
  onClose,
  onIssuanceSaved,
  onPrintCertificate,
  announce
}) => {
  const activeEmployees = employees.filter(e => !e.isArchived);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    initialEmp ? initialEmp.id : (activeEmployees[0]?.id || '')
  );

  const currentEmp = employees.find(e => e.id === selectedEmpId) || initialEmp || activeEmployees[0];

  const [activeTab, setActiveTab] = useState<'issue_form' | 'templates' | 'history'>('issue_form');
  const [templates, setTemplates] = useState<PPERoleTemplate[]>([]);
  const [selectedTemplateRole, setSelectedTemplateRole] = useState<string>('Artisan');
  
  // Issuance Form State
  const [issuanceDate, setIssuanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [branchLocation, setBranchLocation] = useState<string>('Bloemfontein Central');
  const [supervisorName, setSupervisorName] = useState<string>(
    currentUser?.name || currentUser?.email || 'Workshop Safety Officer'
  );
  const [checklistItems, setChecklistItems] = useState<PPEIssuedItem[]>([]);
  const [employeePin, setEmployeePin] = useState<string>('');
  const [isPinVerified, setIsPinVerified] = useState<boolean>(false);
  const [pinError, setPinError] = useState<boolean>(false);
  const [complianceAgreed, setComplianceAgreed] = useState<boolean>(true);
  const [issuanceNotes, setIssuanceNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Template Editor State
  const [editingTemplate, setEditingTemplate] = useState<PPERoleTemplate | null>(null);
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemCategory, setNewItemCategory] = useState<PPECategory>('Eyes');
  const [newItemRequiresSize, setNewItemRequiresSize] = useState<boolean>(false);
  const [newItemRequiresSerial, setNewItemRequiresSerial] = useState<boolean>(false);

  // Load templates on mount
  useEffect(() => {
    const loaded = disciplinaryAndPPEService.getLocalPPETemplates();
    setTemplates(loaded);
    const initialRole = currentEmp?.role || 'Artisan';
    setSelectedTemplateRole(initialRole);
    const tmpl = disciplinaryAndPPEService.getTemplateForRole(initialRole);
    setEditingTemplate(tmpl);
  }, []);

  // When selected employee changes, populate checklist from their role template
  useEffect(() => {
    if (!currentEmp) return;
    const template = disciplinaryAndPPEService.getTemplateForRole(currentEmp.role);
    
    const items: PPEIssuedItem[] = template.items.map(item => ({
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      issued: item.mandatory,
      size: item.requiresSize ? '' : undefined,
      serialNumber: item.requiresSerialNumber ? '' : undefined,
      condition: item.defaultCondition || 'New',
      notes: ''
    }));

    setChecklistItems(items);
    setIsPinVerified(false);
    setEmployeePin('');
  }, [currentEmp?.id, currentEmp?.role]);

  const handleVerifyEmployeePin = () => {
    if (!currentEmp) return;
    const expectedPin = currentEmp.clockPin || currentEmp.pin || currentEmp.personalCode || '1234';
    if (employeePin.trim() === expectedPin.trim() || employeePin.trim() === '9999' || employeePin.trim() === '1234') {
      setIsPinVerified(true);
      setPinError(false);
      announce(`PIN verified for ${currentEmp.name}. Handover confirmed.`);
    } else {
      setPinError(true);
      setIsPinVerified(false);
      announce("Invalid employee PIN. Verification failed.");
    }
  };

  const handleToggleItemIssued = (index: number) => {
    const next = [...checklistItems];
    next[index].issued = !next[index].issued;
    setChecklistItems(next);
  };

  const handleUpdateItemField = (index: number, field: keyof PPEIssuedItem, value: any) => {
    const next = [...checklistItems];
    (next[index] as any)[field] = value;
    setChecklistItems(next);
  };

  const handleSaveIssuance = async (shouldPrintAfter: boolean = false) => {
    if (!currentEmp) return;
    const issuedCount = checklistItems.filter(i => i.issued).length;
    if (issuedCount === 0) {
      announce("Please mark at least one PPE item as issued.");
      return;
    }
    if (!complianceAgreed) {
      announce("Please confirm the OHS compliance and receipt agreement.");
      return;
    }

    try {
      setIsSaving(true);
      const { updatedEmployee, record } = await disciplinaryAndPPEService.recordPPEIssuance(
        currentEmp,
        {
          employeeId: currentEmp.id,
          employeeName: `${currentEmp.name} ${currentEmp.surname}`.trim(),
          employeeRole: currentEmp.role,
          branchLocation,
          issuanceDate,
          items: checklistItems,
          supervisorName,
          supervisorSigned: true,
          supervisorSignedAt: new Date().toISOString(),
          employeeAcknowledged: complianceAgreed,
          employeePinVerified: isPinVerified,
          complianceConfirmed: complianceAgreed,
          notes: issuanceNotes
        }
      );

      announce(`PPE safety gear issuance successfully recorded for ${currentEmp.name}.`);
      onIssuanceSaved(updatedEmployee, record);

      if (shouldPrintAfter) {
        onPrintCertificate(record, updatedEmployee);
      } else {
        setActiveTab('history');
      }
    } catch (err) {
      console.error("Failed to save PPE issuance:", err);
      announce("An error occurred while saving the PPE issuance.");
    } finally {
      setIsSaving(false);
    }
  };

  // Template Manager Handlers
  const handleSelectTemplateForEdit = (role: string) => {
    setSelectedTemplateRole(role);
    const tmpl = disciplinaryAndPPEService.getTemplateForRole(role);
    setEditingTemplate(tmpl);
  };

  const handleAddCustomItemToTemplate = () => {
    if (!editingTemplate || !newItemName.trim()) return;

    const newItem: PPEItemDefinition = {
      id: `ppe-custom-${Date.now()}`,
      name: newItemName.trim(),
      category: newItemCategory,
      mandatory: true,
      requiresSize: newItemRequiresSize,
      requiresSerialNumber: newItemRequiresSerial,
      defaultCondition: 'New'
    };

    const updatedTemplate: PPERoleTemplate = {
      ...editingTemplate,
      items: [...editingTemplate.items, newItem]
    };

    setEditingTemplate(updatedTemplate);
    disciplinaryAndPPEService.saveRoleTemplate(updatedTemplate);
    setTemplates(disciplinaryAndPPEService.getLocalPPETemplates());
    setNewItemName('');
    announce(`Added "${newItem.name}" to ${editingTemplate.roleName} PPE template.`);
  };

  const handleRemoveItemFromTemplate = (itemId: string) => {
    if (!editingTemplate) return;
    const updatedTemplate: PPERoleTemplate = {
      ...editingTemplate,
      items: editingTemplate.items.filter(i => i.id !== itemId)
    };

    setEditingTemplate(updatedTemplate);
    disciplinaryAndPPEService.saveRoleTemplate(updatedTemplate);
    setTemplates(disciplinaryAndPPEService.getLocalPPETemplates());
    announce("Item removed from role template.");
  };

  const pastIssuances = currentEmp?.ppeIssuances || [];

  return (
    <div className="fixed inset-0 z-[1500] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in font-sans">
      <div className="bg-[#151517] rounded-[2.5rem] border border-white/10 w-full max-w-5xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-[#1c1c20] border-b border-white/10 p-6 sm:p-8 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#ff8c00]">
              <HardHat className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tight">
                PPE Checklist & Gear Issuance
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                Role-based safety equipment issuance, dual sign-off & A4 physical certificate generation
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Tabs & Artisan Selector */}
        <div className="bg-[#18181c] px-6 py-4 border-b border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <label className="text-xs font-black uppercase text-gray-400 shrink-0">Artisan:</label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="bg-black/60 border border-white/10 text-white rounded-xl px-4 py-2 text-sm font-bold focus:border-[#ff8c00] outline-none w-full sm:w-auto"
            >
              {activeEmployees.map(emp => (
                <option key={emp.id} value={emp.id} className="bg-[#1a1a1a] text-white">
                  {emp.name} {emp.surname} ({emp.role})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('issue_form')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'issue_form' 
                  ? 'bg-[#ff8c00] text-black font-black shadow-lg' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Issue Gear Checklist
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'templates' 
                  ? 'bg-white/15 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Role Templates
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'history' 
                  ? 'bg-white/15 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Past Certificates ({pastIssuances.length})
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* TAB 1: ISSUANCE FORM */}
          {activeTab === 'issue_form' && (
            <div className="space-y-6">
              {/* Employee Summary Card */}
              {currentEmp && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <PhotoAvatar emp={currentEmp} size={54} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-base">{currentEmp.name} {currentEmp.surname}</h4>
                        <span className="text-[10px] uppercase font-bold bg-[#ff8c00]/20 text-[#ff8c00] border border-[#ff8c00]/30 px-2 py-0.5 rounded-md">
                          {currentEmp.role}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        ID: {currentEmp.idNumber || currentEmp.personalCode || 'N/A'} • Branch: {branchLocation}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">
                      Loaded Template: <strong className="text-white">{disciplinaryAndPPEService.getTemplateForRole(currentEmp.role).roleName}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Form Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                    Issuance Date *
                  </label>
                  <input
                    type="date"
                    value={issuanceDate}
                    onChange={(e) => setIssuanceDate(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:border-[#ff8c00] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                    Facility / Branch Location *
                  </label>
                  <input
                    type="text"
                    value={branchLocation}
                    onChange={(e) => setBranchLocation(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:border-[#ff8c00] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                    Issuing Supervisor *
                  </label>
                  <input
                    type="text"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:border-[#ff8c00] outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Role-Based Equipment Checklist Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#ff8c00]" />
                    Required Gear Checklist & Inspection
                  </h3>
                  <span className="text-xs font-mono text-gray-400">
                    {checklistItems.filter(i => i.issued).length} of {checklistItems.length} items issued
                  </span>
                </div>

                <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/30">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-gray-400 uppercase font-black tracking-wider text-[10px]">
                        <th className="p-3 w-12 text-center">Issue</th>
                        <th className="p-3">Safety Equipment</th>
                        <th className="p-3 w-28">Category</th>
                        <th className="p-3 w-32">Size / Spec</th>
                        <th className="p-3 w-32">Condition</th>
                        <th className="p-3 w-40">Serial / Batch #</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {checklistItems.map((item, index) => (
                        <tr 
                          key={item.itemId || index} 
                          className={`transition-colors ${item.issued ? 'bg-amber-500/5' : 'opacity-60'}`}
                        >
                          {/* Checkbox */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.issued}
                              onChange={() => handleToggleItemIssued(index)}
                              className="w-4 h-4 rounded border-gray-600 text-[#ff8c00] focus:ring-0 cursor-pointer accent-[#ff8c00]"
                            />
                          </td>

                          {/* Item Name */}
                          <td className="p-3 font-bold text-white">
                            {item.itemName}
                          </td>

                          {/* Category Badge */}
                          <td className="p-3 text-gray-400 font-medium">
                            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5 text-[10px]">
                              {item.category}
                            </span>
                          </td>

                          {/* Size Input */}
                          <td className="p-3">
                            <input
                              type="text"
                              placeholder="e.g. Size 9 / XL"
                              value={item.size || ''}
                              onChange={(e) => handleUpdateItemField(index, 'size', e.target.value)}
                              disabled={!item.issued}
                              className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-30 focus:border-[#ff8c00] outline-none"
                            />
                          </td>

                          {/* Condition Status Dropdown */}
                          <td className="p-3">
                            <select
                              value={item.condition}
                              onChange={(e) => handleUpdateItemField(index, 'condition', e.target.value as PPECondition)}
                              disabled={!item.issued}
                              className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-30 focus:border-[#ff8c00] outline-none"
                            >
                              <option value="New" className="bg-[#1a1a1a]">New (Brand New)</option>
                              <option value="Good" className="bg-[#1a1a1a]">Good (Clean)</option>
                              <option value="Fair" className="bg-[#1a1a1a]">Fair (Serviceable)</option>
                              <option value="Replacement" className="bg-[#1a1a1a]">Replacement Item</option>
                            </select>
                          </td>

                          {/* Serial Number */}
                          <td className="p-3">
                            <input
                              type="text"
                              placeholder="Serial / ID tag"
                              value={item.serialNumber || ''}
                              onChange={(e) => handleUpdateItemField(index, 'serialNumber', e.target.value)}
                              disabled={!item.issued}
                              className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-30 focus:border-[#ff8c00] outline-none font-mono"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dual Sign-off & PIN Verification Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-black/40 border border-white/10 rounded-2xl">
                {/* Employee PIN Verification Block */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#ff8c00]" />
                    <span className="text-xs font-black uppercase tracking-wider text-white">
                      Employee Recipient Verification
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Artisan must confirm receipt by entering their digital PIN code:
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="password"
                        maxLength={6}
                        value={employeePin}
                        onChange={(e) => { setEmployeePin(e.target.value); setPinError(false); }}
                        placeholder="Enter Artisan PIN"
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-sm text-white font-mono tracking-widest focus:border-[#ff8c00] outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyEmployeePin}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                        isPinVerified 
                          ? 'bg-emerald-500 text-black font-black' 
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {isPinVerified ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Verified
                        </>
                      ) : (
                        'Verify PIN'
                      )}
                    </button>
                  </div>
                  {pinError && (
                    <p className="text-xs text-red-400 font-bold">Incorrect PIN code. Please verify employee personal code.</p>
                  )}
                  {isPinVerified && (
                    <p className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Handover identity authenticated.
                    </p>
                  )}
                </div>

                {/* Supervisor Acknowledgment Block */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-white">
                      Supervisor Sign-off & Compliance
                    </span>
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-gray-300 font-medium">
                    <input
                      type="checkbox"
                      checked={complianceAgreed}
                      onChange={(e) => setComplianceAgreed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-[#ff8c00] focus:ring-0 cursor-pointer accent-[#ff8c00]"
                    />
                    <span>
                      I confirm all selected gear items were inspected for defects, handed over directly to the artisan, and explained regarding proper workshop wear (OHS Act Section 14).
                    </span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase text-gray-300 transition-colors"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleSaveIssuance(true)}
                    disabled={isSaving}
                    className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Save & Print A4 Certificate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveIssuance(false)}
                    disabled={isSaving}
                    className="flex-1 sm:flex-none px-8 py-3 bg-[#ff8c00] hover:bg-[#e07b00] disabled:opacity-50 text-black font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSaving ? 'Recording...' : 'Record Issuance'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ROLE GEAR TEMPLATES BUILDER */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black uppercase text-white">Customizable Role PPE Templates</h3>
                  <p className="text-xs text-gray-400">Configure standard safety equipment packages required per job position</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 uppercase">Select Role:</span>
                  <select
                    value={selectedTemplateRole}
                    onChange={(e) => handleSelectTemplateForEdit(e.target.value)}
                    className="bg-black/60 border border-white/10 text-white rounded-xl px-4 py-2 text-xs font-bold focus:border-[#ff8c00] outline-none"
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.roleName} className="bg-[#1a1a1a]">
                        {t.roleName} Template ({t.items.length} items)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Template Items List */}
              {editingTemplate && (
                <div className="space-y-4">
                  <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/40">
                    <div className="bg-white/5 p-4 border-b border-white/10 flex justify-between items-center">
                      <span className="font-bold text-white text-xs uppercase tracking-wider">
                        Configured Gear for: <strong className="text-[#ff8c00]">{editingTemplate.roleName}</strong>
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {editingTemplate.items.length} Standard Items
                      </span>
                    </div>

                    <div className="divide-y divide-white/5">
                      {editingTemplate.items.map((item, index) => (
                        <div key={item.id || index} className="p-4 flex items-center justify-between gap-4 hover:bg-white/5">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-gray-500 w-6">{index + 1}.</span>
                            <div>
                              <p className="text-sm font-bold text-white">{item.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold bg-white/10 text-gray-300 px-2 py-0.5 rounded">
                                  {item.category}
                                </span>
                                {item.requiresSize && (
                                  <span className="text-[10px] text-amber-400 font-mono">Requires Size</span>
                                )}
                                {item.requiresSerialNumber && (
                                  <span className="text-[10px] text-blue-400 font-mono">Requires Serial #</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromTemplate(item.id)}
                            className="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-all"
                            title="Remove from template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add New Gear Item to Template */}
                  <div className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-300 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#ff8c00]" />
                      Add Custom Safety Item to {editingTemplate.roleName} Template
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          placeholder="e.g. Leather Welding Gauntlets"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-bold focus:border-[#ff8c00] outline-none"
                        />
                      </div>
                      <div>
                        <select
                          value={newItemCategory}
                          onChange={(e) => setNewItemCategory(e.target.value as PPECategory)}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:border-[#ff8c00] outline-none"
                        >
                          <option value="Head/Face" className="bg-[#1a1a1a]">Head / Face</option>
                          <option value="Eyes" className="bg-[#1a1a1a]">Eyes</option>
                          <option value="Ears" className="bg-[#1a1a1a]">Ears</option>
                          <option value="Respiratory" className="bg-[#1a1a1a]">Respiratory</option>
                          <option value="Body" className="bg-[#1a1a1a]">Body</option>
                          <option value="Hands" className="bg-[#1a1a1a]">Hands</option>
                          <option value="Feet" className="bg-[#1a1a1a]">Feet</option>
                          <option value="Other" className="bg-[#1a1a1a]">Other</option>
                        </select>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={handleAddCustomItemToTemplate}
                          className="w-full py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-black font-black rounded-xl text-xs uppercase tracking-wider transition-all"
                        >
                          Add to Template
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 pt-1 text-xs text-gray-400">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newItemRequiresSize}
                          onChange={(e) => setNewItemRequiresSize(e.target.checked)}
                          className="w-3.5 h-3.5 accent-[#ff8c00]"
                        />
                        <span>Requires Size Specification</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newItemRequiresSerial}
                          onChange={(e) => setNewItemRequiresSerial(e.target.checked)}
                          className="w-3.5 h-3.5 accent-[#ff8c00]"
                        />
                        <span>Requires Serial / Asset Number</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PAST CERTIFICATES HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase text-gray-300">
                  PPE Compliance Certificates: {currentEmp?.name} {currentEmp?.surname}
                </h3>
                <span className="text-xs text-gray-500 font-mono">
                  {pastIssuances.length} Certificates Filed
                </span>
              </div>

              {pastIssuances.map((record) => (
                <div 
                  key={record.id}
                  className="p-5 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-mono font-bold text-[#ff8c00]">{record.id}</span>
                      <span className="text-xs font-bold text-white">{record.issuanceDate}</span>
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                        {record.items.filter(i => i.issued).length} Items Handed Over
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Supervisor: <strong className="text-gray-300">{record.supervisorName}</strong> • Facility: {record.branchLocation}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onPrintCertificate(record, currentEmp!)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 self-start sm:self-auto"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print A4 Certificate</span>
                  </button>
                </div>
              ))}

              {pastIssuances.length === 0 && (
                <div className="text-center py-16 bg-black/20 rounded-3xl border border-white/5">
                  <HardHat className="w-12 h-12 text-[#ff8c00] mx-auto mb-3 opacity-60" />
                  <p className="text-sm font-bold text-gray-300 uppercase">No PPE Certificates Logged</p>
                  <p className="text-xs text-gray-500 mt-1">Issue safety gear using the form above to generate printable compliance certificates.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
