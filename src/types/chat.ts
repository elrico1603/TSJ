/**
 * TimberSmith Hub — AI & Gemini Chat Architecture Types
 * Phase 1: Conversation & Message Schema
 */

export type ChatRole = 'user' | 'model' | 'system';
export type MessageStatus = 'sending' | 'thinking' | 'completed' | 'failed';

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
  model: string;     // e.g. 'gemini-3.7-flash'
  systemInstruction?: string;
  metadata?: {
    totalMessages?: number;
    lastMessagePreview?: string;
    topic?: string;
  };
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  createdAt: string; // ISO 8601 string
  status: MessageStatus;
  error?: string;
}

export interface ChatGenerateRequest {
  prompt?: string;
  messages?: Array<{
    role: ChatRole;
    content: string;
  }>;
  conversationId?: string;
  model?: string;
  systemInstruction?: string;
}

export interface ChatGenerateResponse {
  success: boolean;
  text?: string;
  error?: string;
  model?: string;
  usage?: {
    promptTokens?: number;
    responseTokens?: number;
    totalTokens?: number;
  };
}
