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
      ] 
    },
    section2: { 
      width: 46, 
      height: 46.2, 
      fields: [ 
        { id: "f4", type: "qrCode", sourceField: "partNumber", x: 20, y: 10, width: 60, height: 60, visible: true } 
      ] 
    },
    section3: { 
      width: 46, 
      height: 46.2, 
      fields: [] 
    },
    section4: { 
      width: 46, 
      height: 46.2, 
      style: { text: "KANBAN PULLED", fontSize: 18, fontColor: "#FFFFFF", backgroundColor: "#EF4444", borderWidth: 0 }, 
      fields: [] 
    },
    section5: { 
      width: 95, 
      height: 39.6, 
      fields: [ 
        { id: "f5", type: "customText", value: "Summary Section", x: 5, y: 25, width: 90, height: 50, visible: true, fontSize: 12 } 
      ] 
    }
  },
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

  const selectedTemplateId = editingTemplate?.id || null;

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
      <aside className="w-96 bg-black/30 p-6 flex flex-col gap-6 border-r border-white/10 shrink-0 font-sans">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black uppercase tracking-wider text-white font-sans">Templates</h2>
          <div className="flex gap-2">
            <button onClick={handleDuplicateTemplate} disabled={!selectedTemplateId} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold uppercase text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">Duplicate</button>
            <button onClick={handleNewTemplate} className="px-4 py-2 bg-[#ff8c00] hover:bg-[#e07b00] rounded-lg text-xs font-black uppercase tracking-widest text-white transition-colors">
              New
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar -mr-3 pr-3 space-y-3">
          {kanbanTemplates.map(t => (
            <div key={t.id} onClick={() => handleSelectTemplate(t)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedTemplateId === t.id ? 'bg-purple-500/10 border-purple-500' : 'bg-black/40 border-transparent hover:border-white/20'}`}>
              <h3 className="font-bold text-white mb-1 font-sans">{t.templateName}</h3>
              <p className="text-xs text-gray-400 font-sans">{t.dimensions.width}mm x {t.dimensions.height}mm</p>
            </div>
          ))}
          {kanbanTemplates.length === 0 && (
            <div className="text-center py-20 font-sans">
              <Icon name="layout-template" size={48} className="text-gray-700 mx-auto" />
              <p className="text-xs text-gray-600 font-bold uppercase mt-4">No templates found.</p>
              <p className="text-xs text-gray-600 mt-1">Create a new template to begin.</p>
            </div>
          )}
        </div>
        {selectedTemplateId && selectedTemplateId !== 'sample-template-local' && (
          <button onClick={handleDeleteTemplate} className="w-full py-3 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-lg text-xs font-black uppercase text-red-500 font-sans">Delete Selected</button>
        )}
      </aside>
      <div className="flex-1 flex overflow-hidden">
        {editingTemplate ? (
          <React.Fragment>
            <CardPreview template={editingTemplate} setTemplate={setEditingTemplate} activeField={activeField} setActiveField={setActiveField} sampleImage={sampleImage} />
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
            <p className="text-gray-500 font-black uppercase tracking-widest text-center">Select a template to edit or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
};
