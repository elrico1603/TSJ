import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { ChatMessage } from '../../types/chat';
import { 
  Bot, 
  User, 
  Copy, 
  Check, 
  RotateCcw, 
  AlertCircle, 
  Sparkles, 
  Clock 
} from 'lucide-react';

interface ChatMessageItemProps {
  message: ChatMessage;
  isLastModelMessage?: boolean;
  isGenerating?: boolean;
  onRetry?: () => void;
  onRegenerate?: () => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  isLastModelMessage,
  isGenerating,
  onRetry,
  onRegenerate
}) => {
  const [copied, setCopied] = useState(false);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isModel = message.role === 'model';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const formattedTime = (() => {
    try {
      const date = new Date(message.createdAt);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  })();

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-[11px] font-mono text-amber-300 flex items-center gap-2 max-w-lg">
          <Sparkles size={13} className="shrink-0 text-amber-400" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}>
      <div className={`flex gap-3 max-w-3xl w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border ${
          isUser 
            ? 'bg-[#ff8c00]/20 border-[#ff8c00]/40 text-[#ff8c00]' 
            : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
        }`}>
          {isUser ? <User size={18} /> : <Bot size={18} />}
        </div>

        {/* Message Bubble Card */}
        <div className={`flex-1 rounded-3xl p-5 border text-sm font-sans transition-all ${
          isUser
            ? 'bg-[#221f1c] border-[#ff8c00]/30 text-white rounded-tr-none shadow-lg'
            : 'bg-[#151518] border-white/10 text-gray-100 rounded-tl-none shadow-xl'
        }`}>
          
          {/* Header info */}
          <div className="flex items-center justify-between gap-4 mb-2 pb-2 border-b border-white/5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className={`font-black uppercase tracking-wider font-mono ${
                isUser ? 'text-[#ff8c00]' : 'text-cyan-400'
              }`}>
                {isUser ? 'You' : 'TimberSmith AI'}
              </span>
              {isModel && (
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-gray-400">
                  gemini-3.7-flash
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-gray-500 font-mono text-[10px]">
              <Clock size={11} />
              <span>{formattedTime}</span>
            </div>
          </div>

          {/* Body / Content rendering */}
          {message.status === 'thinking' || message.status === 'sending' ? (
            <div className="py-3 flex items-center gap-3 text-cyan-300">
              <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-mono font-bold tracking-wide animate-pulse">
                  Gemini is thinking and formulating response...
                </p>
                <p className="text-[10px] text-gray-500 font-mono">
                  Querying TimberSmith AI proxy backend
                </p>
              </div>
            </div>
          ) : message.status === 'failed' ? (
            <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-300 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1 text-xs font-mono">
                  <p className="font-bold text-red-200">Message generation failed</p>
                  <p className="text-red-400/90 text-[11px]">{message.error || message.content || 'Network or model error occurred.'}</p>
                </div>
              </div>

              {onRetry && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={onRetry}
                    disabled={isGenerating}
                    className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600/50 border border-red-500/50 text-red-200 rounded-xl text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  >
                    <RotateCcw size={13} />
                    <span>Retry Request</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 text-sm leading-relaxed">
              {isUser ? (
                <p className="whitespace-pre-wrap font-sans text-gray-100">{message.content}</p>
              ) : (
                <div className="markdown-body prose prose-invert max-w-none text-gray-200 text-sm leading-relaxed [&_h1]:text-lg [&_h1]:font-black [&_h1]:text-white [&_h1]:my-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-white [&_h2]:my-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-cyan-300 [&_h3]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1 [&_strong]:text-white [&_strong]:font-black [&_p]:my-2 [&_pre]:bg-black/60 [&_pre]:border [&_pre]:border-white/10 [&_pre]:p-3.5 [&_pre]:rounded-2xl [&_pre]:font-mono [&_pre]:text-xs [&_pre]:text-emerald-300 [&_pre]:overflow-x-auto [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-xs [&_code]:font-mono [&_code]:text-amber-300 [&_table]:w-full [&_table]:border [&_table]:border-white/10 [&_table]:my-3 [&_th]:border [&_th]:border-white/10 [&_th]:p-2 [&_th]:bg-white/5 [&_td]:border [&_td]:border-white/10 [&_td]:p-2">
                  <Markdown>{message.content}</Markdown>
                </div>
              )}
            </div>
          )}

          {/* Action Toolbar for Model Messages */}
          {isModel && message.status === 'completed' && (
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all text-xs font-mono flex items-center gap-1.5"
                  title="Copy response to clipboard"
                >
                  {copied ? (
                    <>
                      <Check size={13} className="text-emerald-400" />
                      <span className="text-emerald-400 font-bold text-[11px]">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span className="text-[11px]">Copy</span>
                    </>
                  )}
                </button>

                {isLastModelMessage && onRegenerate && (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    disabled={isGenerating}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-cyan-300 transition-all text-xs font-mono flex items-center gap-1.5 disabled:opacity-40"
                    title="Regenerate this response"
                  >
                    <RotateCcw size={13} />
                    <span className="text-[11px]">Regenerate</span>
                  </button>
                )}
              </div>

              <span className="text-[10px] font-mono text-gray-600">
                TimberSmith AI Engine
              </span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
