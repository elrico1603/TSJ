import React from 'react';
import { Icon } from './Icon';
import { KanbanTemplate } from '../types';

interface SectionEditorProps {
  sectionKey: string;
}

const AVAILABLE_FIELDS: Record<string, Array<{ type: string; label: string }>> = {
  section1: [ 
    { type: 'productImage', label: 'Product Image' }, { type: 'partDescription', label: 'Part Description' }, { type: 'partNumber', label: 'Part Number' }, { type: 'supplierPartNumber', label: 'Supplier P/N' }, { type: 'supplier', label: 'Supplier' }, { type: 'orderQuantity', label: 'Order Quantity' }, { type: 'reorderPoint', label: 'Reorder Point' }, { type: 'deliveryTime', label: 'Delivery Time' }, { type: 'location', label: 'Location' }, { type: 'customText', label: 'Custom Text' } 
  ],
  section2: [ 
    { type: 'barcode', label: 'Barcode' }, { type: 'qrCode', label: 'QR Code' }, { type: 'contactDetails', label: 'Contact Details' }, { type: 'reorderInfo', label: 'Reorder Info' }, { type: 'notes', label: 'Notes' }, { type: 'customText', label: 'Custom Text' } 
  ],
  section3: [ 
    { type: 'productImage', label: 'Large Product Image' }, { type: 'partDescription', label: 'Large Part Description' }, { type: 'storageLocation', label: 'Storage Location' }, { type: 'customText', label: 'Custom Text' } 
  ],
  section4: [ 
    { type: 'orderQuantity', label: 'Order Quantity' }, { type: 'deliveryTime', label: 'Delivery Time' }, { type: 'reorderInstructions', label: 'Reorder Instructions' } 
  ],
  section5: [ 
    { type: 'location', label: 'Location' }, { type: 'partDescription', label: 'Part Description' }, { type: 'partNumber', label: 'Part Number' }, { type: 'supplier', label: 'Supplier' }, { type: 'orderQuantity', label: 'Order Quantity' }, { type: 'reorderPoint', label: 'Reorder Point' }, { type: 'deliveryTime', label: 'Delivery Time' }, { type: 'customText', label: 'Custom Text' } 
  ]
};

export const SectionEditor: React.FC<SectionEditorProps> = ({ sectionKey }) => {
  if (sectionKey === 'section1') {
    return (
      <div className="p-4 rounded-lg bg-black/40 border border-white/10 text-center space-y-2">
        <Icon name="layout-template" size={32} className="text-gray-600 mx-auto" />
        <p className="text-xs text-gray-400 font-bold">Section 1 has a fixed layout.</p>
        <p className="text-[10px] text-gray-500 mt-1">
          The layout for this section is pre-defined and cannot be customized with draggable fields.
        </p>
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, fieldType: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ fieldType, sourceSection: sectionKey }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="space-y-2">
      {(AVAILABLE_FIELDS[sectionKey] || []).map(fieldInfo => (
        <div
          key={fieldInfo.type}
          draggable="true"
          onDragStart={(e) => handleDragStart(e, fieldInfo.type)}
          className="flex items-center gap-3 p-3 rounded-lg bg-black/40 border border-white/10 hover:bg-purple-500/10 hover:border-purple-500 cursor-grab active:cursor-grabbing"
        >
          <Icon name="menu" size={16} className="text-gray-500 flex-shrink-0" />
          <span className="text-xs font-bold text-gray-300">{fieldInfo.label}</span>
        </div>
      ))}
    </div>
  );
};

interface TemplatePropertiesPanelProps {
  template: KanbanTemplate;
  setTemplate: React.Dispatch<React.SetStateAction<KanbanTemplate | null>>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSave: () => void;
  onCancel: () => void;
  activeField: string | null;
  setSampleImage: (img: string | null) => void;
  onPrint: () => void;
}

export const TemplatePropertiesPanel: React.FC<TemplatePropertiesPanelProps> = ({
  template,
  setTemplate,
  activeTab,
  setActiveTab,
  onSave,
  onCancel,
  activeField,
  setSampleImage,
  onPrint
}) => {
  const handleDimensionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTemplate(prev => {
      if (!prev) return null;
      return { ...prev, dimensions: { ...prev.dimensions, [name]: Number(value) || 0 } };
    });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTemplate(prev => {
      if (!prev) return null;
      return { ...prev, templateName: e.target.value };
    });
  };

  const handleSectionLayoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTemplate(prev => {
      if (!prev) return null;
      const newLayout = JSON.parse(JSON.stringify(prev.layout));
      newLayout[activeTab] = { ...newLayout[activeTab], [name]: Number(value) || 0 };
      return { ...prev, layout: newLayout };
    });
  };

  const findActiveField = () => {
    if (!activeField || !template) return { field: null, sectionKey: null };
    for (const sectionKey in template.layout) {
      const parent = (template.layout as any)[sectionKey];
      const field = parent?.fields?.find((f: any) => f.id === activeField);
      if (field) return { field, sectionKey };
    }
    return { field: null, sectionKey: null };
  };

  const { field, sectionKey } = findActiveField();

  const handleFieldPropertyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (!field || !sectionKey) return;

    let propValue: any = value;
    if (type === 'checkbox') {
      propValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number') {
      propValue = Number(propValue);
    }

    setTemplate(prev => {
      if (!prev) return null;
      const newLayout = JSON.parse(JSON.stringify(prev.layout));
      const sectionFields = newLayout[sectionKey].fields;
      const fieldIndex = sectionFields.findIndex((f: any) => f.id === activeField);
      if (fieldIndex > -1) {
        sectionFields[fieldIndex][name] = propValue;
      }
      return { ...prev, layout: newLayout };
    });
  };

  const handleSection4StyleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTemplate(prev => {
      if (!prev) return null;
      return {
        ...prev,
        layout: {
          ...prev.layout,
          section4: {
            ...prev.layout.section4,
            style: {
              ...prev.layout.section4.style,
              [name]: value
            }
          }
        }
      } as any;
    });
  };

  const handleSampleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSampleImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const tabs = ['dimensions', 'section1', 'section2', 'section3', 'section4', 'section5'];

  return (
    <aside className="w-96 bg-black/30 p-6 flex flex-col gap-4 border-l border-white/10 shrink-0 font-sans">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-black uppercase tracking-wider text-white">Editor</h3>
        <div className="flex gap-2">
          <button onClick={onPrint} className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/40 rounded-lg text-xs font-bold uppercase text-blue-300">Print</button>
          <button onClick={onCancel} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold uppercase text-gray-300 font-sans">Cancel</button>
          <button onClick={onSave} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-black uppercase text-white font-sans">Save</button>
        </div>
      </div>
      <div className="bg-black/20 p-1 rounded-lg grid grid-cols-3 gap-1">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-2 py-1.5 rounded-md text-[10px] font-black uppercase transition-colors ${activeTab === tab ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:bg-white/5'}`}>
            {tab === 'dimensions' ? 'Global' : `Sec ${tab.slice(-1)}`}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar -mr-3 pr-3 space-y-4">
        {activeTab === 'dimensions' && (
          <div className="space-y-3 animate-in fade-in-20">
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500">Template Name</label>
              <input value={template.templateName} onChange={handleNameChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">Width (mm)</label>
                <input type="number" name="width" value={template.dimensions.width} onChange={handleDimensionChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">Height (mm)</label>
                <input type="number" name="height" value={template.dimensions.height} onChange={handleDimensionChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">Margin (mm)</label>
                <input type="number" name="margin" value={template.dimensions.margin} onChange={handleDimensionChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">Gap (mm)</label>
                <input type="number" name="sectionGap" value={template.dimensions.sectionGap} onChange={handleDimensionChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white" />
              </div>
            </div>
            <div className="pt-3 border-t border-white/10">
              <label className="text-[10px] font-bold uppercase text-gray-500">Sample Product Image</label>
              <label className="mt-1 cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-3 text-center text-xs font-bold uppercase tracking-widest text-gray-300 w-full block">
                Upload for Preview
                <input type="file" accept="image/*" onChange={handleSampleImageUpload} className="hidden" />
              </label>
              <p className="text-[10px] text-gray-600 mt-1 text-center font-sans">This image is for preview only and won't be saved with the template.</p>
            </div>
          </div>
        )}
        {activeTab.startsWith('section') && (
          <div className="animate-in fade-in-20 space-y-4">
            <h4 className="text-xs font-black uppercase text-gray-400">Section {activeTab.slice(-1)} Properties</h4>
            
            <div className="p-3 bg-black/20 rounded-lg border border-white/10">
              <h5 className="text-[10px] font-bold uppercase text-gray-500 mb-2">Section Dimensions</h5>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500">Width (mm)</label>
                  <input type="number" name="width" value={(template.layout as any)[activeTab]?.width || 0} onChange={handleSectionLayoutChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500">Height (mm)</label>
                  <input type="number" name="height" value={(template.layout as any)[activeTab]?.height || 0} onChange={handleSectionLayoutChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white" />
                </div>
              </div>
            </div>

            <h4 className="text-xs font-black uppercase text-gray-400">Drag to Preview Area</h4>
            <SectionEditor sectionKey={activeTab} />
            
            {activeTab === 'section4' && (template.layout.section4 as any).style && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                <h4 className="text-xs font-black uppercase text-gray-400 mb-2">Status Box Style</h4>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500">Text</label>
                  <input name="text" value={(template.layout.section4 as any).style.text} onChange={handleSection4StyleChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500">Font Size</label>
                    <input type="number" name="fontSize" value={(template.layout.section4 as any).style.fontSize} onChange={handleSection4StyleChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500">Font Color</label>
                    <input type="color" name="fontColor" value={(template.layout.section4 as any).style.fontColor} onChange={handleSection4StyleChange} className="w-full bg-black/40 border border-white/10 rounded-lg h-10 w-full cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500">BG Color</label>
                    <input type="color" name="backgroundColor" value={(template.layout.section4 as any).style.backgroundColor} onChange={handleSection4StyleChange} className="w-full bg-black/40 border border-white/10 rounded-lg h-10 w-full cursor-pointer" />
                  </div>
                </div>
              </div>
            )}

            {field && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-3 animate-in fade-in-20">
                <h4 className="text-xs font-black uppercase text-purple-400">Field: <span className="text-purple-300 font-mono">{field.type}</span></h4>
                {field.type === 'customText' && (
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500">Custom Text Value</label>
                    <input name="value" value={field.value || ''} onChange={handleFieldPropertyChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500">Font Size</label>
                    <input type="number" name="fontSize" value={field.fontSize || 12} onChange={handleFieldPropertyChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500">Font Weight</label>
                    <select name="fontWeight" value={field.fontWeight || 'normal'} onChange={handleFieldPropertyChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm appearance-none text-white cursor-pointer select-none">
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500">Font Color</label>
                  <input type="color" name="fontColor" value={field.fontColor || '#FFFFFF'} onChange={handleFieldPropertyChange} className="w-full bg-black/40 border border-white/10 rounded-lg h-10 w-full cursor-pointer" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
