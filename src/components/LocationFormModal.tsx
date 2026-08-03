import React, { useState, useEffect } from 'react';
import { WarehouseLocation } from '../types';
import { Icon } from './Icon';
import { productMasterService } from '../services/productMasterService';

interface LocationFormModalProps {
  location?: WarehouseLocation | null;
  currentUser?: any;
  onClose: () => void;
  onSave: () => void;
}

export const LocationFormModal: React.FC<LocationFormModalProps> = ({
  location,
  currentUser,
  onClose,
  onSave
}) => {
  const isEdit = Boolean(location);

  const [aisle, setAisle] = useState('A');
  const [rack, setRack] = useState('01');
  const [shelf, setShelf] = useState('A');
  const [bin, setBin] = useState('01');
  const [colour, setColour] = useState('GREEN');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (location) {
      setAisle(location.aisle);
      setRack(location.rack);
      setShelf(location.shelf);
      setBin(location.bin);
      setColour(location.colour || 'GREEN');
      setDescription(location.description || '');
    }
  }, [location]);

  const formattedCode = `${aisle.toUpperCase()}-${rack.padStart(2, '0')}-${shelf.toUpperCase()}-${bin.padStart(2, '0')}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aisle || !rack || !shelf || !bin) {
      setError('Aisle, Rack, Shelf, and Bin are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const username = currentUser?.name || currentUser?.email || 'Admin User';

    try {
      if (isEdit && location) {
        await productMasterService.updateWarehouseLocation(
          location.id,
          { aisle, rack, shelf, bin, colour, description },
          username
        );
      } else {
        await productMasterService.createWarehouseLocation(aisle, rack, shelf, bin, colour, description, username);
      }
      onSave();
    } catch (err: any) {
      setError(err?.message || 'Failed to save location.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-5 bg-[#1f1f1f] border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Icon name="map-pin" size={18} className="text-[#ff8c00]" />
            <span>{isEdit ? 'Edit Warehouse Location' : 'Create Warehouse Location'}</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <Icon name="x" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold">
              {error}
            </div>
          )}

          {/* Formatted Preview Badge */}
          <div className="p-4 bg-[#111111] border border-white/10 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase">Formatted Code:</span>
            <span className="text-lg font-black font-mono text-[#ff8c00] tracking-widest bg-[#ff8c00]/10 px-3 py-1 rounded-lg border border-[#ff8c00]/30">
              {formattedCode}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Aisle</label>
              <input
                type="text"
                maxLength={3}
                value={aisle}
                onChange={e => setAisle(e.target.value.toUpperCase())}
                placeholder="A"
                className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-center text-sm font-mono text-white focus:outline-none focus:border-[#ff8c00]"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Rack</label>
              <input
                type="text"
                maxLength={3}
                value={rack}
                onChange={e => setRack(e.target.value)}
                placeholder="04"
                className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-center text-sm font-mono text-white focus:outline-none focus:border-[#ff8c00]"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Shelf</label>
              <input
                type="text"
                maxLength={3}
                value={shelf}
                onChange={e => setShelf(e.target.value.toUpperCase())}
                placeholder="B"
                className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-center text-sm font-mono text-white focus:outline-none focus:border-[#ff8c00]"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Bin</label>
              <input
                type="text"
                maxLength={3}
                value={bin}
                onChange={e => setBin(e.target.value)}
                placeholder="12"
                className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-center text-sm font-mono text-white focus:outline-none focus:border-[#ff8c00]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Location Badge Color</label>
            <select
              value={colour}
              onChange={e => setColour(e.target.value)}
              className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
            >
              <option value="GREEN">Green</option>
              <option value="RED">Red</option>
              <option value="YELLOW">Yellow</option>
              <option value="BLUE">Blue</option>
              <option value="ORANGE">Orange</option>
              <option value="PURPLE">Purple</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Description / Notes</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Aisle B Hardware Bins"
              className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
            />
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              {isSubmitting ? 'Saving...' : 'Save Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
