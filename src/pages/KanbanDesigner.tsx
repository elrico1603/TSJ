import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import { Icon } from '../components/Icon';
import { 
  KanbanTemplateV2, 
  KanbanSectionConfig, 
  getTemplates, 
  saveTemplate, 
  deleteTemplate, 
  createDefaultTemplateBlueprint,
  TextCustomizationSettings
} from '../services/templateService';
import { applyTextSettings, AVAILABLE_FONTS, SECTION_TEXT_ELEMENTS } from '../utils/textStyleHelper';
import { KanbanCardMaster, getKanbanMailtoQRCodeUrl, generateNextKanbanNumber } from '../services/kanbanService';
import { productMasterService } from '../services/productMasterService';
import { MasterInformation as MasterInfoType, ProductMaster } from '../types';
import { MasterInformation } from '../components/MasterInformation';
import { KanbanPulled } from '../components/KanbanPulled';
import { WarehouseIdentification } from '../components/WarehouseIdentification';
import { renderSectionContent as renderSharedSectionContent } from '../components/KanbanCardCanvas';
import { QRCodeRenderer } from '../components/QRCodeRenderer';

interface KanbanDesignerProps {
  currentUser: any;
  announce: (message: string) => void;
  onPrintPreview: (template: KanbanTemplateV2, sampleCard: KanbanCardMaster, masterInfo?: MasterInfoType) => void;
}

export const KanbanDesigner: React.FC<KanbanDesignerProps> = ({
  currentUser,
  announce,
  onPrintPreview
}) => {
  const [templates, setTemplates] = useState<KanbanTemplateV2[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<KanbanTemplateV2 | null>(null);
  const [productMasters, setProductMasters] = useState<ProductMaster[]>([]);
  const [selectedProductMaster, setSelectedProductMaster] = useState<ProductMaster | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string>('master_info');
  const [loading, setLoading] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Right sidebar panel triple tabs
  const [rightActiveTab, setRightActiveTab] = useState<'master' | 'layout' | 'typography'>('master');
  const [selectedTextElementId, setSelectedTextElementId] = useState<string>('');

  const [customMasterInfo, setCustomMasterInfo] = useState<Partial<MasterInfoType>>({});

  const handleUpdateMasterInfo = (key: keyof MasterInfoType, value: any) => {
    setCustomMasterInfo(prev => ({ ...prev, [key]: value }));
    if (activeTemplate) {
      setActiveTemplate(prev => {
        if (!prev) return null;
        const updated = { ...prev };
        if (key === 'internalProductNumber') updated.kanbanId = value;
        else if (key === 'templateName') updated.templateName = value;
        else if (key === 'templateType') updated.paperSize = value as any;
        else if (key === 'productName') updated.productName = value;
        else if (key === 'supplier') updated.supplier = value;
        else if (key === 'supplierPartNumber') updated.supplierPartNumber = value;
        else if (key === 'orderQuantity') updated.orderQuantity = value;
        else if (key === 'deliveryTime') updated.deliveryTime = value;
        else if (key === 'location') updated.location = value;
        else if (key === 'locationColour') updated.locationColour = value;
        else if (key === 'binQuantity') updated.binQuantity = value;
        return updated;
      });
    }
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        handleUpdateMasterInfo('productImage', result);
        announce('Uploaded product image successfully.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCrop = () => {
    if (!cropImageSrc || !cropCanvasRef.current) return;
    const canvas = cropCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx.clearRect(0, 0, 300, 300);
      ctx.save();
      ctx.translate(150 + cropPanX, 150 + cropPanY);
      ctx.rotate((cropRotation * Math.PI) / 180);
      ctx.scale(cropZoom, cropZoom);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      const croppedDataUrl = canvas.toDataURL('image/png');
      handleUpdateMasterInfo('productImage', croppedDataUrl);
      setIsCropModalOpen(false);
      announce('Applied cropped image to master product specification.');
    };
    img.src = cropImageSrc;
  };

  // Unified Master Information single source of truth state derived from activeTemplate, customMasterInfo, or selected Product Master
  const masterInfo: MasterInfoType = useMemo(() => {
    let base: MasterInfoType;
    const currentKanbanId = 
      activeTemplate?.kanbanId || 
      customMasterInfo.internalProductNumber || 
      selectedProductMaster?.internalProductCode || 
      '';

    const getVal = (
      tplVal: string | undefined,
      customVal: string | undefined,
      prodVal: string | undefined,
      defaultVal: string
    ) => {
      if (tplVal !== undefined && tplVal !== '') return tplVal;
      if (customVal !== undefined && customVal !== '') return customVal;
      if (prodVal !== undefined && prodVal !== '') return prodVal;
      return defaultVal;
    };

    const productName = getVal(activeTemplate?.productName, customMasterInfo.productName, selectedProductMaster?.productName, 'Sample Product');
    const supplier = getVal(activeTemplate?.supplier, customMasterInfo.supplier, selectedProductMaster?.supplier, 'Sample Supplier');
    const supplierPartNumber = getVal(activeTemplate?.supplierPartNumber, customMasterInfo.supplierPartNumber, selectedProductMaster?.supplierPartNumber, 'ABC-123');

    const prodQtyStr = selectedProductMaster?.orderQuantity 
      ? `${selectedProductMaster.orderQuantity} ${selectedProductMaster.unit || ''}`.trim() 
      : undefined;
    const orderQuantity = getVal(activeTemplate?.orderQuantity, customMasterInfo.orderQuantity, prodQtyStr, '100');

    const deliveryTime = getVal(activeTemplate?.deliveryTime, customMasterInfo.deliveryTime, selectedProductMaster?.deliveryTime, '3 Days');
    const location = getVal(activeTemplate?.location, customMasterInfo.location, selectedProductMaster?.location, 'A-01-B-01');
    const locationColour = getVal(activeTemplate?.locationColour, customMasterInfo.locationColour, selectedProductMaster?.locationColour, 'GREEN');

    const prodBinStr = selectedProductMaster?.minimumStock 
      ? `${selectedProductMaster.minimumStock} Min` 
      : undefined;
    const binQuantity = getVal(activeTemplate?.binQuantity, customMasterInfo.binQuantity, prodBinStr, '100');

    const qrUrl = getKanbanMailtoQRCodeUrl({
      internalProductNumber: currentKanbanId,
      productName,
      supplierPartNumber,
      supplier,
      orderQuantity,
      binQuantity,
      location,
      deliveryTime
    });

    base = {
      productName,
      supplier,
      supplierPartNumber,
      orderQuantity,
      deliveryTime,
      location,
      locationColour,
      internalProductNumber: currentKanbanId,
      productImage: selectedProductMaster?.productImage || 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=200',
      qrCode: qrUrl,
      templateName: activeTemplate?.templateName || '',
      templateType: activeTemplate?.paperSize || 'A4',
      binQuantity,
      cardColour: selectedProductMaster?.cardColour || '#ffffff',
      status: selectedProductMaster ? (selectedProductMaster.status === 'Active' ? 'ACTIVE' : 'INACTIVE') : 'ACTIVE'
    };

    const merged = { ...base, ...customMasterInfo };
    const finalKanbanId = activeTemplate?.kanbanId || merged.internalProductNumber || currentKanbanId;

    const currentQr = getKanbanMailtoQRCodeUrl({
      internalProductNumber: finalKanbanId,
      productName: merged.productName || 'Sample Product',
      supplierPartNumber: merged.supplierPartNumber || 'ABC-123',
      supplier: merged.supplier || 'Sample Supplier',
      orderQuantity: merged.orderQuantity || '100',
      binQuantity: merged.binQuantity || '100',
      location: merged.location || 'A-01-B-01',
      deliveryTime: merged.deliveryTime || '3 Days'
    });

    return { ...merged, internalProductNumber: finalKanbanId, qrCode: currentQr };
  }, [
    selectedProductMaster,
    activeTemplate?.kanbanId,
    activeTemplate?.templateName,
    activeTemplate?.paperSize,
    activeTemplate?.productName,
    activeTemplate?.supplier,
    activeTemplate?.supplierPartNumber,
    activeTemplate?.orderQuantity,
    activeTemplate?.deliveryTime,
    activeTemplate?.location,
    activeTemplate?.locationColour,
    activeTemplate?.binQuantity,
    customMasterInfo
  ]);

  const selectedCard: KanbanCardMaster = useMemo(() => {
    let letter = 'A';
    let number = '01-B-01';
    if (masterInfo.location) {
      const parts = masterInfo.location.split('-');
      if (parts.length > 1) {
        letter = parts[0];
        number = parts.slice(1).join('-');
      } else {
        letter = masterInfo.location.charAt(0);
        number = masterInfo.location.substring(1);
      }
    }

    return {
      kanbanId: masterInfo.internalProductNumber,
      productDescription: masterInfo.productName,
      imageUrl: masterInfo.productImage || '',
      supplierPartNumber: masterInfo.supplierPartNumber,
      supplierName: masterInfo.supplier,
      orderQuantity: masterInfo.orderQuantity,
      binQuantity: masterInfo.binQuantity || '100',
      deliveryTime: masterInfo.deliveryTime,
      location: {
        letter,
        number,
        colour: masterInfo.locationColour || 'GREEN'
      },
      qrCodeUrl: masterInfo.qrCode || '',
      activeTemplateId: activeTemplate?.id || '',
      createdDate: new Date().toISOString(),
      createdBy: 'System',
      lastModifiedDate: new Date().toISOString(),
      lastModifiedBy: 'System',
      status: 'ACTIVE'
    };
  }, [masterInfo, activeTemplate?.id]);

  // Sliders-based image cropping and preview overlay state variables
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string>('');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPanX, setCropPanX] = useState(0);
  const [cropPanY, setCropPanY] = useState(0);
  const [cropRotation, setCropRotation] = useState(0);

  // Save template dialog states
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveProductName, setSaveProductName] = useState('');
  const [saveCategory, setSaveCategory] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  // Search and Recent Searches states
  const [searchTerm, setSearchTerm] = useState('');
  const [recentSearches, setRecentSearches] = useState<{ templateId: string; templateName: string; query: string }[]>(() => {
    try {
      const stored = localStorage.getItem('recent_searches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Collapsed folders state (default is expanded, so we store collapsed status)
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Hidden references for the canvas crop generation
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cropCanvasRef = React.useRef<HTMLCanvasElement>(null);

  // A4 layout dimensions & scaling factor calculations
  const canvasHeightPx = 680; // height inside editor
  const canvasWidthPx = Math.round(canvasHeightPx * (210 / 297)); // A4 Aspect ratio (~481px)
  const scaleFactor = canvasHeightPx / 297; // scale factor pixels per mm

  const mmToPx = (mm: number) => Math.round(mm * scaleFactor);
  const pxToMm = (px: number) => Math.round(px / scaleFactor);

  // Zoom & Pan state variables
  const ZOOM_LEVELS = [25, 50, 75, 100, 125, 150, 200, 300];
  const [zoom, setZoom] = useState<number>(() => {
    const saved = localStorage.getItem('kanban_designer_zoom');
    return saved ? parseInt(saved, 10) : 100;
  });

  useEffect(() => {
    localStorage.setItem('kanban_designer_zoom', zoom.toString());
  }, [zoom]);

  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  // Fit Page function
  const handleFitPage = () => {
    if (!workspaceRef.current) return;
    const viewportWidth = workspaceRef.current.clientWidth - 64; // subtract padding
    const viewportHeight = workspaceRef.current.clientHeight - 160; // subtract padding and header info
    const scaleX = viewportWidth / canvasWidthPx;
    const scaleY = viewportHeight / canvasHeightPx;
    const fitScale = Math.min(scaleX, scaleY) * 100;
    
    // Find closest zoom level, or round to closest integer
    setZoom(Math.max(25, Math.min(300, Math.round(fitScale))));
  };

  // Wheel zooming and middle-click panning listeners
  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;

    const handleWheelNative = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setZoom(currentZoom => {
          const idx = ZOOM_LEVELS.indexOf(currentZoom);
          if (e.deltaY < 0) {
            if (idx < ZOOM_LEVELS.length - 1) {
              return ZOOM_LEVELS[idx + 1];
            } else if (idx === -1) {
              const next = ZOOM_LEVELS.find(z => z > currentZoom);
              return next || currentZoom;
            }
          } else {
            if (idx > 0) {
              return ZOOM_LEVELS[idx - 1];
            } else if (idx === -1) {
              const prev = [...ZOOM_LEVELS].reverse().find(z => z < currentZoom);
              return prev || currentZoom;
            }
          }
          return currentZoom;
        });
      }
    };

    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1) { // Middle Mouse Button
      e.preventDefault();
      setIsPanning(true);
      if (workspaceRef.current) {
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: workspaceRef.current.scrollLeft,
          scrollTop: workspaceRef.current.scrollTop
        };
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !workspaceRef.current) return;
    e.preventDefault();
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    workspaceRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
    workspaceRef.current.scrollTop = panStartRef.current.scrollTop - dy;
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1) {
      setIsPanning(false);
    }
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  // Load templates and product masters on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedTemplates, fetchedProducts] = await Promise.all([
        getTemplates(),
        productMasterService.getProducts()
      ]);
      setTemplates(fetchedTemplates);
      setProductMasters(fetchedProducts || []);
    } catch (error) {
      console.error('Failed to load designer context:', error);
      announce('Failed to load database. Loading default layout context.');
    } finally {
      setLoading(false);
    }
  };

  const recordRecentSearch = (templateId: string, templateName: string, queryText: string) => {
    if (!templateId) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item.templateId !== templateId);
      const newQuery = queryText.trim() || templateName;
      const updated = [{ templateId, templateName, query: newQuery }, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('recent_searches', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to write recent searches to localStorage:', err);
      }
      return updated;
    });
  };

  const handleSelectTemplate = (tpl: KanbanTemplateV2) => {
    const cloned: KanbanTemplateV2 = JSON.parse(JSON.stringify(tpl));
    if (!cloned.kanbanId) {
      cloned.kanbanId = generateNextKanbanNumber();
      saveTemplate(cloned).catch(console.error);
    }
    setActiveTemplate(cloned);
    setCustomMasterInfo({
      internalProductNumber: cloned.kanbanId,
      orderQuantity: cloned.orderQuantity || '',
      deliveryTime: cloned.deliveryTime || '',
      location: cloned.location || '',
      locationColour: cloned.locationColour || '',
      binQuantity: cloned.binQuantity || '',
      supplier: cloned.supplier || '',
      supplierPartNumber: cloned.supplierPartNumber || '',
      productName: cloned.productName || ''
    });
    // Auto focus first section
    if (tpl.sections && tpl.sections.length > 0) {
      setActiveSectionId(tpl.sections[0].id);
    }
    announce(`Loaded layout "${tpl.templateName}"`);
    recordRecentSearch(tpl.id || '', tpl.templateName, searchTerm);
  };

  const handleCreateTemplate = (blueprintType: 'standard' | 'single_card' | 'warehouse_only' | 'custom') => {
    const defaultName = `New ${blueprintType.replace('_', ' ')} Template`.toUpperCase();
    const newTpl = createDefaultTemplateBlueprint(defaultName, blueprintType);
    newTpl.meta.createdBy = currentUser?.email || currentUser?.uid || 'elrico@tsjoinery.co.za';
    newTpl.meta.lastModifiedBy = currentUser?.email || currentUser?.uid || 'elrico@tsjoinery.co.za';

    const nextKanbanId = generateNextKanbanNumber();
    newTpl.kanbanId = nextKanbanId;

    setActiveTemplate(newTpl);
    setCustomMasterInfo({ internalProductNumber: nextKanbanId });

    if (newTpl.sections.length > 0) {
      setActiveSectionId(newTpl.sections[0].id);
    }
    announce('Initialized new template layout designer.');
  };

  const handleSave = () => {
    if (!activeTemplate) return;
    setSaveTemplateName(activeTemplate.templateName || '');
    setSaveProductName(activeTemplate.productName || masterInfo?.productName || '');
    setSaveCategory(activeTemplate.category || '');
    setSaveDescription(activeTemplate.description || '');
    setIsSaveDialogOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!activeTemplate) return;
    if (!saveTemplateName.trim()) {
      announce('Template Name is required.');
      return;
    }
    if (!saveProductName.trim()) {
      announce('Product Name is required.');
      return;
    }
    if (!saveCategory.trim()) {
      announce('Category is required.');
      return;
    }

    try {
      const kanbanIdToSave = activeTemplate.kanbanId || customMasterInfo.internalProductNumber || generateNextKanbanNumber();

      const updatedTemplate: KanbanTemplateV2 = {
        ...activeTemplate,
        kanbanId: kanbanIdToSave,
        templateName: saveTemplateName.trim().toUpperCase(),
        productName: saveProductName.trim(),
        category: saveCategory.trim(),
        description: saveDescription.trim(),
        supplier: masterInfo?.supplier || '',
        supplierPartNumber: masterInfo?.supplierPartNumber || '',
        orderQuantity: masterInfo?.orderQuantity || '',
        deliveryTime: masterInfo?.deliveryTime || '',
        location: masterInfo?.location || '',
        locationColour: masterInfo?.locationColour || '',
        binQuantity: masterInfo?.binQuantity || '',
        meta: {
          ...activeTemplate.meta,
          lastModifiedDate: new Date().toISOString(),
          lastModifiedBy: currentUser?.email || currentUser?.uid || 'elrico@tsjoinery.co.za'
        }
      };

      const docId = await saveTemplate(updatedTemplate);
      announce(`Template "${updatedTemplate.templateName}" saved successfully.`);
      setIsSaveDialogOpen(false);

      // Refresh list
      const refreshedTemplates = await getTemplates();
      setTemplates(refreshedTemplates);

      // Update active template
      setActiveTemplate({ ...updatedTemplate, id: docId });
      setCustomMasterInfo(prev => ({ ...prev, internalProductNumber: kanbanIdToSave }));
    } catch (e) {
      console.error(e);
      announce('Failed to save template layout configuration.');
    }
  };

  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [duplicateProductName, setDuplicateProductName] = useState('');

  const handleDuplicate = () => {
    if (!activeTemplate) return;
    setDuplicateProductName(`${activeTemplate.productName || activeTemplate.templateName} (COPY)`);
    setIsDuplicateDialogOpen(true);
  };

  const handleConfirmDuplicate = async () => {
    if (!activeTemplate) return;
    if (!duplicateProductName.trim()) {
      announce('Product name is required.');
      return;
    }

    try {
      const nextKanbanId = generateNextKanbanNumber();

      const newTemplateName = `${duplicateProductName.trim().toUpperCase()} TEMPLATE`;
      const duplicate: KanbanTemplateV2 = {
        ...JSON.parse(JSON.stringify(activeTemplate)),
        kanbanId: nextKanbanId,
        templateName: newTemplateName,
        productName: duplicateProductName.trim(),
        meta: {
          createdBy: currentUser?.email || 'elrico@tsjoinery.co.za',
          createdDate: new Date().toISOString(),
          lastModifiedBy: currentUser?.email || 'elrico@tsjoinery.co.za',
          lastModifiedDate: new Date().toISOString()
        }
      };
      delete duplicate.id;
      
      const docId = await saveTemplate(duplicate);
      announce(`Duplicated template as "${duplicate.templateName}"`);
      setIsDuplicateDialogOpen(false);

      const refreshedTemplates = await getTemplates();
      setTemplates(refreshedTemplates);
      setActiveTemplate({ ...duplicate, id: docId });
      setCustomMasterInfo({ internalProductNumber: nextKanbanId });
    } catch (e) {
      console.error(e);
      announce('Failed to duplicate template.');
    }
  };

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const handleDelete = () => {
    if (!activeTemplate || !activeTemplate.id) return;
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!activeTemplate || !activeTemplate.id) return;
    try {
      await deleteTemplate(activeTemplate.id);
      announce('Template layout deleted.');
      setIsDeleteConfirmOpen(false);
      const refreshedTemplates = await getTemplates();
      setTemplates(refreshedTemplates);
      setActiveTemplate(null);
    } catch (e) {
      console.error(e);
      announce('Failed to delete template.');
    }
  };

  const calculateMaxQrWidth = (cardWidthMm: number, pictureWidthPx: number): number => {
    const scaleFactor = 720 / 297;
    const availableCardWidthPx = Math.round(cardWidthMm * scaleFactor);
    const pictureColWidthPx = pictureWidthPx + 8;
    const supplierMinPx = 124;
    const paddingPx = 16;
    return Math.max(0, Math.floor(availableCardWidthPx - pictureColWidthPx - supplierMinPx - paddingPx));
  };

  const updateSectionProperty = (sectionId: string, propertyKey: keyof KanbanSectionConfig, value: any) => {
    if (!activeTemplate) return;
    setActiveTemplate(prev => {
      if (!prev) return null;
      const maxPrintableWidth = 210; // A4 portrait printable width (210mm)
      let val = value;
      if (propertyKey === 'width' && typeof val === 'number') {
        val = Math.min(val, maxPrintableWidth);
      }
      const updatedSections = prev.sections.map(sec => {
        if (sec.id === sectionId) {
          let updatedSec = { ...sec, [propertyKey]: val };
          const cardWidthMm = updatedSec.width || 95;
          const picWidth = updatedSec.picture?.width ?? 110;
          const maxQr = calculateMaxQrWidth(cardWidthMm, picWidth);

          if (propertyKey === 'qr' && val) {
            updatedSec.qr = val;
          }
          return updatedSec;
        }
        return sec;
      });
      return { ...prev, sections: updatedSections };
    });
  };

  const updateTextSettingProperty = (
    sectionId: string,
    elementId: string,
    propertyKey: keyof TextCustomizationSettings,
    value: any
  ) => {
    if (!activeTemplate) return;
    setActiveTemplate(prev => {
      if (!prev) return null;
      const updatedSections = prev.sections.map(sec => {
        if (sec.id !== sectionId) return sec;
        const currentTextSettings = sec.textSettings || {};
        const elementSettings = currentTextSettings[elementId] || {};
        return {
          ...sec,
          textSettings: {
            ...currentTextSettings,
            [elementId]: {
              ...elementSettings,
              [propertyKey]: value
            }
          }
        };
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
    return renderSharedSectionContent(sec, masterInfo, selectedCard) || (
      <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400 italic">
        Unknown Section
      </div>
    );
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

        {/* Search & Recent Searches Panel */}
        <div className="p-4 border-b border-white/5 space-y-3 bg-black/20 shrink-0">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
              <Icon name="search" size={14} />
            </span>
            <input
              type="text"
              placeholder="Search product, supplier, part #, tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-neutral-900/90 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-500 hover:text-white transition-colors"
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>

          {/* Recent Searches row */}
          {recentSearches.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-gray-500">
                <span className="flex items-center gap-1"><Icon name="history" size={10} /> RECENT SEARCHES</span>
                <button
                  onClick={() => {
                    setRecentSearches([]);
                    try {
                      localStorage.removeItem('recent_searches');
                    } catch {}
                  }}
                  className="text-[8px] text-red-400 hover:text-red-300 transition-colors uppercase font-bold"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-14 overflow-y-auto custom-scrollbar py-0.5">
                {recentSearches.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSearchTerm(item.query);
                      const found = templates.find(t => t.id === item.templateId);
                      if (found) {
                        handleSelectTemplate(found);
                      }
                    }}
                    className="px-2 py-0.5 bg-white/5 hover:bg-purple-600/25 border border-white/5 hover:border-purple-500/40 rounded-lg text-[9px] font-bold text-gray-300 hover:text-white transition-all max-w-[140px] truncate uppercase leading-tight"
                    title={`Query: "${item.query}" | Template: ${item.templateName}`}
                  >
                    {item.query}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Templates list view grouped in collapsible folders A-Z */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
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
            (() => {
              const query = searchTerm.toLowerCase().trim();
              const filtered = templates.filter(t => {
                if (!query) return true;
                const nameMatch = (t.templateName || '').toLowerCase().includes(query);
                const prodMatch = (t.productName || '').toLowerCase().includes(query);
                const suppMatch = (t.supplier || '').toLowerCase().includes(query);
                const partMatch = (t.supplierPartNumber || '').toLowerCase().includes(query);
                const catMatch = (t.category || '').toLowerCase().includes(query);
                return nameMatch || prodMatch || suppMatch || partMatch || catMatch;
              });

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-10 text-gray-500">
                    <p className="text-[10px] font-black uppercase">No match found</p>
                    <p className="text-[8px] mt-0.5 text-gray-600">Try adjusting your query fields</p>
                  </div>
                );
              }

              // Group templates by first letter of Product Name
              const groups: Record<string, KanbanTemplateV2[]> = {};
              filtered.forEach(t => {
                const nameToUse = (t.productName || t.templateName || 'Unnamed').trim();
                const firstChar = nameToUse.charAt(0).toUpperCase();
                const letter = (firstChar >= 'A' && firstChar <= 'Z') ? firstChar : '#';
                if (!groups[letter]) {
                  groups[letter] = [];
                }
                groups[letter].push(t);
              });

              // Sort folders alphabetically, with '#' folder at the end
              const sortedLetters = Object.keys(groups).sort((a, b) => {
                if (a === '#') return 1;
                if (b === '#') return -1;
                return a.localeCompare(b);
              });

              return sortedLetters.map(letter => {
                const isCollapsed = collapsedFolders[letter] || false;
                const groupTemplates = groups[letter];
                return (
                  <div key={letter} className="border-b border-white/5 pb-2.5">
                    <button
                      onClick={() => setCollapsedFolders(prev => ({ ...prev, [letter]: !prev[letter] }))}
                      className="w-full flex items-center justify-between py-1.5 text-gray-400 hover:text-white transition-colors"
                    >
                      <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-orange-400">
                        <Icon name={isCollapsed ? "folder" : "folder-open"} size={13} className="text-purple-400 shrink-0" />
                        Folder {letter}
                        <span className="text-[9px] text-gray-600 font-mono font-bold">({groupTemplates.length})</span>
                      </span>
                      <Icon name={isCollapsed ? "chevron-right" : "chevron-down"} size={12} className="text-gray-600 shrink-0" />
                    </button>

                    {!isCollapsed && (
                      <div className="space-y-2 mt-1.5 pl-3.5 border-l border-white/5">
                        {groupTemplates.map(t => (
                          <div
                            key={t.id}
                            onClick={() => handleSelectTemplate(t)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                              activeTemplate?.id === t.id
                                ? 'bg-purple-600/10 border-purple-500'
                                : 'bg-black/35 border-white/5 hover:border-white/15'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <h4 className="font-extrabold text-white text-[11px] leading-tight tracking-tight uppercase truncate">
                                  {t.templateName}
                                </h4>
                                {t.productName && (
                                  <p className="text-[9px] text-gray-400 font-semibold truncate uppercase tracking-tight mt-1">
                                    📦 {t.productName}
                                  </p>
                                )}
                                {t.category && (
                                  <span className="inline-block text-[8px] text-[#ff8c00] font-black uppercase tracking-widest mt-0.5 bg-orange-500/5 px-1 py-0.5 rounded border border-orange-500/10">
                                    🏷️ {t.category}
                                  </span>
                                )}
                              </div>
                              <span className="text-[8px] font-mono font-bold bg-white/5 text-gray-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                                {t.paperSize}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-500">
                              <span className="flex items-center gap-1">
                                <Icon name="layout" size={10} /> {t.sections.filter(s => s.visible).length} visible
                              </span>
                              <span className="flex items-center gap-1 font-mono uppercase text-[8px]">
                                {t.orientation}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()
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

              {/* Product Master Preview Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Product Master:</span>
                <select
                  value={selectedProductMaster?.id || ''}
                  onChange={(e) => {
                    const matched = productMasters.find(p => p.id === e.target.value);
                    setSelectedProductMaster(matched || null);
                  }}
                  className="bg-black text-white border border-white/15 px-3 py-1.5 rounded-xl text-xs font-bold uppercase focus:outline-none"
                >
                  <option value="">Default (Internal Placeholders)</option>
                  {productMasters.map(pm => (
                    <option key={pm.id} value={pm.id}>
                      {pm.internalProductCode || pm.id} - {pm.productName}
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
                  onClick={() => onPrintPreview(activeTemplate, selectedCard, masterInfo)}
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
            <div 
              ref={workspaceRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              className="flex-1 flex flex-col items-center justify-start p-8 overflow-auto select-none relative custom-scrollbar bg-[#0f0f0f]"
              style={{ cursor: isPanning ? 'grabbing' : 'default' }}
            >
              <div className="mb-4 text-center shrink-0">
                <span className="px-3 py-1 bg-purple-500/15 text-purple-400 border border-purple-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                  📐 {activeTemplate.paperSize} Portrait Design Workspace (210mm × 297mm)
                </span>
                <p className="text-[10px] text-gray-500 mt-2">
                  Click on any section to customize properties, drag to move, or stretch edges to resize inside margins.
                </p>
              </div>

              {/* Zoom Toolbar */}
              <div className="mb-6 flex items-center justify-center gap-2 bg-neutral-900 border border-white/10 px-4 py-2 rounded-2xl shadow-xl shrink-0">
                <button
                  onClick={() => {
                    const idx = ZOOM_LEVELS.indexOf(zoom);
                    if (idx > 0) setZoom(ZOOM_LEVELS[idx - 1]);
                  }}
                  disabled={zoom <= 25}
                  className="w-8 h-8 flex items-center justify-center bg-black hover:bg-white/10 text-white rounded-lg disabled:opacity-40 transition-colors text-sm font-bold"
                  title="Zoom Out"
                >
                  -
                </button>
                <span className="text-xs font-mono font-bold text-white min-w-[50px] text-center">
                  {zoom}%
                </span>
                <button
                  onClick={() => {
                    const idx = ZOOM_LEVELS.indexOf(zoom);
                    if (idx < ZOOM_LEVELS.length - 1) {
                      setZoom(ZOOM_LEVELS[idx + 1]);
                    } else if (idx === -1) {
                      const next = ZOOM_LEVELS.find(z => z > zoom);
                      if (next) setZoom(next);
                    }
                  }}
                  disabled={zoom >= 300}
                  className="w-8 h-8 flex items-center justify-center bg-black hover:bg-white/10 text-white rounded-lg disabled:opacity-40 transition-colors text-sm font-bold"
                  title="Zoom In"
                >
                  +
                </button>

                <div className="w-px h-5 bg-white/10 mx-1" />

                <button
                  onClick={handleFitPage}
                  className="px-3 py-1.5 bg-black hover:bg-white/10 text-white rounded-lg text-xs font-extrabold uppercase tracking-wider transition-colors"
                  title="Fit Page in Workspace"
                >
                  Fit Page
                </button>

                <button
                  onClick={() => setZoom(100)}
                  className="px-3 py-1.5 bg-black hover:bg-white/10 text-white rounded-lg text-xs font-extrabold uppercase tracking-wider transition-colors"
                  title="Actual Size"
                >
                  100%
                </button>
              </div>

              {/* Zoom & Pan Wrapper */}
              <div
                style={{
                  width: `${canvasWidthPx * (zoom / 100)}px`,
                  height: `${canvasHeightPx * (zoom / 100)}px`,
                  position: 'relative',
                  flexShrink: 0,
                  marginTop: 'auto',
                  marginBottom: 'auto'
                }}
              >
                {/* A4 Canvas Representation Sheet */}
                <div
                  className="absolute bg-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] border border-neutral-300 overflow-hidden"
                  style={{
                    width: `${canvasWidthPx}px`,
                    height: `${canvasHeightPx}px`,
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    left: 0,
                    top: 0
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
                      left: '0px',
                      right: '0px',
                      top: '0px',
                      bottom: '0px'
                    }}
                  >
                    <span className="text-[6px] text-gray-400 font-mono tracking-wider">PRINTABLE MARGIN (0mm)</span>
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
                        scale={zoom / 100}
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
                          setSelectedTextElementId('');
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
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#0c0c0c] text-center p-8 select-none">
              <div className="space-y-4 max-w-sm">
                <div className="p-4 bg-purple-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-purple-500/20">
                  <Icon name="layout-template" size={32} className="text-purple-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-gray-300 font-black uppercase tracking-widest text-sm">Kanban Designer</p>
                  <p className="text-xs text-gray-500 font-sans">
                    Select an existing template from the sidebar layout list, or choose a blueprint layout to create a fresh new design.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. Right Sidebar Panel: Selected Section Layout and Styling properties */}
          {activeTemplate && activeSection && (() => {
            const sectionTextElements = SECTION_TEXT_ELEMENTS[activeSection.id] || [];
            const isValidElement = selectedTextElementId && sectionTextElements.some(el => el.id === selectedTextElementId);
            const currentElementId = isValidElement ? selectedTextElementId : (sectionTextElements[0]?.id || '');

            return (
              <aside className="w-80 bg-[#121212] border-l border-white/10 flex flex-col overflow-y-auto custom-scrollbar p-5 space-y-5">
              
              {/* Triple-Tab Panel Headings */}
              <div className="grid grid-cols-3 gap-1 bg-black/60 p-1 rounded-2xl border border-white/5 shrink-0">
                <button
                  type="button"
                  onClick={() => setRightActiveTab('master')}
                  className={`py-2 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                    rightActiveTab === 'master'
                      ? 'bg-[#ff8c00] text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  📝 Master
                </button>
                <button
                  type="button"
                  onClick={() => setRightActiveTab('layout')}
                  className={`py-2 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                    rightActiveTab === 'layout'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  📐 Layout
                </button>
                <button
                  type="button"
                  onClick={() => setRightActiveTab('typography')}
                  className={`py-2 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                    rightActiveTab === 'typography'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  🔤 Text
                </button>
              </div>

              {/* TAB 1: MASTER INFORMATION EDITOR */}
              {rightActiveTab === 'master' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="pb-3 border-b border-white/5">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-[#ff8c00] flex items-center gap-1.5">
                      <Icon name="sliders" size={12} /> Master Product Entry
                    </h3>
                    <p className="text-[9px] text-gray-500 mt-1 font-sans">
                      This is the single master database record source. Changes here immediately synchronize across all Sections.
                    </p>
                  </div>

                  {/* Hidden image input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                  />

                  {/* Template Global Identity Parameters */}
                  <div className="space-y-3 bg-black/20 p-4 border border-white/5 rounded-2xl">
                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Template Properties</span>
                    
                    <div className="space-y-1.5">
                      <label className="text-[9px] text-gray-500 font-extrabold uppercase">Template Name</label>
                      <input
                        type="text"
                        value={masterInfo.templateName}
                        onChange={(e) => handleUpdateMasterInfo('templateName', e.target.value.toUpperCase())}
                        placeholder="ENTER TEMPLATE NAME..."
                        className="w-full bg-black border border-white/10 px-3 py-2 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 uppercase"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] text-gray-500 font-extrabold uppercase">Template Type</label>
                      <select
                        value={masterInfo.templateType}
                        onChange={(e) => handleUpdateMasterInfo('templateType', e.target.value)}
                        className="w-full bg-black text-white text-xs px-3 py-2 border border-white/10 rounded-xl focus:outline-none"
                      >
                        <option value="A4">A4 Portrait Design</option>
                        <option value="A5">A5 Small Design</option>
                        <option value="A6">A6 Pocket Design</option>
                        <option value="Custom">Custom Blueprint</option>
                      </select>
                    </div>
                  </div>

                  {/* Core Product Specifications */}
                  <div className="space-y-3 bg-black/20 p-4 border border-white/5 rounded-2xl">
                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Product Identification</span>

                    <div className="space-y-1.5">
                      <label className="text-[9px] text-gray-500 font-extrabold uppercase">Kanban Number</label>
                      <input
                        type="text"
                        value={masterInfo.internalProductNumber || 'KAN-000001'}
                        readOnly
                        disabled
                        tabIndex={-1}
                        className="w-full bg-black/60 border border-white/10 px-3 py-2 rounded-xl text-purple-400 text-xs font-mono select-none cursor-not-allowed uppercase font-bold"
                      />
                      <p className="text-[8px] font-mono text-gray-500 flex items-center gap-1 mt-1">
                        🔒 Automatically Generated by the Global ID Service
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] text-gray-500 font-extrabold uppercase">Product Name</label>
                      <input
                        type="text"
                        value={masterInfo.productName}
                        onChange={(e) => handleUpdateMasterInfo('productName', e.target.value.toUpperCase())}
                        placeholder="e.g. SOLID OAK MOLDING 3000MM"
                        className="w-full bg-black border border-white/10 px-3 py-2 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 uppercase"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-gray-500 font-extrabold uppercase">Supplier</label>
                        <input
                          type="text"
                          value={masterInfo.supplier}
                          onChange={(e) => handleUpdateMasterInfo('supplier', e.target.value)}
                          placeholder="Supplier Name"
                          className="w-full bg-black border border-white/10 px-3 py-2 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-gray-500 font-extrabold uppercase">Supplier Part No</label>
                        <input
                          type="text"
                          value={masterInfo.supplierPartNumber}
                          onChange={(e) => handleUpdateMasterInfo('supplierPartNumber', e.target.value.toUpperCase())}
                          placeholder="e.g. OAK-CORN"
                          className="w-full bg-black border border-white/10 px-3 py-2 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-purple-500 uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Logistics and Coordinates */}
                  <div className="space-y-3 bg-black/20 p-4 border border-white/5 rounded-2xl">
                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Warehouse Logistics</span>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-gray-500 font-extrabold uppercase">Order Quantity</label>
                        <input
                          type="text"
                          value={masterInfo.orderQuantity}
                          onChange={(e) => handleUpdateMasterInfo('orderQuantity', e.target.value)}
                          placeholder="e.g. 50 PCS"
                          className="w-full bg-black border border-white/10 px-3 py-2 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-gray-500 font-extrabold uppercase">Delivery Time</label>
                        <input
                          type="text"
                          value={masterInfo.deliveryTime}
                          onChange={(e) => handleUpdateMasterInfo('deliveryTime', e.target.value)}
                          placeholder="e.g. 3 Days"
                          className="w-full bg-black border border-white/10 px-3 py-2 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-gray-500 font-extrabold uppercase">Location</label>
                        <input
                          type="text"
                          value={masterInfo.location}
                          onChange={(e) => handleUpdateMasterInfo('location', e.target.value.toUpperCase())}
                          placeholder="e.g. A12"
                          className="w-full bg-black border border-white/10 px-3 py-2 rounded-xl text-white text-xs font-mono text-center focus:outline-none focus:border-purple-500 uppercase"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-gray-500 font-extrabold uppercase">Location Colour</label>
                        <select
                          value={masterInfo.locationColour}
                          onChange={(e) => handleUpdateMasterInfo('locationColour', e.target.value.toUpperCase())}
                          className="w-full bg-black text-white text-xs px-3 py-2 border border-white/10 rounded-xl focus:outline-none font-bold"
                        >
                          <option value="GREEN">GREEN</option>
                          <option value="BLUE">BLUE</option>
                          <option value="RED">RED</option>
                          <option value="YELLOW">YELLOW</option>
                          <option value="ORANGE">ORANGE</option>
                          <option value="PURPLE">PURPLE</option>
                          <option value="GRAY">GRAY</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] text-gray-500 font-extrabold uppercase">Bin Quantity</label>
                      <input
                        type="text"
                        value={masterInfo.binQuantity || ''}
                        onChange={(e) => handleUpdateMasterInfo('binQuantity', e.target.value)}
                        placeholder="e.g. 2 Bins (25/Bin)"
                        className="w-full bg-black border border-white/10 px-3 py-2 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  {/* Interactive Product Image Widget */}
                  <div className="space-y-3 bg-black/20 p-4 border border-white/5 rounded-2xl">
                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Product Image</span>
                    
                    {masterInfo.productImage ? (
                      <div className="space-y-3">
                        <div className="relative w-full h-32 bg-black rounded-xl border border-white/10 overflow-hidden flex items-center justify-center">
                          <img
                            src={masterInfo.productImage}
                            alt="Master Product representation"
                            className="max-h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-black uppercase text-gray-300 transition-colors flex items-center justify-center gap-1"
                          >
                            <Icon name="refresh-cw" size={10} /> Replace
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateMasterInfo('productImage', '')}
                            className="py-1.5 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-lg text-[9px] font-black uppercase text-red-400 transition-colors flex items-center justify-center gap-1"
                          >
                            <Icon name="trash" size={10} /> Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsPreviewModalOpen(true)}
                            className="py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-black uppercase text-gray-300 transition-colors flex items-center justify-center gap-1"
                          >
                            <Icon name="eye" size={10} /> Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCropImageSrc(masterInfo.productImage);
                              setCropZoom(1);
                              setCropPanX(0);
                              setCropPanY(0);
                              setCropRotation(0);
                              setIsCropModalOpen(true);
                            }}
                            className="py-1.5 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 rounded-lg text-[9px] font-black uppercase text-purple-400 transition-colors flex items-center justify-center gap-1"
                          >
                            <Icon name="crop" size={10} /> Crop
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-white/10 hover:border-purple-500/40 bg-black/40 hover:bg-black/60 rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
                      >
                        <Icon name="upload" size={24} className="text-gray-500" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Upload Product Image</span>
                        <span className="text-[8px] text-gray-600 uppercase">Drag-and-drop or click to choose file</span>
                      </div>
                    )}
                  </div>

                  {/* Auto-generated QR Code Widget */}
                  <div className="space-y-3 bg-black/20 p-4 border border-white/5 rounded-2xl">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Auto-Generated QR Code</span>
                      <span className="text-[8px] font-mono text-purple-400 font-bold flex items-center gap-1"><Icon name="lock" size={8} /> READ-ONLY</span>
                    </div>

                    <div className="flex items-center gap-3 bg-black/40 p-2.5 rounded-xl border border-white/5">
                      <div className="bg-white p-1 rounded-lg shrink-0 border border-white/10 flex items-center justify-center overflow-hidden" style={{ width: '48px', height: '48px' }}>
                        <QRCodeRenderer
                          text={masterInfo.qrCode || ''}
                          width={40}
                          height={40}
                          responsive={false}
                          className="flex items-center justify-center"
                        />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[8px] font-black uppercase tracking-wider text-gray-500 block">Encoded Schema Data</span>
                        <p className="text-[8px] font-mono text-gray-400 truncate uppercase">ID: {masterInfo.internalProductNumber || 'N/A'}</p>
                        <p className="text-[8px] font-mono text-gray-400 truncate uppercase">LOC: {masterInfo.location || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SPECIFIC SECTION LAYOUT AND STYLE PROPERTIES */}
              {rightActiveTab === 'layout' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Global Paper Configuration options */}
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
                  </div>

                  {/* Section Properties List */}
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

                    {/* Quick section switcher buttons */}
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

                    <div className="bg-black/20 p-4 border border-white/5 rounded-2xl space-y-4 text-xs font-sans">
                      {/* Section coordinates inputs */}
                      <div className="grid grid-cols-2 gap-3 font-sans">
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

                      <div className="grid grid-cols-2 gap-3 font-sans">
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

                      {/* Spacings sliders */}
                      <div className="space-y-1.5 font-sans">
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

                      <div className="space-y-1.5 font-sans">
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

                      <div className="space-y-1.5 font-sans">
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

                      <div className="grid grid-cols-2 gap-3 font-sans">
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
                        <div className="space-y-1.5 font-sans">
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

                      {/* Aesthetics coloring */}
                      <div className="grid grid-cols-2 gap-3 font-sans">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-500 font-extrabold uppercase">BG Color</label>
                          <div className="flex gap-2 font-sans">
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
                        <div className="space-y-1.5 font-sans">
                          <label className="text-[10px] text-gray-500 font-extrabold uppercase">Border Color</label>
                          <div className="flex gap-2 font-sans">
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
                </div>
              )}

              {/* TAB 3: TYPOGRAPHY & TEXT CUSTOMIZATION */}
              {rightActiveTab === 'typography' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="pb-3 border-b border-white/5">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                      <Icon name="type" size={12} /> Text Customizer
                    </h3>
                    <p className="text-[9px] text-gray-500 mt-1 font-sans">
                      Select any text element inside the active section to customize its typography, shadows, margins, and borders.
                    </p>
                  </div>

                  {/* Section Switcher (compact) */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-gray-500 font-extrabold uppercase">Selected Section</label>
                    <div className="grid grid-cols-4 gap-1 bg-black/40 p-1 rounded-xl">
                      {activeTemplate.sections.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setActiveSectionId(s.id);
                            setSelectedTextElementId(''); // reset element on section change
                          }}
                          className={`py-1 text-[8px] font-black uppercase tracking-tighter rounded-lg transition-all ${
                            activeSectionId === s.id
                              ? 'bg-emerald-600 text-white shadow'
                              : 'text-gray-500 hover:text-white'
                          }`}
                          title={s.name}
                        >
                          {s.id === 'master_info' ? 'Master' : s.id === 'kanban_pulled' ? 'Pulled' : s.id === 'warehouse_id' ? 'ID' : 'Display'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text Element Picker inside active section */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-gray-500 font-extrabold uppercase">Text Element</label>
                    <select
                      value={currentElementId}
                      onChange={(e) => setSelectedTextElementId(e.target.value)}
                      className="w-full bg-black text-white text-xs px-3 py-2 border border-white/10 rounded-xl focus:outline-none"
                    >
                      {sectionTextElements.map(el => (
                        <option key={el.id} value={el.id}>{el.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Custom properties panel specifically named KANBAN PULLED TEXT for Section 2 warning */}
                  {activeSectionId === 'kanban_pulled' && currentElementId === 'warningText' ? (
                    <div className="space-y-4 bg-black/20 p-4 border border-white/5 rounded-2xl">
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-red-400">KANBAN PULLED TEXT</span>
                        <span className="text-[8px] font-mono text-gray-500 font-bold uppercase">Section 2 Banner</span>
                      </div>

                      {/* Font Size slider */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase flex justify-between">
                          <span>Font Size</span>
                          <span className="font-mono text-red-400 font-bold">{(activeSection.textSettings?.warningText?.fontSize ?? 28)}px</span>
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="120"
                          step="1"
                          value={(activeSection.textSettings?.warningText?.fontSize ?? 28)}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'fontSize', parseInt(e.target.value, 10))}
                          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                        <span className="text-[8px] text-gray-600 block leading-tight">Increases up to 72px+ without breaking layout (with auto-center & fit).</span>
                      </div>

                      {/* Font Weight */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase">Font Weight</label>
                        <select
                          value={(activeSection.textSettings?.warningText?.fontWeight ?? 'bold')}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'fontWeight', e.target.value)}
                          className="w-full bg-black text-white text-xs px-2.5 py-1.5 border border-white/10 rounded-xl focus:outline-none"
                        >
                          <option value="normal">Regular</option>
                          <option value="medium">Medium</option>
                          <option value="semibold">Semi Bold</option>
                          <option value="bold">Bold</option>
                          <option value="extrabold">Extra Bold</option>
                          <option value="black">Black (Ultra)</option>
                        </select>
                      </div>

                      {/* Font Colour */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase">Font Colour</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={(activeSection.textSettings?.warningText?.color ?? '#dc2626')}
                            onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'color', e.target.value)}
                            className="w-8 h-8 rounded-lg overflow-hidden bg-transparent cursor-pointer border border-white/15"
                          />
                          <input
                            type="text"
                            value={(activeSection.textSettings?.warningText?.color ?? '#dc2626')}
                            onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'color', e.target.value)}
                            className="w-full bg-black text-white font-mono text-center text-xs border border-white/10 px-1 rounded-xl focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Font Family */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase">Font Family</label>
                        <select
                          value={(activeSection.textSettings?.warningText?.fontFamily ?? 'sans-serif')}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'fontFamily', e.target.value)}
                          className="w-full bg-black text-white text-xs px-2.5 py-1.5 border border-white/10 rounded-xl focus:outline-none"
                        >
                          {AVAILABLE_FONTS.map(font => (
                            <option key={font.value} value={font.value}>{font.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Letter Spacing */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase flex justify-between">
                          <span>Letter Spacing</span>
                          <span className="font-mono text-red-400 font-bold">{(activeSection.textSettings?.warningText?.letterSpacing ?? '0px')}</span>
                        </label>
                        <select
                          value={(activeSection.textSettings?.warningText?.letterSpacing ?? '0px')}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'letterSpacing', e.target.value)}
                          className="w-full bg-black text-white text-xs px-2.5 py-1.5 border border-white/10 rounded-xl focus:outline-none"
                        >
                          <option value="-1px">Tight (-1px)</option>
                          <option value="0px">Normal (0px)</option>
                          <option value="1px">Wide (1px)</option>
                          <option value="2px">Extra Wide (2px)</option>
                          <option value="4px">Tracking (4px)</option>
                          <option value="8px">Display (8px)</option>
                        </select>
                      </div>

                      {/* Text Shadow */}
                      <div className="space-y-3 pt-2 border-t border-white/5">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-gray-400 uppercase">Text Shadow</span>
                          <input
                            type="checkbox"
                            checked={activeSection.textSettings?.warningText?.shadowEnabled || false}
                            onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'shadowEnabled', e.target.checked)}
                            className="w-3.5 h-3.5 accent-red-500 rounded bg-black border border-white/10"
                          />
                        </div>
                        {activeSection.textSettings?.warningText?.shadowEnabled && (
                          <div className="space-y-2.5 pl-2 border-l border-white/5">
                            <div className="space-y-1 font-sans">
                              <label className="text-[9px] text-gray-500 font-bold uppercase">Shadow Colour</label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={activeSection.textSettings?.warningText?.shadowColor || '#000000'}
                                  onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'shadowColor', e.target.value)}
                                  className="w-6 h-6 rounded-md overflow-hidden bg-transparent cursor-pointer border border-white/15"
                                />
                                <input
                                  type="text"
                                  value={activeSection.textSettings?.warningText?.shadowColor || '#000000'}
                                  onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'shadowColor', e.target.value)}
                                  className="w-full bg-black text-white font-mono text-center text-[10px] border border-white/10 px-1 rounded-lg focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 font-sans">
                              <div className="space-y-1">
                                <label className="text-[8px] text-gray-500 font-bold uppercase">Blur</label>
                                <input
                                  type="number"
                                  value={activeSection.textSettings?.warningText?.shadowBlur ?? 2}
                                  onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'shadowBlur', parseInt(e.target.value, 10) || 0)}
                                  className="w-full bg-black border border-white/10 text-center rounded-lg text-xs py-1"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] text-gray-500 font-bold uppercase">X Offset</label>
                                <input
                                  type="number"
                                  value={activeSection.textSettings?.warningText?.shadowOffsetX ?? 1}
                                  onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'shadowOffsetX', parseInt(e.target.value, 10) || 0)}
                                  className="w-full bg-black border border-white/10 text-center rounded-lg text-xs py-1"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] text-gray-500 font-bold uppercase">Y Offset</label>
                                <input
                                  type="number"
                                  value={activeSection.textSettings?.warningText?.shadowOffsetY ?? 1}
                                  onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'shadowOffsetY', parseInt(e.target.value, 10) || 0)}
                                  className="w-full bg-black border border-white/10 text-center rounded-lg text-xs py-1"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Rotation slider */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase flex justify-between">
                          <span>Rotation</span>
                          <span className="font-mono text-red-400 font-bold">{(activeSection.textSettings?.warningText?.rotation ?? 0)}°</span>
                        </label>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="1"
                          value={(activeSection.textSettings?.warningText?.rotation ?? 0)}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'rotation', parseInt(e.target.value, 10))}
                          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                      </div>

                      {/* Horizontal Position offset */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase flex justify-between">
                          <span>Horizontal Position</span>
                          <span className="font-mono text-red-400 font-bold">{(activeSection.textSettings?.warningText?.horizontalPosition ?? 0)}px</span>
                        </label>
                        <input
                          type="range"
                          min="-150"
                          max="150"
                          step="1"
                          value={(activeSection.textSettings?.warningText?.horizontalPosition ?? 0)}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'horizontalPosition', parseInt(e.target.value, 10))}
                          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                      </div>

                      {/* Vertical Position offset */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase flex justify-between">
                          <span>Vertical Position</span>
                          <span className="font-mono text-red-400 font-bold">{(activeSection.textSettings?.warningText?.verticalPosition ?? 0)}px</span>
                        </label>
                        <input
                          type="range"
                          min="-150"
                          max="150"
                          step="1"
                          value={(activeSection.textSettings?.warningText?.verticalPosition ?? 0)}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, 'warningText', 'verticalPosition', parseInt(e.target.value, 10))}
                          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                      </div>
                    </div>
                  ) : (
                    /* General Property Panel for other text elements */
                    <div className="space-y-4 bg-black/20 p-4 border border-white/5 rounded-2xl">
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Typography / Style Customizer</span>
                        <span className="text-[8px] font-mono text-gray-500 font-bold uppercase">Element ID: {currentElementId}</span>
                      </div>

                      {/* Font Size slider */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase flex justify-between">
                          <span>Font Size</span>
                          <span className="font-mono text-emerald-400 font-bold">{(activeSection.textSettings?.[currentElementId]?.fontSize ?? 12)}px</span>
                        </label>
                        <input
                          type="range"
                          min="6"
                          max="80"
                          step="1"
                          value={(activeSection.textSettings?.[currentElementId]?.fontSize ?? 12)}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'fontSize', parseInt(e.target.value, 10))}
                          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>

                      {/* Font Family selector */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase">Font Family</label>
                        <select
                          value={(activeSection.textSettings?.[currentElementId]?.fontFamily ?? 'sans-serif')}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'fontFamily', e.target.value)}
                          className="w-full bg-black text-white text-xs px-2.5 py-1.5 border border-white/10 rounded-xl focus:outline-none"
                        >
                          {AVAILABLE_FONTS.map(font => (
                            <option key={font.value} value={font.value}>{font.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Font Weight */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase">Font Weight</label>
                        <select
                          value={(activeSection.textSettings?.[currentElementId]?.fontWeight ?? 'normal')}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'fontWeight', e.target.value)}
                          className="w-full bg-black text-white text-xs px-2.5 py-1.5 border border-white/10 rounded-xl focus:outline-none"
                        >
                          <option value="normal">Regular</option>
                          <option value="medium">Medium</option>
                          <option value="semibold">Semi Bold</option>
                          <option value="bold">Bold</option>
                          <option value="extrabold">Extra Bold</option>
                          <option value="black">Black (Ultra)</option>
                        </select>
                      </div>

                      {/* Font Style */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase">Font Style</label>
                        <select
                          value={(activeSection.textSettings?.[currentElementId]?.fontStyle ?? 'normal')}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'fontStyle', e.target.value as any)}
                          className="w-full bg-black text-white text-xs px-2.5 py-1.5 border border-white/10 rounded-xl focus:outline-none"
                        >
                          <option value="normal">Normal</option>
                          <option value="italic">Italic</option>
                        </select>
                      </div>

                      {/* Letter Spacing */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase">Letter Spacing</label>
                        <select
                          value={(activeSection.textSettings?.[currentElementId]?.letterSpacing ?? '0px')}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'letterSpacing', e.target.value)}
                          className="w-full bg-black text-white text-xs px-2.5 py-1.5 border border-white/10 rounded-xl focus:outline-none"
                        >
                          <option value="-1px">Tight (-1px)</option>
                          <option value="0px">Normal (0px)</option>
                          <option value="1px">Wide (1px)</option>
                          <option value="2px">Extra Wide (2px)</option>
                          <option value="4px">Tracking (4px)</option>
                          <option value="8px">Display (8px)</option>
                        </select>
                      </div>

                      {/* Line Height */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase flex justify-between">
                          <span>Line Height</span>
                          <span className="font-mono text-emerald-400 font-bold">{(activeSection.textSettings?.[currentElementId]?.lineHeight ?? '1.2')}</span>
                        </label>
                        <input
                          type="range"
                          min="0.8"
                          max="2.5"
                          step="0.1"
                          value={parseFloat(activeSection.textSettings?.[currentElementId]?.lineHeight ?? '1.2')}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'lineHeight', e.target.value)}
                          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>

                      {/* Text Colour */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase">Text Colour</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={(activeSection.textSettings?.[currentElementId]?.color ?? '#000000')}
                            onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'color', e.target.value)}
                            className="w-8 h-8 rounded-lg overflow-hidden bg-transparent cursor-pointer border border-white/15"
                          />
                          <input
                            type="text"
                            value={(activeSection.textSettings?.[currentElementId]?.color ?? '#000000')}
                            onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'color', e.target.value)}
                            className="w-full bg-black text-white font-mono text-center text-xs border border-white/10 px-1 rounded-xl focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Text Alignment */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase">Text Alignment</label>
                        <select
                          value={(activeSection.textSettings?.[currentElementId]?.textAlign ?? 'left')}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'textAlign', e.target.value as any)}
                          className="w-full bg-black text-white text-xs px-2.5 py-1.5 border border-white/10 rounded-xl focus:outline-none"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                          <option value="justify">Justify</option>
                        </select>
                      </div>

                      {/* Text Transform */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[9px] text-gray-400 font-bold uppercase">Text Transform</label>
                        <select
                          value={(activeSection.textSettings?.[currentElementId]?.textTransform ?? 'normal')}
                          onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'textTransform', e.target.value as any)}
                          className="w-full bg-black text-white text-xs px-2.5 py-1.5 border border-white/10 rounded-xl focus:outline-none"
                        >
                          <option value="normal">Normal</option>
                          <option value="uppercase">Uppercase</option>
                          <option value="lowercase">Lowercase</option>
                          <option value="capitalize">Capitalize</option>
                        </select>
                      </div>

                      {/* Text Shadow section */}
                      <div className="space-y-3 pt-3 border-t border-white/5">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-gray-400 uppercase">Text Shadow</span>
                          <input
                            type="checkbox"
                            checked={activeSection.textSettings?.[currentElementId]?.shadowEnabled || false}
                            onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'shadowEnabled', e.target.checked)}
                            className="w-3.5 h-3.5 accent-emerald-500 rounded bg-black border border-white/10"
                          />
                        </div>
                        {activeSection.textSettings?.[currentElementId]?.shadowEnabled && (
                          <div className="space-y-2.5 pl-2 border-l border-white/5">
                            <div className="space-y-1 font-sans">
                              <label className="text-[9px] text-gray-500 font-bold uppercase">Shadow Colour</label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={activeSection.textSettings?.[currentElementId]?.shadowColor || '#000000'}
                                  onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'shadowColor', e.target.value)}
                                  className="w-6 h-6 rounded-md overflow-hidden bg-transparent cursor-pointer border border-white/15"
                                />
                                <input
                                  type="text"
                                  value={activeSection.textSettings?.[currentElementId]?.shadowColor || '#000000'}
                                  onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'shadowColor', e.target.value)}
                                  className="w-full bg-black text-white font-mono text-center text-[10px] border border-white/10 px-1 rounded-lg focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 font-sans">
                              <div className="space-y-1">
                                <label className="text-[8px] text-gray-500 font-bold uppercase">Blur</label>
                                <input
                                  type="number"
                                  value={activeSection.textSettings?.[currentElementId]?.shadowBlur ?? 2}
                                  onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'shadowBlur', parseInt(e.target.value, 10) || 0)}
                                  className="w-full bg-black border border-white/10 text-center rounded-lg text-xs py-1"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] text-gray-500 font-bold uppercase">X Offset</label>
                                <input
                                  type="number"
                                  value={activeSection.textSettings?.[currentElementId]?.shadowOffsetX ?? 1}
                                  onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'shadowOffsetX', parseInt(e.target.value, 10) || 0)}
                                  className="w-full bg-black border border-white/10 text-center rounded-lg text-xs py-1"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] text-gray-500 font-bold uppercase">Y Offset</label>
                                <input
                                  type="number"
                                  value={activeSection.textSettings?.[currentElementId]?.shadowOffsetY ?? 1}
                                  onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'shadowOffsetY', parseInt(e.target.value, 10) || 0)}
                                  className="w-full bg-black border border-white/10 text-center rounded-lg text-xs py-1"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Stroke settings */}
                      <div className="space-y-3 pt-3 border-t border-white/5">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-gray-400 uppercase">Text Stroke</span>
                          <input
                            type="checkbox"
                            checked={activeSection.textSettings?.[currentElementId]?.strokeEnabled || false}
                            onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'strokeEnabled', e.target.checked)}
                            className="w-3.5 h-3.5 accent-emerald-500 rounded bg-black border border-white/10"
                          />
                        </div>
                        {activeSection.textSettings?.[currentElementId]?.strokeEnabled && (
                          <div className="space-y-2.5 pl-2 border-l border-white/5 font-sans">
                            <div className="space-y-1">
                              <label className="text-[9px] text-gray-500 font-bold uppercase">Stroke Width (px)</label>
                              <input
                                type="number"
                                min="0.5"
                                max="5"
                                step="0.5"
                                value={activeSection.textSettings?.[currentElementId]?.strokeWidth ?? 1}
                                onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'strokeWidth', parseFloat(e.target.value) || 0.5)}
                                className="w-full bg-black border border-white/10 rounded-lg text-xs py-1 text-center"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] text-gray-500 font-bold uppercase">Stroke Colour</label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={activeSection.textSettings?.[currentElementId]?.strokeColor || '#ffffff'}
                                  onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'strokeColor', e.target.value)}
                                  className="w-6 h-6 rounded-md overflow-hidden bg-transparent cursor-pointer border border-white/15"
                                />
                                <input
                                  type="text"
                                  value={activeSection.textSettings?.[currentElementId]?.strokeColor || '#ffffff'}
                                  onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'strokeColor', e.target.value)}
                                  className="w-full bg-black text-white font-mono text-center text-[10px] border border-white/10 px-1 rounded-lg focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Spacing margin/padding settings */}
                      <div className="space-y-3 pt-3 border-t border-white/5">
                        <span className="text-[9px] font-bold text-gray-400 uppercase block">Element Spacing (Margins & Padding)</span>
                        <div className="grid grid-cols-3 gap-2 font-sans text-xs">
                          <div className="space-y-1">
                            <label className="text-[8px] text-gray-500 font-bold uppercase block">Margin Top</label>
                            <input
                              type="number"
                              value={activeSection.textSettings?.[currentElementId]?.marginTop ?? 0}
                              onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'marginTop', parseInt(e.target.value, 10) || 0)}
                              className="w-full bg-black border border-white/10 text-center rounded-lg text-xs py-1"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] text-gray-500 font-bold uppercase block">Margin Btm</label>
                            <input
                              type="number"
                              value={activeSection.textSettings?.[currentElementId]?.marginBottom ?? 0}
                              onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'marginBottom', parseInt(e.target.value, 10) || 0)}
                              className="w-full bg-black border border-white/10 text-center rounded-lg text-xs py-1"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] text-gray-500 font-bold uppercase block">Padding</label>
                            <input
                              type="number"
                              value={activeSection.textSettings?.[currentElementId]?.padding ?? 0}
                              onChange={(e) => updateTextSettingProperty(activeSectionId, currentElementId, 'padding', parseInt(e.target.value, 10) || 0)}
                              className="w-full bg-black border border-white/10 text-center rounded-lg text-xs py-1"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </aside>
            );
          })()}
        </div>
      </div>

      {/* 4. MODAL: IMAGE CROPPING TOOL MODAL */}
      {isCropModalOpen && cropImageSrc && (
        <div className="fixed inset-0 z-[1550] bg-black/95 flex items-center justify-center p-6 animate-in fade-in">
          <div className="relative bg-[#121212] border border-white/10 rounded-[2.5rem] p-6 max-w-xl w-full flex flex-col items-center gap-5 font-sans">
            <button
              onClick={() => setIsCropModalOpen(false)}
              className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-colors"
            >
              <Icon name="x" size={18} />
            </button>
            
            <div className="text-center space-y-1">
              <h3 className="text-sm font-black uppercase tracking-widest text-purple-400 flex items-center justify-center gap-2">
                <Icon name="crop" size={16} /> Interactive Image Crop & Align
              </h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                Adjust zoom scale, rotation angle, and pan offset before committing to canvas
              </p>
            </div>

            {/* Hidden canvas for performing crop rendering */}
            <canvas ref={cropCanvasRef} className="hidden" />

            {/* Viewport preview box */}
            <div className="w-[300px] h-[300px] bg-black rounded-2xl border-2 border-dashed border-purple-500/40 relative overflow-hidden flex items-center justify-center shrink-0">
              <div
                style={{
                  transform: `translate(${cropPanX}px, ${cropPanY}px) rotate(${cropRotation}deg) scale(${cropZoom})`,
                  transition: 'transform 0.05s ease-out'
                }}
                className="w-full h-full flex items-center justify-center"
              >
                <img
                  src={cropImageSrc}
                  alt="Crop preview target"
                  className="max-w-full max-h-full object-contain pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Sliders Controls */}
            <div className="w-full space-y-3 bg-black/40 p-4 rounded-2xl border border-white/5 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-gray-400">
                  <span>Zoom Scale</span>
                  <span className="font-mono text-purple-400">{cropZoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.05"
                  value={cropZoom}
                  onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-gray-400">
                    <span>Pan X</span>
                    <span className="font-mono text-purple-400">{cropPanX}px</span>
                  </div>
                  <input
                    type="range"
                    min="-150"
                    max="150"
                    step="1"
                    value={cropPanX}
                    onChange={(e) => setCropPanX(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-gray-400">
                    <span>Pan Y</span>
                    <span className="font-mono text-purple-400">{cropPanY}px</span>
                  </div>
                  <input
                    type="range"
                    min="-150"
                    max="150"
                    step="1"
                    value={cropPanY}
                    onChange={(e) => setCropPanY(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-gray-400">
                  <span>Rotation</span>
                  <span className="font-mono text-purple-400">{cropRotation}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={cropRotation}
                  onChange={(e) => setCropRotation(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => setIsCropModalOpen(false)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCrop}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all shadow-lg shadow-purple-500/20"
              >
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: FULL RESOLUTION IMAGE PREVIEW OVERLAY */}
      {isPreviewModalOpen && masterInfo.productImage && (
        <div className="fixed inset-0 z-[1500] bg-black/95 flex items-center justify-center p-6 animate-in fade-in">
          <div className="relative bg-[#121212] border border-white/10 rounded-[2.5rem] p-6 max-w-2xl w-full flex flex-col items-center gap-6 font-sans">
            <button
              onClick={() => setIsPreviewModalOpen(false)}
              className="absolute top-6 right-6 p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-colors"
            >
              <Icon name="x" size={20} />
            </button>
            <h3 className="text-sm font-black uppercase tracking-widest text-white mt-2">
              🔍 Product Image Preview
            </h3>
            <img
              src={masterInfo.productImage}
              alt="High Resolution Product representation"
              className="max-h-[400px] object-contain rounded-2xl border border-white/5 bg-black"
              referrerPolicy="no-referrer"
            />
            <p className="text-[10px] text-gray-400 uppercase font-bold text-center">
              {masterInfo.productName || 'No Product Name Specified'}
            </p>
          </div>
        </div>
      )}

      {/* 6. MODAL: SAVE LAYOUT METADATA DIALOG */}
      {isSaveDialogOpen && (
        <div className="fixed inset-0 z-[1600] bg-black/85 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4 font-sans">
            <button
              onClick={() => setIsSaveDialogOpen(false)}
              className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-colors"
            >
              <Icon name="x" size={16} />
            </button>
            
            <div className="space-y-1">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#ff8c00] flex items-center gap-1.5">
                <Icon name="save" size={15} /> Save Template Layout
              </h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                Provide specifications for automatic categorization & search
              </p>
            </div>

            <div className="space-y-3.5">
              {/* Template Name */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block">Template Name *</label>
                <input
                  type="text"
                  placeholder="E.G. TSJ SINGLE CARD DESIGN"
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all font-bold"
                />
              </div>

              {/* Product Name */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block">Product Name *</label>
                <input
                  type="text"
                  placeholder="E.G. Birch Ply"
                  value={saveProductName}
                  onChange={(e) => setSaveProductName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all font-semibold"
                />
                <span className="text-[8px] text-gray-500 uppercase font-mono tracking-tight block">
                  Used for folder organisation (First letter A-Z)
                </span>
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block">Category *</label>
                <input
                  type="text"
                  placeholder="E.G. Boards, Screws, Hinges..."
                  value={saveCategory}
                  onChange={(e) => setSaveCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all font-medium"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block">Description (Optional)</label>
                <textarea
                  placeholder="Enter a brief summary or purpose for this template design..."
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setIsSaveDialogOpen(false)}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                className="flex-1 py-2 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Save Design
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: DUPLICATE TEMPLATE DIALOG */}
      {isDuplicateDialogOpen && (
        <div className="fixed inset-0 z-[1600] bg-black/85 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4 font-sans">
            <button
              onClick={() => setIsDuplicateDialogOpen(false)}
              className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-colors"
            >
              <Icon name="x" size={16} />
            </button>

            <div className="space-y-1">
              <h3 className="text-sm font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                <Icon name="copy" size={15} /> Duplicate Template
              </h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                Clones all settings into a new template design file
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block">New Product Name *</label>
                <input
                  type="text"
                  placeholder="E.G. Red Oak Cornice"
                  value={duplicateProductName}
                  onChange={(e) => setDuplicateProductName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all font-semibold"
                />
                <span className="text-[8px] text-gray-500 uppercase font-mono tracking-tight block">
                  The copy will automatically group under the corresponding folder (A-Z)
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setIsDuplicateDialogOpen(false)}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDuplicate}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Duplicate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: DELETE CONFIRMATION DIALOG */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[1600] bg-black/85 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#121212] border border-red-500/20 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative space-y-4 font-sans text-center">
            <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
              <Icon name="trash" className="text-red-500" size={20} />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-red-500">
                Confirm Deletion
              </h3>
              <p className="text-xs text-gray-400">
                Are you sure you want to permanently delete <span className="font-extrabold text-white uppercase">"{activeTemplate?.templateName}"</span>?
              </p>
              <p className="text-[9px] text-gray-500 uppercase font-mono leading-tight">
                This action is irreversible and will remove this layout design immediately.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
