import React, { useState, useRef } from 'react';
import { QRCodeRenderer } from './QRCodeRenderer';
import { Icon } from './Icon';
import { APP_MOBILE_LINK } from '../firebase';

export interface MobileDeploymentViewProps {
  currentUser?: any;
  announce?: (message: string) => void;
  productionUrl?: string;
}

export const MobileDeploymentView: React.FC<MobileDeploymentViewProps> = ({
  currentUser,
  announce,
  productionUrl = APP_MOBILE_LINK || 'https://timbersmith-terminal.netlify.app/'
}) => {
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'clocking_tablet' | 'specs'>('android');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedClockingEmail, setCopiedClockingEmail] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(productionUrl);
      setCopiedUrl(true);
      announce?.('Production PWA URL copied to clipboard');
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleCopyClockingEmail = async () => {
    try {
      await navigator.clipboard.writeText('clocking@tsjoinery.co.za');
      setCopiedClockingEmail(true);
      announce?.('Clocking terminal account email copied');
      setTimeout(() => setCopiedClockingEmail(false), 2500);
    } catch (err) {
      console.error('Failed to copy email:', err);
    }
  };

  const handleDownloadQr = () => {
    try {
      // Find SVG inside QR container
      const svg = printRef.current?.querySelector('svg');
      if (!svg) {
        announce?.('Unable to generate QR image at this moment.');
        return;
      }

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        if (!ctx) return;
        // Draw white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Draw QR
        ctx.drawImage(img, 40, 40, 520, 520);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = 'tshub-production-pwa-qr.png';
        downloadLink.href = pngFile;
        downloadLink.click();
        announce?.('Downloaded TS Hub QR code image.');
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (err) {
      console.error('Download QR failed:', err);
      announce?.('Downloaded QR code.');
    }
  };

  const handlePrintCard = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the deployment card.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>TS Hub - Mobile Deployment Card</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: 40px;
              color: #111;
              text-align: center;
              background: #fff;
            }
            .card {
              border: 2px solid #222;
              border-radius: 24px;
              padding: 32px;
              max-width: 500px;
              margin: 0 auto;
            }
            h1 {
              font-size: 24px;
              text-transform: uppercase;
              letter-spacing: 2px;
              margin-bottom: 4px;
            }
            p.sub {
              font-size: 13px;
              color: #666;
              margin-top: 0;
              margin-bottom: 24px;
              text-transform: uppercase;
              font-weight: bold;
              letter-spacing: 1px;
            }
            .qr-box {
              width: 260px;
              height: 260px;
              margin: 0 auto 20px;
            }
            .url {
              font-family: monospace;
              font-size: 13px;
              font-weight: bold;
              background: #f1f1f1;
              padding: 8px 12px;
              border-radius: 8px;
              display: inline-block;
              word-break: break-all;
              margin-bottom: 24px;
            }
            .instructions {
              text-align: left;
              border-top: 1px solid #ddd;
              padding-top: 16px;
              font-size: 12px;
              line-height: 1.6;
            }
            .instructions ol {
              margin: 0;
              padding-left: 20px;
            }
            .instructions li {
              margin-bottom: 6px;
            }
            .kiosk-badge {
              background: #fff3e0;
              border: 1px solid #ffe0b2;
              padding: 8px;
              border-radius: 8px;
              margin-top: 12px;
              font-size: 11px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>TIMBERSMITH HUB</h1>
            <p class="sub">Production Mobile PWA Deployment</p>
            <div class="qr-box">
              ${printRef.current ? printRef.current.innerHTML : ''}
            </div>
            <div class="url">${productionUrl}</div>
            <div class="instructions">
              <strong>1. ANDROID INSTALLATION:</strong>
              <ol>
                <li>Open Camera app on phone or tablet and scan QR code.</li>
                <li>Tap the link to open in Google Chrome.</li>
                <li>Tap <strong>Install</strong> or Chrome Menu (⋮) → <strong>Add to Home screen</strong>.</li>
                <li>Launch TS Hub directly from Home Screen.</li>
              </ol>
              <strong style="margin-top: 10px; display: block;">2. APPLE (iPhone & iPad) INSTALLATION:</strong>
              <ol>
                <li>Open Camera app on iPhone/iPad and scan QR code.</li>
                <li>Open in Safari and tap the <strong>Share</strong> button (box with arrow).</li>
                <li>Select <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
              </ol>
              <div class="kiosk-badge">
                <strong>CLOCKING TABLET:</strong> Sign in with <code>clocking@tsjoinery.co.za</code> to automatically launch the full-screen Clocking Kiosk.
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-cyan-950/40 via-neutral-900 to-neutral-900 border border-cyan-500/20 rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
              <Icon name="smartphone" size={20} />
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400 font-mono">
              Production PWA Distribution
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-tight text-white">
            Mobile Deployment
          </h1>
          <p className="text-xs text-gray-400 max-w-2xl">
            Install TS Hub on Android phones, workshop tablets, and dedicated clocking kiosks. Fast, reliable progressive web app with offline caching and hardware scanner support.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            PWA LIVE & DEPLOYED
          </span>
        </div>
      </div>

      {/* Main Grid: QR Card on left, Instruction Guides on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Central QR Code Card */}
        <div className="lg:col-span-5 bg-neutral-900/90 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col items-center text-center shadow-xl space-y-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block font-mono">
              Scan To Install TS Hub
            </span>
            <h2 className="text-lg font-black uppercase tracking-tight text-white mt-1">
              Device Installation QR
            </h2>
          </div>

          {/* Large High-Contrast QR Code Card */}
          <div 
            ref={printRef}
            className="bg-white p-5 rounded-3xl shadow-2xl border-4 border-white/10 flex items-center justify-center w-64 h-64 md:w-72 md:h-72"
          >
            <QRCodeRenderer 
              text={productionUrl} 
              width={240} 
              height={240} 
              responsive={false} 
              className="w-full h-full object-contain"
            />
          </div>

          {/* Production Destination URL */}
          <div className="w-full space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
              TS Hub PWA Production URL
            </span>
            <div className="bg-black/60 border border-white/10 rounded-2xl p-3 flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-cyan-300 truncate select-all">
                {productionUrl}
              </span>
              <button
                onClick={handleCopyUrl}
                title="Copy production URL"
                className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
              >
                <Icon name={copiedUrl ? "check" : "copy"} size={13} className={copiedUrl ? "text-emerald-400" : "text-gray-300"} />
                <span className="text-[10px] uppercase font-mono">{copiedUrl ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleDownloadQr}
              className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-wider text-gray-200 transition-all flex items-center justify-center gap-2 hover:border-cyan-500/30"
            >
              <Icon name="download" size={15} className="text-cyan-400" />
              <span>Download QR</span>
            </button>
            <button
              onClick={handlePrintCard}
              className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-wider text-gray-200 transition-all flex items-center justify-center gap-2 hover:border-cyan-500/30"
            >
              <Icon name="printer" size={15} className="text-cyan-400" />
              <span>Print Poster</span>
            </button>
          </div>

          <div className="p-3.5 bg-cyan-950/30 border border-cyan-500/20 rounded-2xl text-left w-full">
            <p className="text-[11px] text-cyan-300 leading-relaxed">
              💡 <strong>Production Note:</strong> This QR code links directly to the production web app. Point any Android camera or tablet barcode reader at the code to start installation.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Installation Guides & Step-by-Step Instructions */}
        <div className="lg:col-span-7 bg-neutral-900/90 border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
          {/* Navigation Tabs */}
          <div className="flex border-b border-white/10 gap-2 pb-3 overflow-x-auto">
            <button
              onClick={() => setActiveTab('android')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'android'
                  ? 'bg-cyan-500 text-black shadow-lg'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon name="smartphone" size={16} />
              <span>Android Phone / Tablet</span>
            </button>
            <button
              onClick={() => setActiveTab('ios')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'ios'
                  ? 'bg-sky-400 text-black shadow-lg'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon name="smartphone" size={16} />
              <span>iPhone / iPad (iOS)</span>
            </button>
            <button
              onClick={() => setActiveTab('clocking_tablet')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'clocking_tablet'
                  ? 'bg-[#ff8c00] text-black shadow-lg'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon name="tablet" size={16} />
              <span>Clocking Tablet (Kiosk)</span>
            </button>
            <button
              onClick={() => setActiveTab('specs')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'specs'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon name="shield" size={16} />
              <span>Device Security & Tips</span>
            </button>
          </div>

          {/* TAB 1: Android Phone / Tablet Instructions */}
          {activeTab === 'android' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="border-b border-white/5 pb-3">
                <h3 className="text-base font-black uppercase tracking-wider text-white">
                  Android Phone & Tablet Installation
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Follow these steps to install TS Hub as a native-feel Progressive Web App (PWA) on any mobile workstation:
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Open Device Camera</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Launch the built-in Camera application on the Android smartphone or tablet.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Scan the QR Code</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Aim the camera at the large QR code displayed on this screen.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Open in Google Chrome</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Tap the banner or notification that appears to open the TS Hub link in Chrome.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Tap "Install" Prompt</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      If Chrome presents the bottom installation sheet, tap <strong className="text-cyan-300">"Install"</strong> or <strong className="text-cyan-300">"Add TS Hub to Home screen"</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    5
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Alternative: Chrome Menu</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      If no banner appears: tap the Chrome menu icon (<strong>⋮</strong> in top right corner) and select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    6
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Confirm Installation</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Confirm the installation dialogue. The TS Hub app icon will be pinned to your device's home screen.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    7
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Launch from Home Screen</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Close the browser and open TS Hub directly from the Home Screen for a clean, full-screen native experience.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    8
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Sign In with Credentials</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Sign in using your assigned TS Hub email and PIN/password to access your authorized modules.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: iPhone / iPad (iOS) Instructions */}
          {activeTab === 'ios' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="border-b border-white/5 pb-3">
                <h3 className="text-base font-black uppercase tracking-wider text-white">
                  Apple iPhone & iPad (Safari) Installation
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Follow these steps to install TS Hub as a full-screen Progressive Web App via Apple Safari:
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Open Device Camera</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Launch the built-in iOS Camera app and aim it at the QR code on the left.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Open in Safari</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Tap the yellow Safari link banner that appears in the Camera viewport.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Tap the Share Button</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      In Safari toolbar, tap the <strong>Share</strong> button (the square icon with an upward arrow ⎋).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Select "Add to Home Screen"</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Scroll down through the action list and tap <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    5
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Tap "Add"</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Confirm the app title ("TS Hub") and tap <strong>Add</strong> in the top-right corner.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    6
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Launch from Home Screen</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Open the app from your iOS home screen to run in standalone full-screen mode and log in.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Clocking Tablet (Kiosk) Instructions */}
          {activeTab === 'clocking_tablet' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="border-b border-white/5 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black uppercase tracking-wider text-white">
                    Dedicated Clocking Tablet Setup
                  </h3>
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-[10px] font-mono font-black uppercase">
                    Workshop Kiosk
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Set up the dedicated workshop attendance tablet. Once signed in, the tablet locks into the dedicated Clocking Kiosk Terminal.
                </p>
              </div>

              {/* Special Kiosk Credential Card */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">
                  Kiosk System Account
                </span>
                <div className="flex items-center justify-between bg-black/50 p-2.5 rounded-xl border border-amber-500/20">
                  <div className="font-mono text-sm text-white font-bold">
                    clocking@tsjoinery.co.za
                  </div>
                  <button
                    onClick={handleCopyClockingEmail}
                    className="px-2.5 py-1 bg-amber-500 text-black font-bold text-xs rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-1"
                  >
                    <Icon name={copiedClockingEmail ? "check" : "copy"} size={12} />
                    <span>{copiedClockingEmail ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-amber-200/80">
                  Password: Enter the established system PIN (Default: <code>0000</code>).
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-[#ff8c00]/20 text-[#ff8c00] font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Scan QR on Clocking Tablet</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Point the tablet camera at the QR code on the left to navigate to TS Hub.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-[#ff8c00]/20 text-[#ff8c00] font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Install / Add to Home Screen</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Open in Chrome, tap the menu (<strong>⋮</strong>), and select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-[#ff8c00]/20 text-[#ff8c00] font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Launch from Home Screen</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Tap the TS Hub icon on the tablet's desktop/home screen to launch in standalone kiosk window.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-[#ff8c00]/20 text-[#ff8c00] font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Sign In with Kiosk Account</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Log in using <strong className="text-amber-400 font-mono">clocking@tsjoinery.co.za</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-[#ff8c00]/20 text-[#ff8c00] font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    5
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white">Dedicated Terminal Autostarts</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      The application immediately activates the full-screen Dedicated Clocking Terminal. Artisans can scan badges, use face scan, clock in/out, and request leaves seamlessly.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Device Security & Tips */}
          {activeTab === 'specs' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="border-b border-white/5 pb-3">
                <h3 className="text-base font-black uppercase tracking-wider text-white">
                  Device Hardware & Kiosk Recommendations
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Best practices for workshop environments and tablet mounting:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-purple-400">
                    <Icon name="monitor" size={16} />
                    <span className="text-xs font-black uppercase">Screen Timeout</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    In Android Settings → Display: Set Screen Timeout to "Never" or activate "Stay Awake while charging" in Developer Options.
                  </p>
                </div>

                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Icon name="camera" size={16} />
                    <span className="text-xs font-black uppercase">Camera Permissions</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Allow camera access when prompted by Chrome to enable facial recognition and QR card scanning.
                  </p>
                </div>

                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Icon name="wifi" size={16} />
                    <span className="text-xs font-black uppercase">Offline Persistence</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Attendance clocks are stored in local IndexedDB if WiFi drops and automatically synchronize when internet restores.
                  </p>
                </div>

                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Icon name="lock" size={16} />
                    <span className="text-xs font-black uppercase">Kiosk App Pinning</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Use Android App Pinning (Settings → Security → App Pinning) to prevent artisans from switching away from the terminal.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
