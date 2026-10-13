import React from 'react';
import { Icon } from './Icon';
import { KanbanTemplate } from '../types';

interface SectionEditorProps {
  sectionKey: string;
  layoutType: string;
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

export const SectionEditor: React.FC<SectionEditorProps> = ({ sectionKey, layoutType }) => {
  if (layoutType !== 'freeform') {
    let presetLabel = "Structured Kanban Table";
    if (layoutType === 'inventory_details') presetLabel = "Inventory Reorder details";
    else if (layoutType === 'qr_barcode') presetLabel = "QR & Barcode Tag";
    else if (layoutType === 'status_badge') presetLabel = "Alert Status Badge";

    return (
      <div className="p-4 rounded-lg bg-black/40 border border-white/10 text-center space-y-2">
        <Icon name="layout-template" size={32} className="text-purple-500 mx-auto animate-pulse" />
        <p className="text-xs text-gray-400 font-bold">Preset Active: {presetLabel}</p>
        <p className="text-[10px] text-gray-500 mt-1 font-sans">
          This section is utilizing the pre-formatted <strong>{presetLabel}</strong> template with automatic field mapping.
        </p>
        <p className="text-[10px] text-gray-600 font-sans italic">
          To place custom draggable fields here instead, change the Preset Style to "Freeform Canvas" above.
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

  const calculateMaxQrWidth = (cardWidthMm: number, pictureWidthPx: number): number => {
    const scaleFactor = 720 / 297;
    const availableCardWidthPx = Math.round(cardWidthMm * scaleFactor);
    const pictureColWidthPx = pictureWidthPx + 8;
    const supplierMinPx = 124;
    const paddingPx = 16;
    return Math.max(0, Math.floor(availableCardWidthPx - pictureColWidthPx - supplierMinPx - paddingPx));
  };

  const handleSectionLayoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTemplate(prev => {
      if (!prev) return null;
      const newLayout = JSON.parse(JSON.stringify(prev.layout));
      let val = Number(value) || 0;
      if (name === 'width') {
        const maxPrintableWidth = prev.dimensions?.width || 210;
        val = Math.min(val, maxPrintableWidth);

        const currentPicWidth = newLayout[activeTab]?.picture?.width ?? 110;
        const maxQr = calculateMaxQrWidth(val, currentPicWidth);
        const currentQrWidth = newLayout[activeTab]?.qr?.width ?? 110;
        if (currentQrWidth > maxQr) {
          newLayout[activeTab].qr = {
            ...(newLayout[activeTab].qr || { x: 0, y: 15, width: 110, height: 110 }),
            width: maxQr
          };
        }
      }
      newLayout[activeTab] = { ...newLayout[activeTab], [name]: val };
      return { ...prev, layout: newLayout };
    });
  };

  const handleNestedLayoutChange = (parentKey: 'picture' | 'qr', fieldName: 'x' | 'y' | 'width' | 'height', value: number) => {
    setTemplate(prev => {
      if (!prev) return null;
      const newLayout = JSON.parse(JSON.stringify(prev.layout));
      const currentSection = newLayout[activeTab] || {};

      const currentParent = currentSection[parentKey] || {
        x: parentKey === 'picture' ? 15 : 150,
        y: 15,
        width: 110,
        height: 110
      };
      newLayout[activeTab] = {
        ...currentSection,
        [parentKey]: {
          ...currentParent,
          [fieldName]: value
        }
      };
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

  const handleLayoutTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setTemplate((prev: any) => {
      if (!prev) return null;
      const newLayout = JSON.parse(JSON.stringify(prev.layout));
      newLayout[activeTab] = { ...newLayout[activeTab], layoutType: val };
      
      if (val === 'status_badge' && !newLayout[activeTab].style) {
        newLayout[activeTab].style = {
          text: activeTab === 'section4' ? 'PULLED' : 'URGENT',
          fontSize: 16,
          fontColor: '#FFFFFF',
          backgroundColor: '#EF4444',
          borderWidth: 0
        };
      }
      return { ...prev, layout: newLayout };
    });
  };

  const handleActiveSectionStyleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    let propValue: any = value;
    if (type === 'number') {
      propValue = Number(value);
    }
    setTemplate((prev: any) => {
      if (!prev) return null;
      const newLayout = JSON.parse(JSON.stringify(prev.layout));
      if (!newLayout[activeTab].style) {
        newLayout[activeTab].style = {};
      }
      newLayout[activeTab].style[name] = propValue;
      return { ...prev, layout: newLayout };
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
          <button onClick={onCancel} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold uppercase text-gray-300 font-sans flex items-center gap-1">← Back</button>
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
        {activeTab.startsWith('section') && (() => {
          const activeLayout = (template.layout as any)[activeTab] || {};
          const activeSectionLayoutType = activeLayout.layoutType || (activeTab === 'section1' ? 'structured_kanban' : 'freeform');
          return (
            <div className="animate-in fade-in-20 space-y-4">
              <h4 className="text-xs font-black uppercase text-gray-400 font-sans">Section {activeTab.slice(-1)} Properties</h4>
              
              <div className="p-3 bg-black/20 rounded-lg border border-white/10 space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Preset Style Style</label>
                  <select 
                    value={activeSectionLayoutType} 
                    onChange={handleLayoutTypeChange} 
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 mt-1 text-sm appearance-none text-white cursor-pointer select-none font-bold text-purple-300 font-sans"
                  >
                    <option value="freeform">📐 Freeform Canvas (Drag-&-Drop)</option>
                    <option value="structured_kanban">📋 Structured Kanban Table</option>
                    <option value="inventory_details">📦 Inventory Reorder details</option>
                    <option value="qr_barcode">🏷️ QR & Barcode Tag</option>
                    <option value="status_badge">🚨 Alert Status Badge</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-black/20 rounded-lg border border-white/10 space-y-4">
                <div>
                  <h5 className="text-[10px] font-bold uppercase text-gray-500 mb-2 font-sans">Section Layout Control</h5>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Width (mm)</label>
                      <input type="number" name="width" value={activeLayout.width || 0} onChange={handleSectionLayoutChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Height (mm)</label>
                      <input type="number" name="height" value={activeLayout.height || 0} onChange={handleSectionLayoutChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">X Position (mm)</label>
                      <input type="number" name="x" value={activeLayout.x ?? 0} onChange={handleSectionLayoutChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Y Position (mm)</label>
                      <input type="number" name="y" value={activeLayout.y ?? 0} onChange={handleSectionLayoutChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <h5 className="text-[10px] font-bold uppercase text-purple-400 mb-2 font-sans">Picture Box Layout</h5>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Picture X (mm)</label>
                      <input type="number" value={activeLayout.picture?.x ?? 15} onChange={(e) => handleNestedLayoutChange('picture', 'x', Number(e.target.value) || 0)} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Picture Y (mm)</label>
                      <input type="number" value={activeLayout.picture?.y ?? 15} onChange={(e) => handleNestedLayoutChange('picture', 'y', Number(e.target.value) || 0)} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Picture Width (mm)</label>
                      <input type="number" value={activeLayout.picture?.width ?? 110} onChange={(e) => handleNestedLayoutChange('picture', 'width', Number(e.target.value) || 0)} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Picture Height (mm)</label>
                      <input type="number" value={activeLayout.picture?.height ?? 110} onChange={(e) => handleNestedLayoutChange('picture', 'height', Number(e.target.value) || 0)} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <h5 className="text-[10px] font-bold uppercase text-purple-400 mb-2 font-sans">QR Code Layout</h5>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">QR X (mm)</label>
                      <input type="number" value={activeLayout.qr?.x ?? 150} onChange={(e) => handleNestedLayoutChange('qr', 'x', Number(e.target.value) || 0)} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">QR Y (mm)</label>
                      <input type="number" value={activeLayout.qr?.y ?? 0} onChange={(e) => handleNestedLayoutChange('qr', 'y', Number(e.target.value) || 0)} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">QR Width (mm)</label>
                      <input type="number" value={activeLayout.qr?.width ?? 50} onChange={(e) => handleNestedLayoutChange('qr', 'width', Number(e.target.value) || 0)} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">QR Height (mm)</label>
                      <input type="number" value={activeLayout.qr?.height ?? 50} onChange={(e) => handleNestedLayoutChange('qr', 'height', Number(e.target.value) || 0)} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                  </div>
                </div>
              </div>

              <h4 className="text-xs font-black uppercase text-gray-400 font-sans">Drag to Preview Area</h4>
              <SectionEditor sectionKey={activeTab} layoutType={activeSectionLayoutType} />
              
              {activeSectionLayoutType === 'status_badge' && activeLayout.style && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-2 animate-in fade-in-20">
                  <h4 className="text-xs font-black uppercase text-gray-400 mb-2 font-sans">Badge Customizer Style</h4>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Text Label</label>
                    <input name="text" value={activeLayout.style.text || ''} onChange={handleActiveSectionStyleChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Font Size (pt)</label>
                      <input type="number" name="fontSize" value={activeLayout.style.fontSize || 16} onChange={handleActiveSectionStyleChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Border (px)</label>
                      <input type="number" name="borderWidth" value={activeLayout.style.borderWidth || 0} onChange={handleActiveSectionStyleChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Font Color</label>
                      <input type="color" name="fontColor" value={activeLayout.style.fontColor || '#FFFFFF'} onChange={handleActiveSectionStyleChange} className="w-full bg-black/40 border border-white/10 rounded-lg h-10 w-full cursor-pointer" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">BG Color</label>
                      <input type="color" name="backgroundColor" value={activeLayout.style.backgroundColor || '#EF4444'} onChange={handleActiveSectionStyleChange} className="w-full bg-black/40 border border-white/10 rounded-lg h-10 w-full cursor-pointer" />
                    </div>
                  </div>
                </div>
              )}

              {field && activeSectionLayoutType === 'freeform' && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-3 animate-in fade-in-20">
                  <h4 className="text-xs font-black uppercase text-purple-400 font-sans">Field: <span className="text-purple-300 font-mono">{field.type}</span></h4>
                  {field.type === 'customText' && (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Custom Text Value</label>
                      <input name="value" value={field.value || ''} onChange={handleFieldPropertyChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Font Size</label>
                      <input type="number" name="fontSize" value={field.fontSize || 12} onChange={handleFieldPropertyChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm text-white font-sans" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Font Weight</label>
                      <select name="fontWeight" value={field.fontWeight || 'normal'} onChange={handleFieldPropertyChange} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 mt-1 text-sm appearance-none text-white cursor-pointer select-none font-sans">
                        <option value="normal">Normal</option>
                        <option value="bold">Bold</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500 font-sans">Font Color</label>
                    <input type="color" name="fontColor" value={field.fontColor || '#FFFFFF'} onChange={handleFieldPropertyChange} className="w-full bg-black/40 border border-white/10 rounded-lg h-10 w-full cursor-pointer" />
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </aside>
  );
};
