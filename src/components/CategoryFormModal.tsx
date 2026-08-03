import React, { useState, useEffect } from 'react';
import { ProductCategory } from '../types';
import { Icon } from './Icon';
import { productMasterService } from '../services/productMasterService';

interface CategoryFormModalProps {
  category?: ProductCategory | null;
  currentUser?: any;
  onClose: () => void;
  onSave: () => void;
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  category,
  currentUser,
  onClose,
  onSave
}) => {
  const isEdit = Boolean(category);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setCode(category.code);
      setDescription(category.description || '');
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const username = currentUser?.name || currentUser?.email || 'Admin User';

    try {
      if (isEdit && category) {
        await productMasterService.updateCategory(category.id, { name, code, description }, username);
      } else {
        await productMasterService.createCategory(name, code, description, username);
      }
      onSave();
    } catch (err: any) {
      setError(err?.message || 'Failed to save category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-5 bg-[#1f1f1f] border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Icon name="tag" size={18} className="text-[#ff8c00]" />
            <span>{isEdit ? 'Edit Category' : 'Create Product Category'}</span>
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

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Category Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (!code || !isEdit) {
                  setCode(e.target.value.toUpperCase().replace(/\s+/g, '_'));
                }
              }}
              placeholder="e.g. Board, Hardware, Paint..."
              className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff8c00]"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Category Code</label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. BOARD"
              className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#ff8c00]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief summary of items in this category..."
              rows={2}
              className="w-full bg-[#111111] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
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
              {isSubmitting ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
