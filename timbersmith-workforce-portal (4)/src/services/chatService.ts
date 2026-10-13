/**
 * TimberSmith Hub — Firestore Chat Data Service
 * Manages persistent conversations and message subcollections, and bridges to the secure Gemini proxy.
 */

import { db } from '../firebase';
import { Conversation, ChatMessage, ChatRole, MessageStatus, ChatGenerateRequest, ChatGenerateResponse } from '../types/chat';

class ChatService {
  private conversationsCollection = db.collection('conversations');

  /**
   * Helper to get the messages subcollection for a given conversation
   */
  private getMessagesSubcollection(conversationId: string) {
    return this.conversationsCollection.doc(conversationId).collection('messages');
  }

  /**
   * 1. Create a new conversation record in Firestore
   */
  async createConversation(
    userId: string,
    title: string = 'New Conversation',
    model: string = 'gemini-3.7-flash',
    systemInstruction?: string
  ): Promise<Conversation> {
    const now = new Date().toISOString();
    const docRef = this.conversationsCollection.doc();

    const conversationData: Omit<Conversation, 'id'> = {
      userId,
      title,
      createdAt: now,
      updatedAt: now,
      model,
      ...(systemInstruction ? { systemInstruction } : {}),
      metadata: {
        totalMessages: 0,
        lastMessagePreview: ''
      }
    };

    await docRef.set(conversationData);

    return {
      id: docRef.id,
      ...conversationData
    };
  }

  /**
   * 2. Fetch all conversations for a specific user, ordered by updatedAt descending
   */
  async getUserConversations(userId: string): Promise<Conversation[]> {
    try {
      const snapshot = await this.conversationsCollection
        .where('userId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Conversation, 'id'>)
      }));
    } catch (err) {
      console.warn('[ChatService] Error fetching with compound query, falling back to client-side sort:', err);
      const snapshot = await this.conversationsCollection
        .where('userId', '==', userId)
        .get();

      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Conversation, 'id'>)
      }));

      return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
  }

  /**
   * 3. Subscribe to real-time updates for a user's conversations
   */
  subscribeUserConversations(
    userId: string,
    onUpdate: (conversations: Conversation[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    return this.conversationsCollection
      .where('userId', '==', userId)
      .onSnapshot(
        snapshot => {
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<Conversation, 'id'>)
          }));
          items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          onUpdate(items);
        },
        err => {
          console.error('[ChatService] subscribeUserConversations error:', err);
          if (onError) onError(err);
        }
      );
  }

  /**
   * 4. Fetch a single conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    const doc = await this.conversationsCollection.doc(conversationId).get();
    if (!doc.exists) return null;
    return {
      id: doc.id,
      ...(doc.data() as Omit<Conversation, 'id'>)
    };
  }

  /**
   * 5. Update conversation metadata (e.g. title, updatedAt)
   */
  async updateConversation(conversationId: string, updates: Partial<Conversation>): Promise<void> {
    await this.conversationsCollection.doc(conversationId).update({
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * 6. Delete a conversation and its messages
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const messagesRef = this.getMessagesSubcollection(conversationId);
    const snapshot = await messagesRef.get();
    
    // Batch delete messages
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    batch.delete(this.conversationsCollection.doc(conversationId));
    await batch.commit();
  }

  /**
   * 7. Fetch all messages in a conversation, ordered chronologically
   */
  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    try {
      const snapshot = await this.getMessagesSubcollection(conversationId)
        .orderBy('createdAt', 'asc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<ChatMessage, 'id'>)
      }));
    } catch (err) {
      console.warn('[ChatService] getMessages orderBy error, falling back to client-sort:', err);
      const snapshot = await this.getMessagesSubcollection(conversationId).get();
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<ChatMessage, 'id'>)
      }));
      return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  }

  /**
   * 8. Subscribe to real-time message stream for a conversation
   */
  subscribeMessages(
    conversationId: string,
    onUpdate: (messages: ChatMessage[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    return this.getMessagesSubcollection(conversationId).onSnapshot(
      snapshot => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as Omit<ChatMessage, 'id'>)
        }));
        items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        onUpdate(items);
      },
      err => {
        console.error('[ChatService] subscribeMessages error:', err);
        if (onError) onError(err);
      }
    );
  }

  /**
   * 9. Add a message to the subcollection
   */
  async addMessage(
    conversationId: string,
    role: ChatRole,
    content: string,
    status: MessageStatus = 'completed'
  ): Promise<ChatMessage> {
    const now = new Date().toISOString();
    const docRef = this.getMessagesSubcollection(conversationId).doc();

    const messageData: Omit<ChatMessage, 'id'> = {
      conversationId,
      role,
      content,
      createdAt: now,
      status
    };

    await docRef.set(messageData);

    // Update conversation metadata
    await this.conversationsCollection.doc(conversationId).update({
      updatedAt: now,
      'metadata.lastMessagePreview': content.slice(0, 80),
    }).catch(() => {});

    return {
      id: docRef.id,
      ...messageData
    };
  }

  /**
   * 10. Update a message's status and content
   */
  async updateMessage(
    conversationId: string,
    messageId: string,
    updates: {
      status?: MessageStatus;
      content?: string;
      error?: string;
    }
  ): Promise<void> {
    await this.getMessagesSubcollection(conversationId).doc(messageId).update(updates);
  }

  /**
   * 11. Send prompt to the secure server-side Gemini proxy endpoint
   */
  async generateGeminiResponse(request: ChatGenerateRequest): Promise<ChatGenerateResponse> {
    const res = await fetch('/api/chat/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Gemini API proxy error (HTTP ${res.status})`);
    }

    return data;
  }

  /**
   * 12. Full Orchestrated Send: writes user message, writes placeholder model message,
   * calls server proxy, and updates status in Firestore.
   */
  async sendMessageWorkflow(
    conversationId: string,
    userContent: string,
    options?: {
      model?: string;
      systemInstruction?: string;
      conversationHistory?: ChatMessage[];
    }
  ): Promise<ChatMessage> {
    // A. Add user message
    const userMessage = await this.addMessage(conversationId, 'user', userContent, 'completed');

    // B. Add placeholder model message in 'thinking' state
    const modelMessageRef = this.getMessagesSubcollection(conversationId).doc();
    const now = new Date().toISOString();
    const modelMessageData: Omit<ChatMessage, 'id'> = {
      conversationId,
      role: 'model',
      content: '',
      createdAt: now,
      status: 'thinking'
    };
    await modelMessageRef.set(modelMessageData);

    try {
      // C. Build payload for proxy
      const history = options?.conversationHistory || [];
      const formattedMessages = [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userContent }
      ];

      const response = await this.generateGeminiResponse({
        conversationId,
        messages: formattedMessages,
        model: options?.model || 'gemini-3.7-flash',
        systemInstruction: options?.systemInstruction
      });

      const responseText = response.text || 'No response generated.';

      // D. Update model message to 'completed'
      await modelMessageRef.update({
        content: responseText,
        status: 'completed'
      });

      // Update conversation's last preview and updatedAt
      await this.conversationsCollection.doc(conversationId).update({
        updatedAt: new Date().toISOString(),
        'metadata.lastMessagePreview': responseText.slice(0, 80)
      }).catch(() => {});

      return {
        id: modelMessageRef.id,
        ...modelMessageData,
        content: responseText,
        status: 'completed'
      };
    } catch (err: any) {
      console.error('[ChatService] sendMessageWorkflow failed:', err);
      await modelMessageRef.update({
        content: `Error: ${err.message || 'Failed to generate response'}`,
        status: 'failed',
        error: err.message
      });

      throw err;
    }
  }
}

export const chatService = new ChatService();
