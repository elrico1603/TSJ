import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, CornerDownLeft, Loader2 } from 'lucide-react';

interface ChatInputBarProps {
  onSendMessage: (content: string) => void;
  isGenerating: boolean;
  placeholder?: string;
  disabled?: boolean;
}

const PROMPT_STARTERS = [
  { label: '🪵 Timber Moisture Standards', prompt: 'What are the acceptable moisture content percentages for solid oak and pine joinery before machining and assembly?' },
  { label: '📋 Cutting List Optimization', prompt: 'How do I calculate grain direction allowance and blade kerf loss for custom cabinet doors?' },
  { label: '🚚 Dispatch Inspection Checklist', prompt: 'Provide a complete dispatch QA checklist for architectural joinery products prior to customer delivery.' },
  { label: '🔩 Concealed Hinge Load Specs', prompt: 'What is the recommended number of concealed hinges based on door height and door weight in kg?' }
];

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSendMessage,
  isGenerating,
  placeholder = 'Ask TimberSmith AI anything about joinery, orders, timber specs, or dispatches...',
  disabled = false
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || isGenerating || disabled) return;

    onSendMessage(cleanText);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSelectStarter = (prompt: string) => {
    if (isGenerating || disabled) return;
    onSendMessage(prompt);
  };

  return (
    <div className="p-4 border-t border-white/10 bg-[#111114]/95 backdrop-blur-xl shrink-0 space-y-3">
      
      {/* Quick Prompt Starters (Horizontal scrollable pill list) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        <span className="text-[10px] font-mono font-black uppercase text-[#ff8c00] shrink-0 flex items-center gap-1">
          <Sparkles size={11} />
          Suggestions:
        </span>
        {PROMPT_STARTERS.map((starter, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isGenerating || disabled}
            onClick={() => handleSelectStarter(starter.prompt)}
            className="px-3 py-1 bg-white/5 hover:bg-white/10 hover:border-[#ff8c00]/40 border border-white/10 text-gray-300 hover:text-white rounded-full text-xs font-mono shrink-0 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
          >
            {starter.label}
          </button>
        ))}
      </div>

      {/* Input Form Card */}
      <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-black/60 border border-white/15 focus-within:border-[#ff8c00] rounded-3xl p-2.5 transition-all shadow-inner">
        
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isGenerating ? 'Gemini is processing your request...' : placeholder}
          disabled={isGenerating || disabled}
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none px-3 py-1.5 focus:outline-none max-h-44 custom-scrollbar font-sans disabled:opacity-50 leading-relaxed"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!text.trim() || isGenerating || disabled}
          className={`h-10 px-4 rounded-2xl flex items-center justify-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
            text.trim() && !isGenerating && !disabled
              ? 'bg-gradient-to-r from-[#ff8c00] to-[#e07b00] text-black shadow-lg shadow-[#ff8c00]/25 hover:from-[#ffa024] hover:to-[#ff8c00] active:scale-95'
              : 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 size={15} className="animate-spin text-[#ff8c00]" />
              <span className="hidden sm:inline text-[11px] text-[#ff8c00]">Thinking</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Send</span>
              <Send size={14} className="stroke-[2.5]" />
            </>
          )}
        </button>

      </form>

      {/* Subtext info */}
      <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 px-2">
        <div className="flex items-center gap-1">
          <CornerDownLeft size={10} />
          <span>Press <strong>Enter</strong> to send, <strong>Shift+Enter</strong> for newline</span>
        </div>
        <span>Powered by Google Gemini 3.7 Flash</span>
      </div>

    </div>
  );
};
