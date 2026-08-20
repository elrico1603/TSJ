import React, { useState, useEffect, useRef } from 'react';
import { Conversation, ChatMessage } from '../../types/chat';
import { chatService } from '../../services/chatService';
import { ChatSidebar } from './ChatSidebar';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInputBar } from './ChatInputBar';
import { 
  Bot, 
  Sparkles, 
  Menu, 
  Trash2, 
  Edit3, 
  ShieldCheck, 
  Wrench, 
  Truck, 
  FileText,
  HelpCircle,
  Plus
} from 'lucide-react';

interface GeminiChatHubProps {
  currentUser: {
    id?: string;
    email: string;
    name: string;
    role?: string;
  };
}

export const GeminiChatHub: React.FC<GeminiChatHubProps> = ({ currentUser }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [customTitle, setCustomTitle] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userId = currentUser.id || currentUser.email || 'ts-user';

  // 1. Subscribe to User Conversations in real-time
  useEffect(() => {
    const unsubscribe = chatService.subscribeUserConversations(
      userId,
      (updatedConversations) => {
        setConversations(updatedConversations);
      },
      (error) => {
        console.error('[GeminiChatHub] Firestore conversations sync error:', error);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // 2. Subscribe to Active Conversation Messages in real-time
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const unsubscribe = chatService.subscribeMessages(
      activeConversationId,
      (updatedMessages) => {
        setMessages(updatedMessages);
        // Check if any message is currently 'thinking'
        const hasThinking = updatedMessages.some(m => m.status === 'thinking' || m.status === 'sending');
        setIsGenerating(hasThinking);
      },
      (error) => {
        console.error('[GeminiChatHub] Firestore messages sync error:', error);
      }
    );

    return () => unsubscribe();
  }, [activeConversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Active Conversation Object
  const activeConversation = conversations.find(c => c.id === activeConversationId);

  // 3. New Chat Action — Complete Context Isolation
  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setIsGenerating(false);
    setIsEditingTitle(false);
  };

  // 4. Select Conversation
  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setIsEditingTitle(false);
  };

  // 5. Send Message Workflow
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isGenerating) return;

    let targetConversationId = activeConversationId;

    try {
      setIsGenerating(true);

      // If on blank canvas, create a new conversation first
      if (!targetConversationId) {
        // Derive conversation title from first 6 words of the prompt
        const titleWords = content.trim().split(/\s+/).slice(0, 6).join(' ');
        const derivedTitle = titleWords.length > 35 ? `${titleWords.slice(0, 32)}...` : titleWords;

        const newConv = await chatService.createConversation(
          userId,
          derivedTitle || 'New Conversation',
          'gemini-3.7-flash'
        );
        targetConversationId = newConv.id;
        setActiveConversationId(newConv.id);
      }

      // Execute orchestrated send workflow
      await chatService.sendMessageWorkflow(
        targetConversationId,
        content,
        {
          model: 'gemini-3.7-flash',
          conversationHistory: messages
        }
      );
    } catch (err) {
      console.error('[GeminiChatHub] Send message error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // 6. Retry Failed Message
  const handleRetry = async (failedMsg: ChatMessage) => {
    if (!activeConversationId || isGenerating) return;

    // Find the preceding user message if available
    const failedIdx = messages.findIndex(m => m.id === failedMsg.id);
    let promptToRetry = failedMsg.content;

    if (failedMsg.role === 'model' && failedIdx > 0) {
      const prevMsg = messages[failedIdx - 1];
      if (prevMsg.role === 'user') {
        promptToRetry = prevMsg.content;
      }
    }

    if (promptToRetry) {
      handleSendMessage(promptToRetry);
    }
  };

  // 7. Regenerate Last Model Response
  const handleRegenerate = async () => {
    if (!activeConversationId || isGenerating || messages.length === 0) return;

    // Find last user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      handleSendMessage(lastUserMsg.content);
    }
  };

  // 8. Delete Conversation
  const handleDeleteConversation = async (id: string) => {
    try {
      await chatService.deleteConversation(id);
      if (activeConversationId === id) {
        handleNewChat();
      }
    } catch (err) {
      console.error('[GeminiChatHub] Delete conversation error:', err);
    }
  };

  // 9. Rename Conversation
  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      await chatService.updateConversation(id, { title: newTitle });
    } catch (err) {
      console.error('[GeminiChatHub] Rename conversation error:', err);
    }
  };

  const handleSaveTitleEdit = () => {
    if (activeConversationId && customTitle.trim()) {
      handleRenameConversation(activeConversationId, customTitle.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="flex h-[calc(100vh-80px)] w-full max-w-7xl mx-auto rounded-[2rem] overflow-hidden border border-white/10 bg-[#0d0d10] shadow-[0_20px_50px_rgba(0,0,0,0.8)] font-sans">
      
      {/* 1. Chat Sidebar */}
      <ChatSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. Main Chat Viewport */}
      <div className="flex-1 flex flex-col h-full bg-[#0e0e12] overflow-hidden">
        
        {/* Top Header */}
        <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#121216] shrink-0">
          
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
              title="Open Chat History"
            >
              <Menu size={18} />
            </button>

            {/* Conversation Title & Rename */}
            {activeConversation ? (
              isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitleEdit(); }}
                    autoFocus
                    className="bg-black border border-[#ff8c00] rounded-lg px-2.5 py-1 text-sm text-white font-bold focus:outline-none"
                  />
                  <button
                    onClick={handleSaveTitleEdit}
                    className="px-2.5 py-1 bg-[#ff8c00] text-black font-bold text-xs rounded-lg uppercase"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-base font-black text-white truncate">
                    {activeConversation.title}
                  </h2>
                  <button
                    onClick={() => {
                      setCustomTitle(activeConversation.title);
                      setIsEditingTitle(true);
                    }}
                    className="p-1 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    title="Rename conversation"
                  >
                    <Edit3 size={13} />
                  </button>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#ff8c00]" />
                <h2 className="text-base font-black text-white">
                  New Joinery Consultation
                </h2>
              </div>
            )}
          </div>

          {/* Model & Header Badges */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
              <Bot size={13} className="text-cyan-400" />
              <span className="font-bold">gemini-3.7-flash</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Secure Proxy</span>
            </div>

            {activeConversationId && (
              <button
                onClick={() => handleDeleteConversation(activeConversationId)}
                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                title="Delete this chat"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

        </div>

        {/* Message Stream or Blank Canvas */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
          {messages.length === 0 ? (
            /* Blank Canvas / Welcome State */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 py-8">
              
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#ff8c00] via-[#e07b00] to-cyan-500 flex items-center justify-center text-black font-black shadow-2xl shadow-[#ff8c00]/30 transform hover:scale-105 transition-transform">
                  <Bot size={40} className="text-black" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-black border border-white/20">
                  <Sparkles size={14} className="text-[#ff8c00] animate-spin" style={{ animationDuration: '8s' }} />
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                  TimberSmith <span className="text-[#ff8c00]">Joinery AI</span>
                </h1>
                <p className="text-sm text-gray-400 font-sans max-w-lg mx-auto">
                  Your dedicated intelligent assistant for workshop manufacturing, cutting lists, timber moisture tolerances, and dispatch logistics.
                </p>
              </div>

              {/* Capability Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                
                <button
                  type="button"
                  onClick={() => handleSendMessage('What are the standard moisture content percentages and acclimatization guidelines for solid oak before processing?')}
                  className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-[#ff8c00]/40 transition-all group space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-xs font-bold font-mono text-[#ff8c00] uppercase tracking-wider">
                    <Wrench size={14} />
                    <span>Timber Specifications</span>
                  </div>
                  <p className="text-xs text-gray-300 group-hover:text-white">
                    Moisture content, grain allowances, and timber stability rules.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage('Create a complete pre-dispatch QA inspection checklist for custom architectural joinery doors.')}
                  className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-cyan-500/40 transition-all group space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider">
                    <Truck size={14} />
                    <span>Dispatch QA & Logistics</span>
                  </div>
                  <p className="text-xs text-gray-300 group-hover:text-white">
                    Final product checklists, packaging standards, and evidence criteria.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage('How should I optimize cutting sheet yield for 18mm MDF carcass panels with 3mm blade kerf?')}
                  className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-emerald-500/40 transition-all group space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider">
                    <FileText size={14} />
                    <span>Cutting Lists & Yields</span>
                  </div>
                  <p className="text-xs text-gray-300 group-hover:text-white">
                    Panel optimization formulas, kerf losses, and edging allowances.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage('Explain how to calculate the correct number of heavy-duty concealed hinges for a 2400mm x 600mm solid timber door.')}
                  className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-purple-500/40 transition-all group space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-xs font-bold font-mono text-purple-400 uppercase tracking-wider">
                    <ShieldCheck size={14} />
                    <span>Hardware Engineering</span>
                  </div>
                  <p className="text-xs text-gray-300 group-hover:text-white">
                    Hinge load tables, runner weight capacities, and screw pull-out specs.
                  </p>
                </button>

              </div>

            </div>
          ) : (
            /* Message List Stream */
            <div className="max-w-3xl mx-auto space-y-2">
              {messages.map((msg, index) => {
                const isLastModel = msg.role === 'model' && index === messages.length - 1;

                return (
                  <ChatMessageItem
                    key={msg.id || index}
                    message={msg}
                    isLastModelMessage={isLastModel}
                    isGenerating={isGenerating}
                    onRetry={() => handleRetry(msg)}
                    onRegenerate={handleRegenerate}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 3. Input Bar & Actions */}
        <ChatInputBar
          onSendMessage={handleSendMessage}
          isGenerating={isGenerating}
        />

      </div>

    </div>
  );
};
