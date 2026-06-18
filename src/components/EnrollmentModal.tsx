import React, { useRef } from 'react';
import { Icon } from './Icon';

interface EnrollmentModalProps {
  isEditing: boolean;
  enrollForm: any;
  setEnrollForm: (form: any) => void;
  capturedPhoto: string | null;
  setCapturedPhoto: (photo: string | null) => void;
  isCapturing: boolean;
  setIsCapturing: (b: boolean) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  streamRef: React.MutableRefObject<MediaStream | null>;
  handleEnrollSubmit: (e: React.FormEvent) => void;
  setShowEnrollModal: (b: boolean) => void;
}

export const EnrollmentModal: React.FC<EnrollmentModalProps> = ({
  isEditing,
  enrollForm,
  setEnrollForm,
  capturedPhoto,
  setCapturedPhoto,
  isCapturing,
  setIsCapturing,
  videoRef,
  canvasRef,
  streamRef,
  handleEnrollSubmit,
  setShowEnrollModal
}) => {
  
  const startCamera = async () => {
    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user", width: 1280, height: 720 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn("video play exception:", e));
      }
    } catch (err) {
      console.warn("Unable to start enrollment video capture:", err);
      alert("Camera utility not available. Please verify system permissions.");
    }
  };

  const capturePhoto = () => {
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (video && canvas) {
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, 320, 240);
          setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.6));
        }
        setIsCapturing(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      }
    } catch (e) {
      console.warn("Failed taking screenshot snapshot:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in font-sans text-left">
      <div className="bg-[#151515] w-full max-w-5xl rounded-[4rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-white/5 bg-black/20 flex justify-between items-center text-white italic">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter font-sans">
            {isEditing ? 'Update Artisan Records' : 'Artisan Enrollment'}
          </h2>
          <button 
            type="button" 
            onClick={() => {
              if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
              }
              setIsCapturing(false);
              setShowEnrollModal(false);
            }} 
            className="p-3 text-gray-500 hover:text-white transition-all"
          >
            <Icon name="x" size={32}/>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar text-white italic text-left">
          <form onSubmit={handleEnrollSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-16 font-sans">
            <div className="space-y-10">
              <div className="aspect-square bg-black rounded-[4rem] border-4 border-white/5 overflow-hidden relative shadow-inner">
                {isCapturing ? (
                  <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                ) : capturedPhoto ? (
                  <img src={capturedPhoto} className="w-full h-full object-cover" alt="Captured Artisan Profile" />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-800">
                    <Icon name="id-card" size={100} />
                    <p className="mt-4 font-black uppercase text-[11px] tracking-widest italic text-gray-500">Awaiting Profile Capture</p>
                  </div>
                )}
                <div className="absolute bottom-8 inset-x-8 flex gap-4">
                  <button 
                    type="button" 
                    onClick={startCamera} 
                    className="flex-1 py-5 bg-white/5 border border-white/10 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-white/10 transition-all text-white"
                  >
                    Open Camera
                  </button>
                  {isCapturing && (
                    <button 
                      type="button" 
                      onClick={capturePhoto} 
                      className="p-5 bg-emerald-600 rounded-2xl active:scale-90 transition-all shadow-xl text-white"
                    >
                      <Icon name="camera" size={28}/>
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8 h-fit text-left font-sans">
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase text-gray-600 ml-4 font-sans font-bold">First Name</label>
                <input required className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 font-bold outline-none focus:border-blue-500 transition-all text-white font-sans" value={enrollForm.name || ''} onChange={e => setEnrollForm({...enrollForm, name: e.target.value})} />
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase text-gray-600 ml-4 font-sans font-bold">Surname</label>
                <input required className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 font-bold outline-none focus:border-blue-500 transition-all text-white font-sans" value={enrollForm.surname || ''} onChange={e => setEnrollForm({...enrollForm, surname: e.target.value})} />
              </div>
              <div className="col-span-2 space-y-2 text-left">
                <label className="text-[10px] font-black uppercase text-gray-600 ml-4 font-sans font-bold">Residential Address</label>
                <input required className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 font-bold outline-none focus:border-blue-500 transition-all text-white font-sans" value={enrollForm.address || ''} onChange={e => setEnrollForm({...enrollForm, address: e.target.value})} />
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase text-gray-600 ml-4 font-sans font-bold">ID Number</label>
                <input required className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 font-mono text-white text-sm" value={enrollForm.idNumber || ''} onChange={e => setEnrollForm({...enrollForm, idNumber: e.target.value})} />
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase text-gray-600 ml-4 font-sans font-bold">Contact No</label>
                <input required className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 font-bold text-white text-sm" value={enrollForm.contactNumber || ''} onChange={e => setEnrollForm({...enrollForm, contactNumber: e.target.value})} />
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase text-gray-600 ml-4 font-sans font-bold">Tax Number</label>
                <input required className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 font-bold text-white text-sm" value={enrollForm.taxNumber || ''} onChange={e => setEnrollForm({...enrollForm, taxNumber: e.target.value})} />
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase text-gray-600 ml-4 font-sans font-bold">UIF Number</label>
                <input required className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 font-bold text-white text-sm" value={enrollForm.uifNumber || ''} onChange={e => setEnrollForm({...enrollForm, uifNumber: e.target.value})} />
              </div>
              <div className="col-span-2 space-y-2 text-left">
                <label className="text-[10px] font-black uppercase text-gray-600 ml-4 font-sans font-bold">Date Started</label>
                <input required type="date" className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 font-bold outline-none focus:border-blue-500 transition-all text-white text-sm font-sans" value={enrollForm.dateStarted || ''} onChange={e => setEnrollForm({...enrollForm, dateStarted: e.target.value})} />
              </div>
              <div className="col-span-2 space-y-2 mt-4 text-left">
                <label className="text-[11px] font-black uppercase text-[#ff8c00] ml-4 tracking-widest italic font-sans font-bold">Secret Terminal PIN (4 Digits)</label>
                <input required className="w-full bg-black border-2 border-[#ff8c00]/20 rounded-3xl p-6 text-center text-4xl font-black text-[#ff8c00] tracking-[0.5em] font-sans" maxLength={4} value={enrollForm.personalCode || ''} onChange={e => setEnrollForm({...enrollForm, personalCode: e.target.value})} />
              </div>
              <button type="submit" className="col-span-2 mt-8 py-8 bg-white text-black rounded-[3rem] font-black uppercase tracking-[0.4em] text-sm shadow-2xl active:scale-95 transition-all italic font-sans">
                {isEditing ? 'Save Changes' : 'Commit Enrollment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
