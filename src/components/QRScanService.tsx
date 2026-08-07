import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Icon } from './Icon';
import { getKanbanCard, KanbanCardMaster } from '../services/kanbanService';
import { db, APP_ID_PATH } from '../firebase';
import { auditLogger } from '../audit';
import { stockRequestService } from '../services/stockRequestService';
import { productMasterService } from '../services/productMasterService';
import { StockRequestItem } from '../types';

interface QRScanServiceProps {
  kanbanCards: any[]; // Existing card references for listing & simulation
  currentUser?: any;  // The currently logged in user/supervisor
  onClose?: () => void;
  announce: (msg: string) => void;
}

export interface BasketItem {
  id: string; // Kanban identifier
  card: KanbanCardMaster;
  basketQty: number; // how many times added/requested
  addedAt: string; // ISO timestamp
}

export const QRScanService: React.FC<QRScanServiceProps> = ({
  kanbanCards = [],
  currentUser,
  onClose,
  announce
}) => {
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'loading' | 'success' | 'error'>('idle');
  const [scannedId, setScannedId] = useState<string>('');
  const [loadedCard, setLoadedCard] = useState<KanbanCardMaster | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  
  // Basket State & local storage sync
  const [basket, setBasket] = useState<BasketItem[]>(() => {
    try {
      const stored = localStorage.getItem('ts_joinery_kanban_basket');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to load initial basket from localStorage:', err);
    }
    return [];
  });
  const [recentScanAlert, setRecentScanAlert] = useState<{ productName: string; qty: number } | null>(null);
  
  // Order Confirmation Modal
  const [orderSuccessModal, setOrderSuccessModal] = useState<boolean>(false);
  const [lastSubmittedOrderId, setLastSubmittedOrderId] = useState<string>('');
  const [isReviewMode, setIsReviewMode] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');

  // Scanned Item Dialog Modal State
  const [showScanSuccessModal, setShowScanSuccessModal] = useState<boolean>(false);
  const [scannedModalProduct, setScannedModalProduct] = useState<{ id: string; name: string } | null>(null);

  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const lastScannedRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  const videoContainerId = 'qr-reader-element';

  // Announce basket recovery on initial load if items present
  useEffect(() => {
    if (basket.length > 0) {
      const totalItems = basket.reduce((sum: number, item: BasketItem) => sum + (item.basketQty || 1), 0);
      announce(`Recovered previous basket (${totalItems} items).`);
    }
  }, []);

  // Save basket to local storage whenever it changes (accepts value or functional updater)
  const saveBasket = (updater: BasketItem[] | ((prev: BasketItem[]) => BasketItem[])) => {
    setBasket(prev => {
      const nextBasket = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('ts_joinery_kanban_basket', JSON.stringify(nextBasket));
      } catch (err) {
        console.error('Failed to save basket to localStorage:', err);
      }
      return nextBasket;
    });
  };

  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);

  const toggleTorch = async () => {
    try {
      const videoEl = document.querySelector(`#${videoContainerId} video`) as HTMLVideoElement;
      if (videoEl && videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
          if (capabilities && 'torch' in capabilities) {
            const nextState = !isTorchOn;
            await (track as any).applyConstraints({
              advanced: [{ torch: nextState }]
            });
            setIsTorchOn(nextState);
            announce(nextState ? 'Flashlight enabled.' : 'Flashlight disabled.');
          } else {
            announce('Camera flashlight is not supported on this device.');
          }
        }
      }
    } catch (err) {
      console.warn('Failed to toggle torch:', err);
    }
  };

  // Cleans up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError('');
    setScanState('scanning');
    try {
      if (qrCodeInstanceRef.current) {
        try {
          await qrCodeInstanceRef.current.stop();
        } catch (e) {
          // ignore
        }
      }

      const html5QrCode = new Html5Qrcode(videoContainerId);
      qrCodeInstanceRef.current = html5QrCode;
      setIsCameraActive(true);

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (width, height) => {
            const minDim = Math.min(width, height);
            const size = Math.floor(minDim * 0.8);
            return { width: size, height: size };
          }
        },
        (decodedText) => {
          console.log('QR Detected');
          handleQRCodeScanned(decodedText);
        },
        (errorMessage) => {
          // silent frame-by-frame debug info
        }
      );
      console.log('Camera Started');
    } catch (err: any) {
      console.error('Failed to start camera:', err);
      setCameraError('Unable to access camera. Please check browser permissions and ensure it is not locked by another application.');
      setScanState('idle');
      setIsCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
      try {
        await qrCodeInstanceRef.current.stop();
      } catch (e) {
        console.error('Error stopping camera:', e);
      }
    }
    setIsCameraActive(false);
    if (scanState === 'scanning') {
      setScanState('idle');
    }
  };

  // Extract ID from full URL or return raw ID
  const extractId = (text: string): string => {
    try {
      if (text.startsWith('http://') || text.startsWith('https://')) {
        const url = new URL(text);
        const parts = url.pathname.split('/');
        return parts[parts.length - 1]?.trim() || text;
      }
    } catch (e) {
      // ignore, use fallback
    }
    return text.trim();
  };

  const handleQRCodeScanned = async (rawText: string) => {
    const cleanId = extractId(rawText);
    console.log('Decoded Text:\n' + cleanId);
    if (!cleanId) return;

    // Continuous scanning duplicate guard (ignore exact same code scanned within 2.0s)
    const now = Date.now();
    if (lastScannedRef.current.id === cleanId && (now - lastScannedRef.current.time) < 2000) {
      return;
    }
    lastScannedRef.current = { id: cleanId, time: now };

    console.log('QR Validation Successful');
    announce(`Successfully scanned ID: ${cleanId}`);
    setScannedId(cleanId);
    await loadTemplateById(cleanId, false);
  };

  const addToBasket = (card: KanbanCardMaster) => {
    const itemId = (card.kanbanId || card.id || 'N/A').trim();
    let addedCount = 1;
    const prodName = card.productName || card.productDescription || 'Kanban Item';

    saveBasket((currentBasket) => {
      const existingIndex = currentBasket.findIndex(item => item.id.trim().toLowerCase() === itemId.toLowerCase());
      const updatedBasket = [...currentBasket];

      if (existingIndex > -1) {
        // Increment existing item count
        addedCount = (updatedBasket[existingIndex].basketQty || 1) + 1;
        updatedBasket[existingIndex] = {
          ...updatedBasket[existingIndex],
          card: {
            ...updatedBasket[existingIndex].card,
            ...card,
            productName: card.productName || card.productDescription || updatedBasket[existingIndex].card.productName
          },
          basketQty: addedCount,
          addedAt: new Date().toISOString()
        };
      } else {
        // Add new item
        addedCount = 1;
        updatedBasket.push({
          id: itemId,
          card,
          basketQty: 1,
          addedAt: new Date().toISOString()
        });
      }
      return updatedBasket;
    });

    console.log('Added To Basket:', itemId, 'Count:', addedCount);
    setRecentScanAlert({ productName: prodName, qty: addedCount });
    announce(`✓ Product Added: ${prodName}. Basket quantity: ${addedCount}`);
  };

  const updateBasketItemQty = (id: string, delta: number) => {
    saveBasket((currentBasket) => {
      return currentBasket.map(item => {
        if (item.id === id) {
          const nextQty = Math.max(1, item.basketQty + delta);
          return { ...item, basketQty: nextQty };
        }
        return item;
      });
    });
    announce(`Updated order quantity for ${id}`);
  };

  const removeBasketItem = (id: string) => {
    saveBasket((currentBasket) => {
      const updated = currentBasket.filter(item => item.id !== id);
      if (updated.length === 0) {
        setRecentScanAlert(null);
      }
      return updated;
    });
    announce(`Removed ${id} from order basket.`);
  };

  const clearBasket = () => {
    if (confirm('Are you sure you want to empty the order basket?')) {
      saveBasket([]);
      setRecentScanAlert(null);
      announce('Stock order basket cleared.');
    }
  };

  const loadTemplateById = async (id: string, shouldStopCamera = false) => {
    setScanState('loading');
    setLoadedCard(null);

    let cardToUse: KanbanCardMaster | null = null;

    try {
      // 1. Lookup Product Master
      const masterProduct = productMasterService.lookupProductByIdOrCode(id);
      if (masterProduct) {
        cardToUse = {
          id: masterProduct.id,
          kanbanId: masterProduct.internalProductCode || masterProduct.id,
          productDescription: masterProduct.productName,
          productName: masterProduct.productName,
          imageUrl: masterProduct.productImage || '',
          supplierPartNumber: masterProduct.supplierPartNumber || '',
          supplierName: masterProduct.supplier || '',
          orderQuantity: String(masterProduct.orderQuantity || 1),
          binQuantity: '1 Bin',
          deliveryTime: masterProduct.deliveryTime || 'N/A',
          location: {
            letter: masterProduct.location?.split('-')[0] || 'A',
            number: masterProduct.location?.split('-')[1] || '01',
            colour: masterProduct.locationColour || 'GREEN'
          },
          qrCodeUrl: '',
          activeTemplateId: 'default',
          createdDate: masterProduct.createdAt || '',
          createdBy: masterProduct.createdUser || 'System',
          lastModifiedDate: masterProduct.updatedAt || '',
          lastModifiedBy: masterProduct.updatedUser || 'System',
          status: masterProduct.status === 'Active' ? 'ACTIVE' : 'DISCONTINUED',
          cardColour: masterProduct.cardColour || '#ffffff'
        };
      } else {
        // 2. Lookup Firestore Kanban Cards
        const card = await getKanbanCard(id);
        if (card) {
          cardToUse = card;
        } else {
          // 3. Fallback: local match in kanbanCards
          const localMatch = kanbanCards.find(c => 
            c.cardData?.kanbanId?.toLowerCase() === id.toLowerCase() || 
            c.id?.toLowerCase() === id.toLowerCase() ||
            c.cardData?.partNumber?.toLowerCase() === id.toLowerCase() ||
            c.cardData?.supplierPartNumber?.toLowerCase() === id.toLowerCase()
          );

          if (localMatch) {
            const cardData = localMatch.cardData || {};
            cardToUse = {
              id: localMatch.id,
              kanbanId: cardData.kanbanId || localMatch.id,
              productDescription: cardData.productDescription || cardData.partDescription || 'No description',
              productName: cardData.productName || cardData.productDescription || cardData.partDescription || 'No description',
              imageUrl: cardData.imageUrl || cardData.productImage || '',
              supplierPartNumber: cardData.supplierPartNumber || cardData.partNumber || '',
              supplierName: cardData.supplierName || cardData.supplier || '',
              orderQuantity: cardData.orderQuantity || '1',
              binQuantity: cardData.binQuantity || '1 Bin',
              deliveryTime: cardData.deliveryTime || 'N/A',
              location: {
                letter: cardData.location?.letter || 'A',
                number: cardData.location?.number || '01',
                colour: cardData.location?.colour || 'GREEN'
              },
              qrCodeUrl: '',
              activeTemplateId: localMatch.templateId || '',
              createdDate: cardData.createdDate || '',
              createdBy: cardData.createdBy || '',
              lastModifiedDate: cardData.lastModified || '',
              lastModifiedBy: cardData.lastModifiedBy || '',
              status: cardData.status || 'ACTIVE',
              cardColour: cardData.cardColour || '#ffffff'
            };
          }
        }
      }

      // If card was not found in any database, create a fallback card object
      if (!cardToUse) {
        cardToUse = {
          id: id,
          kanbanId: id,
          productDescription: `Item (${id})`,
          productName: id,
          imageUrl: '',
          supplierPartNumber: id,
          supplierName: 'TS Joinery',
          orderQuantity: '1',
          binQuantity: '1 Bin',
          deliveryTime: 'Immediate',
          location: { letter: 'A', number: '01', colour: 'GREEN' },
          qrCodeUrl: '',
          activeTemplateId: 'default',
          createdDate: new Date().toISOString(),
          createdBy: currentUser?.email || 'Scanner',
          lastModifiedDate: new Date().toISOString(),
          lastModifiedBy: currentUser?.email || 'Scanner',
          status: 'ACTIVE',
          cardColour: '#ffffff'
        };
      }

      setLoadedCard(cardToUse);
      setScanState('success');
      console.log('Product Loaded');

      // Automatically add to basket!
      addToBasket(cardToUse);

      // Open Success Dialog Modal
      setScannedModalProduct({
        id: cardToUse.kanbanId || cardToUse.id || id,
        name: cardToUse.productName || cardToUse.productDescription || id
      });
      setShowScanSuccessModal(true);
      console.log('Dialog Opened');

    } catch (err) {
      console.error('Error loading template:', err);
      setScanState('error');
    } finally {
      if (shouldStopCamera) {
        stopCamera();
      } else {
        setTimeout(() => {
          setScanState('scanning');
        }, 1000);
      }
    }
  };

  const handleNextScan = () => {
    console.log('Waiting For Next Scan');
    setShowScanSuccessModal(false);
    setScanState('scanning');
    if (!isCameraActive) {
      startCamera();
    }
  };

  const handleFinishScan = () => {
    console.log('Waiting For Finish');
    setShowScanSuccessModal(false);
    stopCamera();
    setIsReviewMode(true);
    setTimeout(() => {
      const basketElem = document.getElementById('active-basket-view-card');
      if (basketElem) {
        basketElem.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const cleanId = extractId(manualCode.trim());
    setManualCode('');
    loadTemplateById(cleanId, false);
    if (manualInputRef.current) {
      manualInputRef.current.focus();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanState('loading');
    const tempScanner = new Html5Qrcode('qr-reader-dummy');

    try {
      const decodedText = await tempScanner.scanFile(file, true);
      handleQRCodeScanned(decodedText);
    } catch (err) {
      console.error('File scan error:', err);
      setScanState('error');
      announce('Failed to read QR code from the uploaded file.');
    } finally {
      try {
        tempScanner.clear();
      } catch (e) {}
    }
  };

  const handleSimulatedScan = (card: any) => {
    const cardId = card.cardData?.kanbanId || card.id;
    if (!cardId) return;

    setScanState('loading');
    announce(`Simulating laser scan for QR ${cardId}...`);

    setTimeout(() => {
      handleQRCodeScanned(cardId);
    }, 1000);
  };

  // Automated Send Order flow
  const handleSendOrder = async () => {
    if (basket.length === 0) return;

    const requestedBy = currentUser?.name || currentUser?.email || 'Stock Manager';
    const requestedByUid = currentUser?.id || currentUser?.uid || 'sm_001';
    const requestedByRole = currentUser?.role || 'Stock Manager';
    const branchId = currentUser?.branchId || 'BR-01';
    const branchName = currentUser?.branch || 'TS Joinery Main Workshop';

    try {
      // 1. Build StockRequestItems
      const requestItems: StockRequestItem[] = basket.map(item => ({
        productId: item.id,
        productName: item.card.productName || item.card.productDescription || 'No description',
        quantity: item.basketQty,
        supplier: item.card.supplierName || 'N/A',
        supplierPartNumber: item.card.supplierPartNumber || 'N/A',
        location: `${item.card.location?.letter || ''}${item.card.location?.number || ''}${item.card.location?.colour ? ` (${item.card.location.colour})` : ''}`,
        imageUrl: item.card.imageUrl || ''
      }));

      // 2. Create Stock Request in Firebase and trigger 1 notification
      const stockReq = await stockRequestService.createStockRequest({
        requestedByUid,
        requestedByName: requestedBy,
        requestedByRole,
        branchId,
        branchName,
        items: requestItems
      });

      const orderId = stockReq.requestNumber;

      // 3. Log Audit Records for every scanned item in the basket
      for (const item of basket) {
        const itemDesc = item.card.productName || item.card.productDescription;
        await auditLogger.log(
          'STOCK_ORDER_BASKET_SUBMITTED',
          requestedBy,
          `Stock order request ${orderId} submitted for ${item.id} - ${itemDesc}. Quantity: ${item.basketQty}x`
        );
      }

      // 4. Update state & open confirmation modal
      setLastSubmittedOrderId(orderId);
      setOrderSuccessModal(true);
      setIsReviewMode(false);
      
      // Clear local storage and state basket
      saveBasket([]);
      setRecentScanAlert(null);
      
      announce(`Stock Request ${orderId} submitted successfully.`);
    } catch (err) {
      console.error('Error submitting stock request:', err);
      announce('Failed to submit stock request to cloud database.');
    }
  };

  const getColourBg = (colour?: string) => {
    if (!colour) return 'bg-gray-500/20';
    const c = colour.toLowerCase().trim();
    if (c === 'red') return 'bg-red-500 text-white';
    if (c === 'blue') return 'bg-blue-500 text-white';
    if (c === 'green') return 'bg-emerald-500 text-black font-black';
    if (c === 'yellow') return 'bg-yellow-400 text-black font-black';
    if (c === 'orange') return 'bg-orange-500 text-white';
    if (c === 'pink') return 'bg-pink-500 text-white';
    if (c === 'purple') return 'bg-purple-500 text-white';
    return 'bg-gray-600 text-white';
  };

  return (
    <div className="space-y-8 font-sans max-w-7xl mx-auto" id="qr-scan-service-container">
      {isReviewMode ? (
        <div className="space-y-8 animate-in fade-in duration-300" id="order-review-screen-container">
          {/* Header Area */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                <span className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
                  <Icon name="shopping-cart" size={24} />
                </span>
                Order Review Screen
              </h2>
              <p className="text-xs text-gray-400 mt-1.5 max-w-xl font-sans">
                Review and adjust quantities of scanned products before submitting the consolidated replenishment order to procurement.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setIsReviewMode(false);
                  startCamera();
                }}
                className="py-3 px-6 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2"
              >
                <Icon name="scan" size={14} />
                <span>Continue Scanning</span>
              </button>

              {onClose && (
                <button 
                  onClick={onClose} 
                  className="py-3 px-6 bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  Back to Dashboard
                </button>
              )}
            </div>
          </div>

          {/* Main Review Layout */}
          <div className="bg-[#151515]/90 border border-white/10 rounded-[3rem] p-6 md:p-8 space-y-6 shadow-2xl backdrop-blur-3xl">
            
            {/* Basket List Content */}
            {basket.length === 0 ? (
              <div className="py-24 text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mx-auto text-gray-600">
                  <Icon name="shopping-bag" size={32} />
                </div>
                <div className="space-y-2 max-w-sm mx-auto">
                  <p className="text-base font-black uppercase tracking-widest text-gray-400">Your Basket is Empty</p>
                  <p className="text-xs text-gray-500 font-sans leading-relaxed">
                    You haven't scanned any products yet. Go back to scanning mode to register items automatically.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsReviewMode(false);
                    startCamera();
                  }}
                  className="py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Go to Scanner
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Table / Row list for Order Review */}
                <div className="divide-y divide-white/5 space-y-6">
                  {basket.map((item) => {
                    const c = item.card;
                    return (
                      <div 
                        key={item.id} 
                        className="pt-6 first:pt-0 flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between group animate-in fade-in duration-200"
                      >
                        {/* Product Thumbnail and Basic Info (Image, Name, Supplier, Supplier Number) */}
                        <div className="flex gap-5 items-center flex-1 min-w-0">
                          {/* 1. Product Image */}
                          <div className="w-20 h-20 rounded-2xl bg-black/50 border border-white/15 overflow-hidden shrink-0 flex items-center justify-center relative shadow-inner">
                            {c.imageUrl ? (
                              <img src={c.imageUrl} alt={c.productName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <Icon name="package" size={24} className="text-gray-600" />
                            )}
                            <span className={`absolute bottom-0 inset-x-0 h-2 ${getColourBg(c.location?.colour)}`} />
                          </div>

                          {/* Title & primary properties */}
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-lg tracking-wider">
                                KANBAN ID: {item.id}
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 font-sans uppercase">
                                {c.binQuantity || '1 Bin'} Configuration
                              </span>
                            </div>

                            {/* 2. Product Name */}
                            <h4 className="text-base font-black text-white uppercase tracking-tight leading-snug">
                              {c.productName || c.productDescription}
                            </h4>

                            {/* 3. Supplier & 4. Supplier Number */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-0.5">
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <span className="font-bold uppercase text-[9px] text-gray-500">Supplier:</span>
                                <span className="text-white font-medium truncate">{c.supplierName || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <span className="font-bold uppercase text-[9px] text-gray-500">Supplier Number:</span>
                                <span className="text-white font-mono truncate">{c.supplierPartNumber || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Explicit Grid specifications (Order Qty, Bin Qty, Delivery Time, Warehouse Location) */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 w-full xl:w-auto xl:min-w-[480px]">
                          
                          {/* 5. Requested Quantity */}
                          <div className="flex flex-col justify-center">
                            <span className="text-[9px] font-black uppercase text-purple-400 tracking-wider">Requested Qty</span>
                            <span className="text-base font-black text-white font-mono mt-0.5">
                              x{item.basketQty}
                            </span>
                          </div>

                          {/* 6. Order Quantity */}
                          <div className="flex flex-col justify-center border-l border-white/5 pl-4 sm:pl-3">
                            <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Order Qty</span>
                            <span className="text-xs font-bold text-white mt-1">
                              {c.orderQuantity || 'N/A'}
                            </span>
                          </div>

                          {/* 7. Bin Quantity */}
                          <div className="flex flex-col justify-center border-l border-white/5 pl-4 sm:pl-3">
                            <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Bin Config</span>
                            <span className="text-xs font-bold text-white mt-1">
                              {c.binQuantity || '1 Bin'}
                            </span>
                          </div>

                          {/* 8. Delivery Time */}
                          <div className="flex flex-col justify-center border-l border-white/5 pl-4 sm:pl-3">
                            <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Delivery Lead</span>
                            <span className="text-xs font-bold text-white mt-1 truncate" title={c.deliveryTime}>
                              {c.deliveryTime || 'N/A'}
                            </span>
                          </div>

                        </div>

                        {/* Rightmost column: Warehouse Location, Quantity Controls and Trash (Buttons: Increase, Decrease, Remove) */}
                        <div className="flex flex-col sm:flex-row xl:flex-col items-stretch sm:items-center xl:items-end justify-between xl:justify-center gap-4 w-full xl:w-auto shrink-0 border-t xl:border-t-0 border-white/5 pt-4 xl:pt-0">
                          
                          {/* 9. Warehouse Location with Colour Indicator */}
                          <div className="flex items-center gap-2 xl:justify-end">
                            <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Location:</span>
                            <div className="flex items-center gap-1.5 bg-black/40 border border-white/15 px-2.5 py-1 rounded-lg">
                              <span className={`w-2.5 h-2.5 rounded-full ${getColourBg(c.location?.colour)} shrink-0`} />
                              <span className="text-xs font-black text-white font-mono">
                                {c.location?.letter || 'N/A'}{c.location?.number || ''}
                              </span>
                            </div>
                          </div>

                          {/* Controls Container */}
                          <div className="flex items-center gap-3 justify-end">
                            
                            {/* Decrease button */}
                            <button
                              onClick={() => updateBasketItemQty(item.id, -1)}
                              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/20 text-white font-black text-lg flex items-center justify-center transition-all active:scale-90"
                              title="Decrease Quantity"
                            >
                              -
                            </button>

                            {/* Requested Qty Display */}
                            <div className="bg-black/60 border border-white/15 rounded-xl px-4 py-2 text-center min-w-[64px]">
                              <span className="text-xs font-black text-white font-mono block">
                                x{item.basketQty}
                              </span>
                              <span className="text-[8px] uppercase font-black tracking-widest text-gray-500 block">Qty</span>
                            </div>

                            {/* Increase button */}
                            <button
                              onClick={() => updateBasketItemQty(item.id, 1)}
                              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/20 text-white font-black text-lg flex items-center justify-center transition-all active:scale-90"
                              title="Increase Quantity"
                            >
                              +
                            </button>

                            {/* Remove button */}
                            <button
                              onClick={() => removeBasketItem(item.id)}
                              className="w-10 h-10 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 flex items-center justify-center rounded-xl transition-all"
                              title="Remove from Basket"
                            >
                              <Icon name="trash-2" size={16} />
                            </button>

                          </div>

                        </div>

                      </div>
                    );
                  })}
                </div>

                {/* Order Aggregates summary panel */}
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-6 mt-8">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Total Scanned Types</span>
                      <span className="text-xl font-black text-white block mt-1 leading-none">{basket.length} Products</span>
                    </div>
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Total Consolidations</span>
                      <span className="text-xl font-black text-purple-400 block mt-1 leading-none">
                        {basket.reduce((acc, curr) => acc + curr.basketQty, 0)} Bins
                      </span>
                    </div>
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Target Mail Recipient</span>
                      <span className="text-xs font-black text-emerald-400 block mt-2 leading-none font-mono truncate">janah@tsjoinery.co.za</span>
                    </div>
                  </div>

                  {/* Main Action Bar (Buttons: Clear Basket, Continue Scanning, Send Order) */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
                    {/* Clear Basket Button */}
                    <button
                      onClick={clearBasket}
                      className="w-full md:w-auto py-3.5 px-6 bg-red-600/15 hover:bg-red-600/20 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shrink-0"
                    >
                      <Icon name="trash-2" size={14} />
                      Clear Basket
                    </button>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      {/* Continue Scanning Button */}
                      <button
                        onClick={() => {
                          setIsReviewMode(false);
                          startCamera();
                        }}
                        className="w-full sm:w-auto py-3.5 px-6 bg-white/5 hover:bg-white/10 border border-white/15 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Icon name="scan" size={14} className="text-purple-400" />
                        Continue Scanning
                      </button>

                      {/* Send Order Button */}
                      <button
                        onClick={handleSendOrder}
                        className="w-full sm:w-auto py-3.5 px-8 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Icon name="check" size={14} />
                        Send Order ({basket.reduce((acc, curr) => acc + curr.basketQty, 0)} Items)
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>

          {/* Success confirmation modal render */}
          {orderSuccessModal && (
            <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className="bg-[#151515] border border-white/10 w-full max-w-md rounded-[3rem] p-8 text-center space-y-6 shadow-2xl overflow-hidden relative">
                <div className="w-20 h-20 bg-emerald-500 text-black border border-emerald-400/20 rounded-full flex items-center justify-center text-3xl font-black mx-auto shadow-[0_0_35px_theme(colors.emerald.500/50)] animate-bounce mt-4">
                  ✓
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest block font-mono">
                    Order ID: {lastSubmittedOrderId}
                  </span>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white leading-none">
                    Stock Order Dispatched
                  </h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed font-sans">
                    The consolidated Kanban replenishment batch has been saved to Firebase Firestore under historical procurement logs. The mail client has loaded the template prefill.
                  </p>
                </div>
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-[11px] text-gray-400 font-sans leading-relaxed text-left space-y-1">
                  <div className="flex justify-between">
                    <span className="font-bold text-gray-500">Destination Account:</span>
                    <span className="font-mono text-white">janah@tsjoinery.co.za</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-gray-500">Procurement Status:</span>
                    <span className="text-emerald-400 font-black">Logged & Synced ✓</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setOrderSuccessModal(false);
                    setScanState('idle');
                    setLoadedCard(null);
                    setScannedId('');
                    setIsReviewMode(false); // return to scanning layout
                    startCamera();
                  }}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase text-xs tracking-widest rounded-2xl transition-all shadow-lg active:scale-95"
                >
                  Continue Scanning
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Header Area */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                <span className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
                  <Icon name="scan" size={24} />
                </span>
                QR Stock Scanner & Basket
              </h2>
              <p className="text-xs text-gray-400 mt-1.5 max-w-xl font-sans">
                Scan physical tags to instantly build your procurement stock basket. The active basket is stored locally and survives browser refreshes automatically.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {basket.length > 0 && (
                <button
                  onClick={() => {
                    setIsReviewMode(true);
                    stopCamera();
                  }}
                  className="py-3 px-5 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2"
                >
                  <Icon name="shopping-cart" size={14} />
                  <span>Review Order ({basket.reduce((acc, curr) => acc + curr.basketQty, 0)})</span>
                </button>
              )}

              {onClose && (
                <button 
                  onClick={onClose} 
                  className="py-3 px-6 bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  Back to Dashboard
                </button>
              )}
            </div>
          </div>

      {/* Success Alert Banner (✓ Product Added Toast Overlay) */}
      {recentScanAlert && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-emerald-500 text-black rounded-lg font-black shrink-0">
              ✓
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-400">✓ Product Added</p>
              <p className="text-sm font-bold text-white font-sans mt-0.5">{recentScanAlert.productName} (Requested: x{recentScanAlert.qty})</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setRecentScanAlert(null);
                startCamera();
              }}
              className="py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
            >
              Continue Scanning
            </button>
            <button
              onClick={() => setRecentScanAlert(null)}
              className="p-2 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Rapid Manual / Bluetooth Barcode Scanner Input */}
      <div className="bg-purple-950/30 border border-purple-500/30 rounded-3xl p-5 shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-2 font-sans">Continuous Rapid Scanner / Manual Code Entry</p>
        <form onSubmit={handleManualSubmit} className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400">
              <Icon name="scan" size={18} />
            </span>
            <input
              ref={manualInputRef}
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Scan or type Kanban ID / Part Number..."
              className="w-full bg-black/60 border border-purple-500/30 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-white placeholder-gray-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
            />
          </div>
          <button
            type="submit"
            className="py-3.5 px-6 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shrink-0 active:scale-95 shadow-lg flex items-center gap-2"
          >
            <Icon name="plus" size={16} />
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Scanning Hardware Controls (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          
      {/* Custom CSS overrides to ensure camera feed is NOT mirrored and fills container */}
      <style>{`
        #qr-reader-element {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          padding: 0 !important;
          position: absolute !important;
          inset: 0 !important;
        }
        #qr-reader-element video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          transform: none !important;
          -webkit-transform: none !important;
          border-radius: 0 !important;
        }
        #qr-reader-element canvas {
          display: none !important;
        }
        #qr-reader-element img {
          display: none !important;
        }
        #qr-reader-element__scan_region {
          width: 100% !important;
          height: 100% !important;
        }
        #qr-reader-element__dashboard {
          display: none !important;
        }
      `}</style>

      {/* Live Video camera */}
      <div className="bg-black/40 border border-white/10 rounded-3xl p-6 relative overflow-hidden">
        <h3 className="text-sm font-black uppercase tracking-wider text-gray-300 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Integrated Camera Reader
        </h3>

        <div className="relative w-full h-[380px] sm:h-[460px] bg-black border border-white/5 rounded-2xl overflow-hidden flex items-center justify-center">
              <div 
                id={videoContainerId} 
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isCameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              />

              {!isCameraActive && (
                <div className="text-center p-6 space-y-4 z-10">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-purple-400">
                    <Icon name="camera" size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-wider text-gray-300">Camera Terminal Ready</p>
                    <p className="text-[11px] text-gray-500 max-w-xs mx-auto leading-relaxed">
                      Initialize your webcam hardware to scan printed QR tags on items.
                    </p>
                  </div>
                  <button
                    onClick={startCamera}
                    className="py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 mx-auto active:scale-95 shadow-lg"
                  >
                    <Icon name="camera" size={14} />
                    Start Camera
                  </button>
                </div>
              )}

              {/* Scanning laser line indicator */}
              {isCameraActive && scanState === 'scanning' && (
                <div className="absolute inset-x-0 h-1 bg-purple-400 shadow-[0_0_20px_theme(colors.purple.400)] pointer-events-none z-20" style={{ animation: 'scan 2.5s linear infinite' }} />
              )}

              {isCameraActive && (
                <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
                  <button
                    onClick={toggleTorch}
                    className={`py-2 px-3 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 active:scale-95 ${
                      isTorchOn ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30' : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                    }`}
                    title="Toggle camera flashlight / torch"
                  >
                    <Icon name="zap" size={14} />
                    <span>{isTorchOn ? 'Torch ON' : 'Torch OFF'}</span>
                  </button>
                  <button
                    onClick={stopCamera}
                    className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all active:scale-95"
                  >
                    Stop Camera
                  </button>
                </div>
              )}
            </div>

            {cameraError && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-red-400 leading-relaxed flex gap-2">
                <Icon name="shield-alert" size={16} className="shrink-0 text-red-400 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}
          </div>

          {/* Upload QR File */}
          <div className="bg-black/40 border border-white/10 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-300 flex items-center gap-2">
              <Icon name="file-text" size={16} className="text-purple-400" />
              Upload QR Image File
            </h3>
            <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
              No physical scanner linked? Save a generated card QR, drag it here, or upload to instantly decode.
            </p>

            <label className="border-2 border-dashed border-white/10 hover:border-purple-500/40 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white/5 transition-all text-center group">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="hidden" 
              />
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Icon name="file-down" size={20} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-gray-300">Choose QR image tag</span>
              <span className="text-[10px] text-gray-500 font-sans font-medium">Supports PNG, JPG, WebP</span>
            </label>

            <div id="qr-reader-dummy" className="hidden" />
          </div>

          {/* Simulated scanning laser terminal list */}
          <div className="bg-black/40 border border-white/10 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-300 flex items-center gap-2">
              <Icon name="refresh-cw" size={16} className="text-purple-400 animate-spin-slow" />
              Scan Simulator List
            </h3>
            <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
              Sandbox testbed: Click any active card item from the database below. This triggers an automated scan emulation to test the basket adding instantly.
            </p>

            {kanbanCards.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No Kanban Job cards loaded. Create cards first in the Kanban Creator tab.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {kanbanCards.map((card) => {
                  const cardId = card.cardData?.kanbanId || card.id;
                  const desc = card.cardData?.productName || card.cardData?.productDescription || card.cardData?.partDescription || 'N/A';
                  return (
                    <button
                      key={card.id}
                      onClick={() => handleSimulatedScan(card)}
                      className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-purple-500/10 border border-white/5 hover:border-purple-500/30 flex justify-between items-center transition-all group active:scale-[0.98]"
                    >
                      <div className="truncate pr-4">
                        <span className="text-[10px] font-black uppercase text-purple-400 block tracking-wider font-mono">{cardId}</span>
                        <span className="text-xs text-white group-hover:text-purple-200 transition-colors truncate block mt-0.5">{desc}</span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1 group-hover:bg-purple-500 group-hover:text-black transition-all">
                        <Icon name="arrow-right" size={10} />
                        Scan
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Loading States / ACTIVE STOCK ORDER BASKET (7 Columns) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Awaiting scanning / Loading / Error Display */}
          {scanState === 'loading' && (
            <div className="border border-white/10 rounded-3xl bg-black/40 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden h-52">
              <div className="absolute inset-x-0 h-1 bg-purple-500/80 shadow-[0_0_25px_theme(colors.purple.500)] pointer-events-none z-20" style={{ animation: 'scan 2s linear infinite' }} />
              <div className="space-y-4 max-w-sm z-10">
                <div className="w-10 h-10 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 animate-pulse font-mono">
                    Querying Cloud Database...
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Locating the master card information & appending record payload to local basket.
                  </p>
                </div>
              </div>
            </div>
          )}

          {scanState === 'error' && (
            <div className="border border-red-500/20 rounded-3xl bg-red-500/5 flex flex-col items-center justify-center p-6 text-center space-y-3 h-52 animate-in fade-in">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                <Icon name="shield-alert" size={20} />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-xs font-black uppercase tracking-wider text-red-500">Kanban Template Not Found</h3>
                <p className="text-[11px] text-red-400/80 font-sans leading-relaxed">
                  Scanned barcode does not correspond to an active template in Firestore. Ensure card belongs to TS Joinery databases.
                </p>
              </div>
              <button
                onClick={() => setScanState('idle')}
                className="py-1.5 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-black uppercase text-white transition-all tracking-wider"
              >
                Clear Error
              </button>
            </div>
          )}

          {/* ACTIVE STOCK ORDER BASKET VIEW CONTAINER */}
          <div 
            id="active-basket-view-card"
            className="border border-white/10 rounded-3xl bg-black/40 overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Basket Header */}
            <div className="p-6 bg-gradient-to-r from-purple-900/20 to-zinc-900/20 border-b border-white/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-purple-500 text-black rounded-xl shrink-0 text-sm font-black">
                  <Icon name="shopping-cart" size={18} />
                </span>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                    Stock Order Basket
                  </h3>
                  <p className="text-[11px] text-gray-400 font-sans leading-none mt-1">
                    Saved locally in browser. Will survive tab closing & page refreshes.
                  </p>
                </div>
              </div>

              {basket.length > 0 && (
                <button
                  onClick={clearBasket}
                  className="py-2 px-3 hover:bg-red-500/10 hover:text-red-400 text-gray-500 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5"
                >
                  <Icon name="trash-2" size={12} />
                  Clear Basket
                </button>
              )}
            </div>

            {/* Basket List Content */}
            <div className="p-6 divide-y divide-white/5 space-y-4 max-h-[580px] overflow-y-auto custom-scrollbar">
              {basket.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mx-auto text-gray-600">
                    <Icon name="shopping-bag" size={28} />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400">Basket is Empty</p>
                    <p className="text-[11px] text-gray-500 font-sans leading-relaxed">
                      Scan product codes or trigger simulated scans on the left to queue items for the consolidated order batch.
                    </p>
                  </div>
                </div>
              ) : (
                basket.map((item) => {
                  const c = item.card;
                  const itemTotalUnits = item.basketQty;
                  return (
                    <div key={item.id} className="pt-4 first:pt-0 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group animate-in fade-in duration-200">
                      
                      {/* Product details thumbnail & info */}
                      <div className="flex gap-4 items-center flex-1 min-w-0">
                        {/* Thumbnail image */}
                        <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/15 overflow-hidden shrink-0 flex items-center justify-center relative">
                          {c.imageUrl ? (
                            <img src={c.imageUrl} alt={c.productName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          ) : (
                            <Icon name="package" size={20} className="text-gray-600" />
                          )}
                          
                          {/* Warehouse Location letter color code border */}
                          <span className={`absolute bottom-0 inset-x-0 h-1.5 ${getColourBg(c.location?.colour)}`} />
                        </div>

                        {/* Title, desc & location details */}
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold font-mono text-purple-400 bg-purple-500/10 border border-purple-500/10 px-1.5 py-0.5 rounded">
                              {item.id}
                            </span>
                            <span className="text-[10px] font-medium text-gray-400">
                              Location: {c.location?.letter || 'N/A'}{c.location?.number || 'N/A'}
                            </span>
                          </div>

                          <h4 className="text-sm font-black text-white uppercase tracking-tight truncate leading-tight">
                            {c.productName || c.productDescription}
                          </h4>

                          {/* Secondary info line */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500 font-sans">
                            <span className="truncate">Supplier: {c.supplierName}</span>
                            <span>•</span>
                            <span className="truncate">Part: {c.supplierPartNumber}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right actions: Qty controls, item specs & Delete */}
                      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-white/5 pt-3 md:pt-0 shrink-0">
                        
                        {/* Static card packaging specifications */}
                        <div className="text-left md:text-right hidden sm:block">
                          <p className="text-[10px] text-gray-400 font-black uppercase">Qty Per Order</p>
                          <p className="text-xs font-bold text-white font-sans mt-0.5">
                            {c.orderQuantity || 'N/A'} <span className="text-[9px] text-gray-500 font-mono">({c.binQuantity || '1 Bin'})</span>
                          </p>
                        </div>

                        {/* Requested Quantity */}
                        <div className="text-left md:text-right min-w-[70px]">
                          <p className="text-[10px] text-purple-400 font-black uppercase tracking-wider">Requested</p>
                          <p className="text-sm font-black text-white font-mono mt-0.5">
                            x{item.basketQty}
                          </p>
                        </div>

                        {/* Quantity Counter multiplier */}
                        <div className="flex items-center bg-black/60 border border-white/10 rounded-xl p-1 shrink-0">
                          <button
                            onClick={() => updateBasketItemQty(item.id, -1)}
                            className="w-7 h-7 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white flex items-center justify-center font-bold text-xs transition-colors"
                            title="Decrease Multiplier"
                          >
                            -
                          </button>
                          
                          <span className="px-3 text-xs font-black text-white font-mono min-w-[28px] text-center" title="Requested Quantity">
                            x{item.basketQty}
                          </span>

                          <button
                            onClick={() => updateBasketItemQty(item.id, 1)}
                            className="w-7 h-7 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white flex items-center justify-center font-bold text-xs transition-colors"
                            title="Increase Multiplier"
                          >
                            +
                          </button>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={() => removeBasketItem(item.id)}
                          className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 flex items-center justify-center rounded-xl transition-all"
                          title="Remove item"
                        >
                          <Icon name="trash-2" size={14} />
                        </button>

                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Basket Footer Summary + Action Button */}
            {basket.length > 0 && (
              <div className="p-6 bg-black/40 border-t border-white/10 space-y-4">
                
                {/* Mathematical aggregates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 flex flex-col">
                    <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Total Products</span>
                    <span className="text-xl font-black text-white mt-1 leading-none">
                      {basket.length}
                    </span>
                  </div>

                  <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 flex flex-col">
                    <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Total Quantity</span>
                    <span className="text-xl font-black text-[#ff8c00] mt-1 leading-none">
                      {basket.reduce((acc, curr) => acc + curr.basketQty, 0)}
                    </span>
                  </div>
                </div>

                {/* Basket Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    onClick={() => setIsReviewMode(false)}
                    className="w-full sm:w-1/3 py-3.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all border border-white/10 flex items-center justify-center gap-2"
                  >
                    <Icon name="scan" size={14} />
                    <span>Continue Scanning</span>
                  </button>

                  <button
                    onClick={clearBasket}
                    className="w-full sm:w-1/3 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all border border-red-500/20 flex items-center justify-center gap-2"
                  >
                    <Icon name="trash-2" size={14} />
                    <span>Clear Basket</span>
                  </button>

                  <button
                    onClick={handleSendOrder}
                    className="w-full sm:w-1/3 py-3.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-xl active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    <Icon name="check" size={14} />
                    <span>Submit Stock Request</span>
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </>)}

      {/* SUCCESS ORDER CONFIRMATION POPUP MODAL */}
      {orderSuccessModal && (
        <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#151515] border border-white/10 w-full max-w-md rounded-[3rem] p-8 text-center space-y-6 shadow-2xl overflow-hidden relative font-sans">
            
            {/* Pulsing visual checks */}
            <div className="w-20 h-20 bg-emerald-500 text-black border border-emerald-400/20 rounded-full flex items-center justify-center text-3xl font-black mx-auto shadow-[0_0_35px_theme(colors.emerald.500/50)] animate-bounce mt-4">
              ✓
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black uppercase text-[#ff8c00] tracking-widest block font-mono">
                Request Number: {lastSubmittedOrderId}
              </span>
              <h3 className="text-xl font-black uppercase tracking-tight text-white leading-tight">
                Stock Request Submitted Successfully
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed font-sans">
                Your stock request has been saved to Firebase and sent to Janah/Purchasing for review.
              </p>
            </div>

            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-[11px] text-gray-400 font-sans leading-relaxed text-left space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-gray-500">Destination Account:</span>
                <span className="font-mono text-white">janah@tsjoinery.co.za</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-gray-500">Procurement Status:</span>
                <span className="text-emerald-400 font-black">Logged & Synced ✓</span>
              </div>
            </div>

            <button
              onClick={() => {
                setOrderSuccessModal(false);
                setScanState('idle');
                setLoadedCard(null);
                setScannedId('');
                startCamera();
              }}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase text-xs tracking-widest rounded-2xl transition-all shadow-lg active:scale-95"
            >
              Continue Scanning
            </button>

          </div>
        </div>
      )}

      {/* IMMEDIATE QR SCANNED SUCCESS DIALOG MODAL */}
      {showScanSuccessModal && scannedModalProduct && (
        <div className="fixed inset-0 z-[3000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 font-sans">
          <div className="bg-[#151518] border border-emerald-500/30 w-full max-w-sm rounded-[2.5rem] p-6 text-center space-y-6 shadow-2xl relative overflow-hidden">
            
            {/* Emerald Success Check Icon */}
            <div className="w-16 h-16 bg-emerald-500 text-black border border-emerald-400/30 rounded-full flex items-center justify-center text-3xl font-black mx-auto shadow-[0_0_30px_theme(colors.emerald.500/40)] animate-bounce mt-2">
              ✓
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-black uppercase tracking-tight text-emerald-400 font-sans">
                QR scanned successfully
              </h3>

              <div className="bg-black/60 border border-white/10 rounded-2xl p-4 text-left space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 font-mono">
                  Product:
                </p>
                <p className="text-base font-black text-white font-mono break-all leading-snug">
                  {scannedModalProduct.name}
                </p>
                {scannedModalProduct.id !== scannedModalProduct.name && (
                  <p className="text-[11px] font-bold text-purple-400 font-mono pt-1">
                    Code: {scannedModalProduct.id}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleNextScan}
                className="flex-1 py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Icon name="scan" size={14} />
                <span>Next Scan</span>
              </button>

              <button
                onClick={handleFinishScan}
                className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Icon name="check" size={14} />
                <span>Finish</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
