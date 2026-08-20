import React, { useState } from 'react';
import { Conversation } from '../../types/chat';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Search, 
  Sparkles, 
  Check, 
  X, 
  Edit3,
  Bot
} from 'lucide-react';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  isOpenMobile,
  onCloseMobile
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.metadata?.lastMessagePreview && c.metadata.lastMessagePreview.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleStartEdit = (c: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const handleSaveEdit = (cId: string, e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(cId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDeleteClick = (cId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(cId);
  };

  const handleConfirmDelete = (cId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteConversation(cId);
    setDeleteConfirmId(null);
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));

      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }

      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const content = (
    <div className="h-full flex flex-col bg-[#111114] border-r border-white/10 font-sans select-none">
      
      {/* Top Header & New Chat Button */}
      <div className="p-4 border-b border-white/10 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-black font-black shadow-lg shadow-cyan-500/20">
              <Bot size={18} className="text-black" />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider text-white">TimberSmith AI</h3>
              <p className="text-[10px] text-gray-400 font-mono">Gemini 3.7 Flash</p>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* New Chat Primary Action Button */}
        <button
          type="button"
          onClick={() => {
            onNewChat();
            if (onCloseMobile) onCloseMobile();
          }}
          className="w-full py-3 px-4 bg-gradient-to-r from-[#ff8c00] to-[#e07b00] hover:from-[#ffa024] hover:to-[#ff8c00] text-black font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-[#ff8c00]/20 flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Plus size={16} className="stroke-[3]" />
          <span>New Chat</span>
        </button>

        {/* Search Chats */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#ff8c00] transition-all font-mono"
          />
        </div>
      </div>

      {/* Recent Chats Stream */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
        <div className="px-2 py-1 text-[10px] font-mono font-black uppercase text-gray-500 tracking-wider flex items-center justify-between">
          <span>Recent Conversations</span>
          <span className="text-gray-600">{conversations.length}</span>
        </div>

        {filteredConversations.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-2">
            <MessageSquare size={24} className="mx-auto text-gray-600 opacity-40" />
            <p className="text-xs font-mono text-gray-500">
              {searchQuery ? 'No matching chats found' : 'No saved conversations yet'}
            </p>
            <p className="text-[11px] text-gray-600">
              Start a new chat to begin interacting with Gemini.
            </p>
          </div>
        ) : (
          filteredConversations.map(c => {
            const isActive = c.id === activeConversationId;
            const isEditing = c.id === editingId;
            const isDeleting = c.id === deleteConfirmId;

            return (
              <div
                key={c.id}
                onClick={() => {
                  if (!isEditing && !isDeleting) {
                    onSelectConversation(c.id);
                    if (onCloseMobile) onCloseMobile();
                  }
                }}
                className={`group relative rounded-2xl p-3 cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-[#ff8c00]/10 border-[#ff8c00]/40 text-white shadow-md'
                    : 'bg-white/[0.02] hover:bg-white/5 border-transparent hover:border-white/10 text-gray-300'
                }`}
              >
                {isEditing ? (
                  <form onSubmit={(e) => handleSaveEdit(c.id, e)} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 bg-black border border-[#ff8c00] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      onClick={(e) => handleSaveEdit(c.id, e)}
                      className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded-md"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="p-1 text-gray-400 hover:bg-white/10 rounded-md"
                    >
                      <X size={14} />
                    </button>
                  </form>
                ) : isDeleting ? (
                  <div className="flex items-center justify-between gap-2 p-1 text-xs text-red-300 bg-red-950/40 rounded-xl border border-red-500/30">
                    <span className="text-[11px] font-mono font-bold">Delete chat?</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleConfirmDelete(c.id, e)}
                        className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-mono font-bold"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                        className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded text-[10px] font-mono"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare size={14} className={isActive ? 'text-[#ff8c00] shrink-0' : 'text-gray-500 shrink-0'} />
                        <span className="text-xs font-bold truncate text-gray-200 group-hover:text-white">
                          {c.title}
                        </span>
                      </div>

                      {/* Hover action buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleStartEdit(c, e)}
                          className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                          title="Rename chat"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(c.id, e)}
                          className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                          title="Delete chat"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-gray-500">
                      <span className="truncate max-w-[140px] text-gray-400">
                        {c.metadata?.lastMessagePreview || 'Empty conversation'}
                      </span>
                      <span className="shrink-0">{formatTimestamp(c.updatedAt)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-white/10 text-[10px] font-mono text-gray-500 flex items-center justify-between shrink-0 bg-black/40">
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-[#ff8c00]" />
          <span>TS Joinery AI</span>
        </div>
        <span className="text-emerald-400 font-bold">Connected</span>
      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:block w-80 h-full shrink-0">
        {content}
      </div>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-[600] lg:hidden bg-black/80 backdrop-blur-sm flex">
          <div className="w-80 h-full max-w-[85vw] shadow-2xl">
            {content}
          </div>
          <div className="flex-1" onClick={onCloseMobile} />
        </div>
      )}
    </>
  );
};
