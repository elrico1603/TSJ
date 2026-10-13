/**
 * TimberSmith Hub — Server-Side Secure Gemini AI Service
 * Wraps @google/genai SDK for enterprise AI assistance without exposing client-side keys.
 */

import { GoogleGenAI } from '@google/genai';

class ServerGeminiService {
  private aiClient: GoogleGenAI | null = null;

  /**
   * Lazy initialization to avoid startup crashes if GEMINI_API_KEY is not yet populated
   */
  private getClient(): GoogleGenAI {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not configured on the server.');
      }
      this.aiClient = new GoogleGenAI({ apiKey });
    }
    return this.aiClient;
  }

  /**
   * Check if Gemini AI is configured
   */
  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  /**
   * Generate content / Chat completion with resilient model fallback
   */
  async generateChatResponse(options: {
    prompt?: string;
    messages?: Array<{
      role: 'user' | 'model' | 'system';
      content: string;
    }>;
    model?: string;
    systemInstruction?: string;
  }): Promise<{
    text: string;
    model: string;
    usage?: {
      promptTokens?: number;
      responseTokens?: number;
      totalTokens?: number;
    };
  }> {
    const ai = this.getClient();
    const primaryModel = options.model || 'gemini-2.5-flash';

    // System instruction can come from options or system messages in array
    let systemInstruction = options.systemInstruction;
    const conversationMessages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (options.messages && options.messages.length > 0) {
      for (const msg of options.messages) {
        if (msg.role === 'system') {
          systemInstruction = systemInstruction ? `${systemInstruction}\n\n${msg.content}` : msg.content;
        } else {
          // Normalize role for GoogleGenAI: 'user' or 'model'
          const role = msg.role === 'model' ? 'model' : 'user';
          conversationMessages.push({
            role,
            parts: [{ text: msg.content }]
          });
        }
      }
    } else if (options.prompt) {
      conversationMessages.push({
        role: 'user',
        parts: [{ text: options.prompt }]
      });
    } else {
      throw new Error('Either prompt or messages must be provided.');
    }

    // Default System Instruction for TimberSmith Joinery
    const finalSystemInstruction = systemInstruction || 
      'You are the TimberSmith Hub AI Assistant, an expert in joinery manufacturing, workshop workflow, dispatch operations, procurement, and carpentry logistics. Provide helpful, accurate, and concise assistance.';

    const modelsToTry = [primaryModel, 'gemini-flash-latest', 'gemini-2.5-flash'];
    // Deduplicate models
    const uniqueModels = Array.from(new Set(modelsToTry));

    let lastError: any = null;

    for (const model of uniqueModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: conversationMessages,
          config: {
            systemInstruction: finalSystemInstruction
          }
        });

        const responseText = response.text || '';

        return {
          text: responseText,
          model,
          usage: response.usageMetadata ? {
            promptTokens: response.usageMetadata.promptTokenCount,
            responseTokens: response.usageMetadata.candidatesTokenCount,
            totalTokens: response.usageMetadata.totalTokenCount
          } : undefined
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[ServerGeminiService] Model ${model} failed, attempting fallback if available:`, err.message || err);
      }
    }

    throw lastError || new Error('All candidate Gemini models failed to respond.');
  }
}

export const serverGemini = new ServerGeminiService();
