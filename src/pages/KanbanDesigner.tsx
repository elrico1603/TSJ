import React, { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Icon } from '../components/Icon';
import { 
  KanbanTemplateV2, 
  KanbanSectionConfig, 
  getTemplates, 
  saveTemplate, 
  deleteTemplate, 
  createDefaultTemplateBlueprint 
} from '../services/templateService';
import { KanbanCardMaster, getKanbanCards } from '../services/kanbanService';
import { MasterInformation } from '../components/MasterInformation';
import { KanbanPulled } from '../components/KanbanPulled';
import { WarehouseIdentification } from '../components/WarehouseIdentification';
import { WarehouseDisplay } from '../components/WarehouseDisplay';

interface KanbanDesignerProps {
  currentUser: any;
  announce: (message: string) => void;
  onPrintPreview: (template: KanbanTemplateV2, sampleCard: KanbanCardMaster) => void;
}

// Sample product card data for preview purposes when no database cards are available
const FALLBACK_SAMPLE_CARDS: KanbanCardMaster[] = [
  {
    kanbanId: 'KAN-000001',
    productDescription: 'SOLID OAK CORNICE - OGEE PROFILE 3000MM',
    imageUrl: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=200',
    supplierPartNumber: 'OAK-CORN-01',
    supplierName: 'Sovereign Timber Ltd',
    orderQuantity: '50 PCS',
    binQuantity: '2 Bins (25/Bin)',
    deliveryTime: '3 Days',
    location: { letter: 'A', number: '12', colour: 'GREEN' },
    qrCodeUrl: '',
    activeTemplateId: '',
    createdDate: new Date().toISOString(),
    createdBy: 'System Seed',
    lastModifiedDate: new Date().toISOString(),
    lastModifiedBy: 'System Seed',
    status: 'ACTIVE'
  },
  {
    kanbanId: 'KAN-000002',
    productDescription: 'BRASS HINGES 75MM - heavy duty cabinet fitting',
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=200',
    supplierPartNumber: 'BR-HINGE-75',
    supplierName: 'Häfele South Africa',
    orderQuantity: '200 UNITS',
    binQuantity: '1 Bin',
    deliveryTime: 'Next Day',
    location: { letter: 'B', number: '04', colour: 'BLUE' },
    qrCodeUrl: '',
    activeTemplateId: '',
    createdDate: new Date().toISOString(),
    createdBy: 'System Seed',
    lastModifiedDate: new Date().toISOString(),
    lastModifiedBy: 'System Seed',
    status: 'ACTIVE'
  }
];

export const KanbanDesigner: React.FC<KanbanDesignerProps> = ({
  currentUser,
  announce,
  onPrintPreview
}) => {
  const [templates, setTemplates] = useState<KanbanTemplateV2[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<KanbanTemplateV2 | null>(null);
  const [cardsList, setCardsList] = useState<KanbanCardMaster[]>([]);
  const [selectedCard, setSelectedCard] = useState<KanbanCardMaster>(FALLBACK_SAMPLE_CARDS[0]);
  const [activeSectionId, setActiveSectionId] = useState<string>('master_info');
  const [loading, setLoading] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // A4 layout dimensions & scaling factor calculations
  const canvasHeightPx = 680; // height inside editor
  const canvasWidthPx = Math.round(canvasHeightPx * (210 / 297)); // A4 Aspect ratio (~481px)
  const scaleFactor = canvasHeightPx / 297; // scale factor pixels per mm

  const mmToPx = (mm: number) => Math.round(mm * scaleFactor);
  const pxToMm = (px: number) => Math.round(px / scaleFactor);

  // Load templates and product cards on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedTemplates, fetchedCards] = await Promise.all([
        getTemplates(),
        getKanbanCards()
      ]);
      setTemplates(fetchedTemplates);
      if (fetchedCards && fetchedCards.length > 0) {
        setCardsList(fetchedCards);
        setSelectedCard(fetchedCards[0]);
      } else {
        setCardsList(FALLBACK_SAMPLE_CARDS);
        setSelectedCard(FALLBACK_SAMPLE_CARDS[0]);
      }
    } catch (error) {
      console.error('Failed to load designer context:', error);
      announce('Failed to load database. Loading mock fallback context.');
      setCardsList(FALLBACK_SAMPLE_CARDS);
      setSelectedCard(FALLBACK_SAMPLE_CARDS[0]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (tpl: KanbanTemplateV2) => {
    setActiveTemplate(JSON.parse(JSON.stringify(tpl)));
    // Auto focus first section
    if (tpl.sections && tpl.sections.length > 0) {
      setActiveSectionId(tpl.sections[0].id);
    }
    announce(`Loaded layout "${tpl.templateName}"`);
  };

  const handleCreateTemplate = (blueprintType: 'standard' | 'single_card' | 'warehouse_only' | 'custom') => {
    const defaultName = `New ${blueprintType.replace('_', ' ')} Template`.toUpperCase();
    const newTpl = createDefaultTemplateBlueprint(defaultName, blueprintType);
    newTpl.meta.createdBy = currentUser?.email || currentUser?.uid || 'elrico@tsjoinery.co.za';
    newTpl.meta.lastModifiedBy = currentUser?.email || currentUser?.uid || 'elrico@tsjoinery.co.za';
    setActiveTemplate(newTpl);
    if (newTpl.sections.length > 0) {
      setActiveSectionId(newTpl.sections[0].id);
    }
    announce('Initialized new template layout designer.');
  };

  const handleSave = async () => {
    if (!activeTemplate) return;
    try {
      activeTemplate.meta.lastModifiedDate = new Date().toISOString();
      activeTemplate.meta.lastModifiedBy = currentUser?.email || currentUser?.uid || 'elrico@tsjoinery.co.za';
      const docId = await saveTemplate(activeTemplate);
      announce(`Template "${activeTemplate.templateName}" saved successfully.`);
      // Refresh list
      const refreshedTemplates = await getTemplates();
      setTemplates(refreshedTemplates);
      // Update selected with id
      setActiveTemplate(prev => prev ? { ...prev, id: docId } : null);
    } catch (e) {
      console.error(e);
      announce('Failed to save template layout configuration.');
    }
  };

  const handleDuplicate = async () => {
    if (!activeTemplate) return;
    try {
      const duplicate: KanbanTemplateV2 = {
        ...JSON.parse(JSON.stringify(activeTemplate)),
        templateName: `${activeTemplate.templateName} (COPY)`,
        meta: {
          createdBy: currentUser?.email || 'unknown',
          createdDate: new Date().toISOString(),
          lastModifiedBy: currentUser?.email || 'unknown',
          lastModifiedDate: new Date().toISOString()
        }
      };
      delete duplicate.id;
      const docId = await saveTemplate(duplicate);
      announce(`Duplicated template into "${duplicate.templateName}"`);
      const refreshedTemplates = await getTemplates();
      setTemplates(refreshedTemplates);
      setActiveTemplate({ ...duplicate, id: docId });
    } catch (e) {
      console.error(e);
      announce('Failed to duplicate template.');
    }
  };

  const handleDelete = async () => {
    if (!activeTemplate || !activeTemplate.id) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${activeTemplate.templateName}"?`)) return;

    try {
      await deleteTemplate(activeTemplate.id);
      announce('Template layout deleted.');
      const refreshedTemplates = await getTemplates();
      setTemplates(refreshedTemplates);
      setActiveTemplate(null);
    } catch (e) {
      console.error(e);
      announce('Failed to delete template.');
    }
  };

  const updateSectionProperty = (sectionId: string, propertyKey: keyof KanbanSectionConfig, value: any) => {
    if (!activeTemplate) return;
    setActiveTemplate(prev => {
      if (!prev) return null;
      const updatedSections = prev.sections.map(sec => {
        if (sec.id === sectionId) {
          return { ...sec, [propertyKey]: value };
        }
        return sec;
      });
      return { ...prev, sections: updatedSections };
    });
  };

  const handleSectionDragStop = (sectionId: string, x: number, y: number) => {
    updateSectionProperty(sectionId, 'x', pxToMm(x));
    updateSectionProperty(sectionId, 'y', pxToMm(y));
  };

  const handleSectionResizeStop = (sectionId: string, width: number, height: number, x: number, y: number) => {
    updateSectionProperty(sectionId, 'width', pxToMm(width));
    updateSectionProperty(sectionId, 'height', pxToMm(height));
    updateSectionProperty(sectionId, 'x', pxToMm(x));
    updateSectionProperty(sectionId, 'y', pxToMm(y));
  };

  // Renders the actual preview card inside the designer viewport canvas
  const renderSectionContent = (sec: KanbanSectionConfig) => {
    const scaleFactorFont = sec.height / 60; // relative scale
    switch (sec.id) {
      case 'master_info':
        return (
          <MasterInformation
            cardData={selectedCard}
            borderWidth={0}
            borderStyle="none"
            backgroundColor="transparent"
            cornerRadius={0}
            padding={sec.padding}
            fontSizeScale={scaleFactorFont}
          />
        );
      case 'kanban_pulled':
        return (
          <KanbanPulled
            cardData={selectedCard}
            borderWidth={0}
            borderStyle="none"
            backgroundColor="transparent"
            cornerRadius={0}
            padding={sec.padding}
            fontSizeScale={scaleFactorFont}
          />
        );
      case 'warehouse_id':
        return (
          <WarehouseIdentification
            cardData={selectedCard}
            borderWidth={0}
            borderStyle="none"
            backgroundColor="transparent"
            cornerRadius={0}
            padding={sec.padding}
            fontSizeScale={scaleFactorFont}
          />
        );
      case 'warehouse_display':
        return (
          <WarehouseDisplay
            cardData={selectedCard}
            borderWidth={0}
            borderStyle="none"
            backgroundColor="transparent"
            cornerRadius={0}
            padding={sec.padding}
            fontSizeScale={scaleFactorFont}
          />
        );
      default:
        return (
          <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400 italic">
            Unknown Section
          </div>
        );
    }
  };

  const activeSection = activeTemplate?.sections.find(s => s.id === activeSectionId);

  return (
    <div className="h-full flex bg-[#0c0c0c] text-white overflow-hidden font-sans">
      {/* 1. Sidebar Panel: List of saved template designs */}
      <aside className={`w-80 bg-[#121212] border-r border-white/10 flex flex-col shrink-0 transition-all duration-300 ${isSidebarOpen ? 'ml-0' : '-ml-80'}`}>
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40">
          <h2 className="text-sm font-black uppercase tracking-widest text-orange-400 flex items-center gap-2">
            <Icon name="layout-template" size={16} /> Kanban Templates
          </h2>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <Icon name="chevron-left" size={16} />
          </button>
        </div>

        {/* Action: Create New blueprint templates dropdown */}
        <div className="p-4 border-b border-white/5 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Initialize New Layout</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleCreateTemplate('standard')}
              className="py-2 px-3 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider text-purple-400 text-left transition-all"
            >
              Standard A4
            </button>
            <button
              onClick={() => handleCreateTemplate('single_card')}
              className="py-2 px-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider text-blue-400 text-left transition-all"
            >
              Single Card
            </button>
            <button
              onClick={() => handleCreateTemplate('warehouse_only')}
              className="py-2 px-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider text-emerald-400 text-left transition-all"
            >
              Warehouse Bay
            </button>
            <button
              onClick={() => handleCreateTemplate('custom')}
              className="py-2 px-3 bg-yellow-600/10 hover:bg-yellow-600/20 border border-yellow-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider text-yellow-400 text-left transition-all"
            >
              Blank Custom
            </button>
          </div>
        </div>

        {/* Templates list view */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5">
          {loading ? (
            <div className="text-center py-20 text-xs text-gray-500">
              <Icon name="loader" size={24} className="animate-spin mx-auto mb-2 text-purple-500" />
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Icon name="folder-open" size={32} className="mx-auto opacity-40 mb-3" />
              <p className="text-[10px] font-black uppercase">No templates found</p>
              <p className="text-[9px] mt-1 max-w-[180px] mx-auto text-gray-600">Choose a default blueprint option from the menu above to build your very first layout.</p>
            </div>
          ) : (
            templates.map(t => (
              <div
                key={t.id}
                onClick={() => handleSelectTemplate(t)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  activeTemplate?.id === t.id
                    ? 'bg-purple-600/10 border-purple-500'
                    : 'bg-black/35 border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-extrabold text-white text-xs leading-tight tracking-tight uppercase truncate max-w-[180px]">
                    {t.templateName}
                  </h3>
                  <span className="text-[8px] font-mono font-bold bg-white/5 text-gray-400 px-1.5 py-0.5 rounded uppercase">
                    {t.paperSize}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <Icon name="layout" size={10} /> {t.sections.filter(s => s.visible).length} visible
                  </span>
                  <span className="flex items-center gap-1 font-mono uppercase">
                    {t.orientation}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Toggle Sidebar handle if closed */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed left-4 top-20 z-50 p-2 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl text-white shadow-xl transition-all"
        >
          <Icon name="chevron-right" size={20} />
        </button>
      )}

      {/* 2. Main Canvas Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Dynamic Editor Header Controls */}
        <div className="h-16 border-b border-white/10 px-6 flex justify-between items-center bg-[#101010]">
          {activeTemplate ? (
            <div className="flex items-center gap-3 w-full justify-between">
              <div className="flex items-center gap-3 max-w-sm flex-1">
                <input
                  type="text"
                  value={activeTemplate.templateName}
                  onChange={(e) => setActiveTemplate({ ...activeTemplate, templateName: e.target.value })}
                  placeholder="ENTER TEMPLATE NAME..."
                  className="bg-black/50 text-white font-black uppercase text-xs tracking-wider px-3 py-2 rounded-xl border border-white/15 focus:outline-none focus:border-purple-500 w-full"
                />
              </div>

              {/* Sample test card data selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Sample Card Data:</span>
                <select
                  value={selectedCard.kanbanId}
                  onChange={(e) => {
                    const matched = cardsList.find(c => c.kanbanId === e.target.value);
                    if (matched) setSelectedCard(matched);
                  }}
                  className="bg-black text-white border border-white/15 px-3 py-1.5 rounded-xl text-xs font-bold uppercase focus:outline-none"
                >
                  {cardsList.map(c => (
                    <option key={c.kanbanId} value={c.kanbanId}>
                      {c.kanbanId} - {c.productDescription.substring(0, 20)}...
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Toolbar */}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all flex items-center gap-1.5"
                >
                  <Icon name="save" size={13} /> Save Layout
                </button>
                <button
                  onClick={handleDuplicate}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all flex items-center gap-1.5"
                >
                  <Icon name="copy" size={13} /> Duplicate
                </button>
                {activeTemplate.id && (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 rounded-xl text-xs font-black uppercase text-red-500 transition-all flex items-center gap-1.5"
                  >
                    <Icon name="trash" size={13} /> Delete
                  </button>
                )}
                <button
                  onClick={() => onPrintPreview(activeTemplate, selectedCard)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all flex items-center gap-1.5"
                >
                  <Icon name="printer" size={13} /> PDF Print
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-xs font-bold uppercase flex items-center gap-2">
              <Icon name="layers" size={16} /> Kanban Template Workshop
            </div>
          )}
        </div>

        {/* Interactive Workspace Area */}
        <div className="flex-1 flex overflow-hidden">
          {activeTemplate ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto select-none relative custom-scrollbar bg-[#0f0f0f]">
              <div className="mb-4 text-center">
                <span className="px-3 py-1 bg-purple-500/15 text-purple-400 border border-purple-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                  📐 {activeTemplate.paperSize} Portrait Design Workspace (210mm × 297mm)
                </span>
                <p className="text-[10px] text-gray-500 mt-2">
                  Click on any section to customize properties, drag to move, or stretch edges to resize inside margins.
                </p>
              </div>

              {/* A4 Canvas Representation Sheet */}
              <div
                className="relative bg-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] border border-neutral-300 overflow-hidden"
                style={{
                  width: `${canvasWidthPx}px`,
                  height: `${canvasHeightPx}px`
                }}
              >
                {/* Visual guideline mesh background */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                  backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
                  backgroundSize: '10px 10px'
                }} />

                {/* Margins Border Frame */}
                <div 
                  className="absolute border border-dashed border-neutral-300 pointer-events-none flex justify-between p-1"
                  style={{
                    left: `${mmToPx(activeTemplate.margins)}px`,
                    right: `${mmToPx(activeTemplate.margins)}px`,
                    top: `${mmToPx(activeTemplate.margins)}px`,
                    bottom: `${mmToPx(activeTemplate.margins)}px`
                  }}
                >
                  <span className="text-[6px] text-gray-400 font-mono tracking-wider">PRINTABLE MARGIN ({activeTemplate.margins}mm)</span>
                  <span className="text-[6px] text-gray-400 font-mono tracking-wider">A4 Portrait Canvas</span>
                </div>

                {/* Render sections as RND elements */}
                {activeTemplate.sections.map(sec => {
                  if (!sec.visible) return null;

                  const isSelected = activeSectionId === sec.id;
                  const borderStyleClass = sec.borderStyle !== 'none' 
                    ? `border-${sec.borderWidth} ${sec.borderStyle}` 
                    : 'border-none';

                  return (
                    <Rnd
                      key={sec.id}
                      size={{
                        width: mmToPx(sec.width),
                        height: mmToPx(sec.height)
                      }}
                      position={{
                        x: mmToPx(sec.x),
                        y: mmToPx(sec.y)
                      }}
                      bounds="parent"
                      onDragStop={(e, d) => handleSectionDragStop(sec.id, d.x, d.y)}
                      onResizeStop={(e, direction, ref, delta, position) => {
                        handleSectionResizeStop(
                          sec.id,
                          parseInt(ref.style.width, 10),
                          parseInt(ref.style.height, 10),
                          position.x,
                          position.y
                        );
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSectionId(sec.id);
                      }}
                      className={`transition-all duration-150 backdrop-blur-[1px] flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing ${
                        isSelected
                          ? 'ring-4 ring-offset-2 ring-purple-600 shadow-2xl z-40 scale-[1.005]'
                          : 'z-20 hover:scale-[1.002] border border-transparent hover:border-purple-400/50'
                      }`}
                      style={{
                        borderRadius: `${sec.cornerRadius}mm`,
                        zIndex: sec.zIndex,
                        transform: `rotate(${sec.rotation || 0}deg)`
                      }}
                    >
                      {/* Interactive Card Section Outer Component wrapper */}
                      <div className="w-full h-full relative group">
                        {renderSectionContent(sec)}

                        {/* Interactive overlay layer to indicate section label and bounds inside designer */}
                        <div className={`absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-start p-1.5`}>
                          <span className="text-[8px] font-black uppercase tracking-wider text-black bg-white/90 border border-neutral-300 px-2 py-0.5 rounded shadow">
                            {sec.name} ({sec.width}x{sec.height}mm)
                          </span>
                        </div>
                      </div>
                    </Rnd>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#0c0c0c] text-center p-8 select-none">
              <div className="space-y-4 max-w-sm">
                <div className="p-4 bg-purple-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-purple-500/20">
                  <Icon name="layout-template" size={32} className="text-purple-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-gray-300 font-black uppercase tracking-widest text-sm">Kanban Template Designer</p>
                  <p className="text-xs text-gray-500 font-sans">
                    Select an existing template from the sidebar layout list, or choose a blueprint layout to create a fresh new design.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. Right Sidebar Panel: Selected Section Layout and Styling properties */}
          {activeTemplate && activeSection && (
            <aside className="w-80 bg-[#121212] border-l border-white/10 flex flex-col overflow-y-auto custom-scrollbar p-5 space-y-6">
              
              {/* Template Global Options */}
              <div className="space-y-4 pb-4 border-b border-white/5">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-400 flex items-center gap-1.5">
                  <Icon name="sliders" size={12} /> Paper Layout
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">Paper Size</label>
                    <select
                      value={activeTemplate.paperSize}
                      onChange={(e) => setActiveTemplate({ ...activeTemplate, paperSize: e.target.value as any })}
                      className="w-full bg-black text-white text-xs px-2.5 py-1.5 border border-white/10 rounded-xl focus:outline-none"
                    >
                      <option value="A4">A4 Portrait</option>
                      <option value="A5">A5</option>
                      <option value="A6">A6</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">Orientation</label>
                    <select
                      value={activeTemplate.orientation}
                      onChange={(e) => setActiveTemplate({ ...activeTemplate, orientation: e.target.value as any })}
                      className="w-full bg-black text-white text-xs px-2.5 py-1.5 border border-white/10 rounded-xl focus:outline-none"
                    >
                      <option value="Portrait">Portrait</option>
                      <option value="Landscape">Landscape</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase flex justify-between">
                    <span>Print Margins (mm)</span>
                    <span className="font-mono text-purple-400 font-bold">{activeTemplate.margins}mm</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={activeTemplate.margins}
                    onChange={(e) => setActiveTemplate({ ...activeTemplate, margins: parseInt(e.target.value, 10) })}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>

              {/* Specific Section Layout properties */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                    <Icon name="layers" size={12} /> Section Settings
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="section-visible"
                      checked={activeSection.visible}
                      onChange={(e) => updateSectionProperty(activeSectionId, 'visible', e.target.checked)}
                      className="w-3.5 h-3.5 accent-purple-600 rounded bg-black border border-white/10"
                    />
                    <label htmlFor="section-visible" className="text-[10px] text-gray-400 uppercase font-black cursor-pointer">Visible</label>
                  </div>
                </div>

                {/* Section selection tabs */}
                <div className="grid grid-cols-4 gap-1 bg-black/40 p-1 rounded-xl">
                  {activeTemplate.sections.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setActiveSectionId(s.id)}
                      className={`py-1 text-[8px] font-black uppercase tracking-tighter rounded-lg transition-all ${
                        activeSectionId === s.id
                          ? 'bg-purple-600 text-white shadow'
                          : 'text-gray-500 hover:text-white'
                      }`}
                      title={s.name}
                    >
                      {s.id === 'master_info' ? 'Master' : s.id === 'kanban_pulled' ? 'Pulled' : s.id === 'warehouse_id' ? 'ID' : 'Edge'}
                    </button>
                  ))}
                </div>

                <div className="bg-black/20 p-4 border border-white/5 rounded-2xl space-y-4 text-xs">
                  {/* Position coordinates inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-extrabold uppercase">Width (mm)</label>
                      <input
                        type="number"
                        min="10"
                        max="297"
                        value={activeSection.width}
                        onChange={(e) => updateSectionProperty(activeSectionId, 'width', parseInt(e.target.value, 10) || 10)}
                        className="w-full bg-black border border-white/10 px-2.5 py-1.5 rounded-xl text-white font-mono text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-extrabold uppercase">Height (mm)</label>
                      <input
                        type="number"
                        min="10"
                        max="297"
                        value={activeSection.height}
                        onChange={(e) => updateSectionProperty(activeSectionId, 'height', parseInt(e.target.value, 10) || 10)}
                        className="w-full bg-black border border-white/10 px-2.5 py-1.5 rounded-xl text-white font-mono text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-extrabold uppercase">Position X (mm)</label>
                      <input
                        type="number"
                        min="0"
                        max="210"
                        value={activeSection.x}
                        onChange={(e) => updateSectionProperty(activeSectionId, 'x', parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-black border border-white/10 px-2.5 py-1.5 rounded-xl text-white font-mono text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-extrabold uppercase">Position Y (mm)</label>
                      <input
                        type="number"
                        min="0"
                        max="297"
                        value={activeSection.y}
                        onChange={(e) => updateSectionProperty(activeSectionId, 'y', parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-black border border-white/10 px-2.5 py-1.5 rounded-xl text-white font-mono text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  {/* Aesthetic and spacing options */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-extrabold uppercase flex justify-between">
                      <span>Inner Padding (mm)</span>
                      <span className="font-mono text-purple-400 font-bold">{activeSection.padding}mm</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="1"
                      value={activeSection.padding}
                      onChange={(e) => updateSectionProperty(activeSectionId, 'padding', parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-extrabold uppercase flex justify-between">
                      <span>Corner Radius (mm)</span>
                      <span className="font-mono text-purple-400 font-bold">{activeSection.cornerRadius}mm</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={activeSection.cornerRadius}
                      onChange={(e) => updateSectionProperty(activeSectionId, 'cornerRadius', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-extrabold uppercase flex justify-between">
                      <span>Border Width (mm)</span>
                      <span className="font-mono text-purple-400 font-bold">{activeSection.borderWidth}mm</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.25"
                      value={activeSection.borderWidth}
                      onChange={(e) => updateSectionProperty(activeSectionId, 'borderWidth', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-extrabold uppercase">Border Style</label>
                      <select
                        value={activeSection.borderStyle}
                        onChange={(e) => updateSectionProperty(activeSectionId, 'borderStyle', e.target.value)}
                        className="w-full bg-black text-white text-xs px-2.5 py-1.5 border border-white/10 rounded-xl focus:outline-none"
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-extrabold uppercase">Rotation (°)</label>
                      <input
                        type="number"
                        min="0"
                        max="360"
                        value={activeSection.rotation || 0}
                        onChange={(e) => updateSectionProperty(activeSectionId, 'rotation', parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-black border border-white/10 px-2.5 py-1.5 rounded-xl text-white font-mono text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-extrabold uppercase">BG Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={activeSection.backgroundColor}
                          onChange={(e) => updateSectionProperty(activeSectionId, 'backgroundColor', e.target.value)}
                          className="w-8 h-8 rounded-lg overflow-hidden bg-transparent cursor-pointer border border-white/15"
                        />
                        <input
                          type="text"
                          value={activeSection.backgroundColor}
                          onChange={(e) => updateSectionProperty(activeSectionId, 'backgroundColor', e.target.value)}
                          className="w-full bg-black text-white font-mono text-center text-xs border border-white/10 px-1 rounded-xl focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-extrabold uppercase">Border Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={activeSection.borderColor}
                          onChange={(e) => updateSectionProperty(activeSectionId, 'borderColor', e.target.value)}
                          className="w-8 h-8 rounded-lg overflow-hidden bg-transparent cursor-pointer border border-white/15"
                        />
                        <input
                          type="text"
                          value={activeSection.borderColor}
                          onChange={(e) => updateSectionProperty(activeSectionId, 'borderColor', e.target.value)}
                          className="w-full bg-black text-white font-mono text-center text-xs border border-white/10 px-1 rounded-xl focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};
