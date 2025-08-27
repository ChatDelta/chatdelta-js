import { AiClient, AiResponse, Conversation, Message, StreamChunk } from './types';
import { Conversation as ConversationImpl } from './conversation';

/**
 * A session for managing multi-turn conversations with an AI client.
 * Ported from chatdelta-rs/src/lib.rs:341-428
 */
export class ChatSession {
  private client: AiClient;
  private conversation: Conversation;

  /**
   * Create a new chat session with the given client
   */
  constructor(client: AiClient) {
    this.client = client;
    this.conversation = new ConversationImpl();
  }

  /**
   * Create a new chat session with a system message
   */
  static withSystemMessage(client: AiClient, message: string): ChatSession {
    const session = new ChatSession(client);
    session.conversation.addMessage({
      role: 'system',
      content: message,
    });
    return session;
  }

  /**
   * Send a message and get a response
   */
  async send(message: string): Promise<string> {
    this.conversation.addUserMessage(message);
    
    try {
      const response = await this.client.sendConversation(this.conversation);
      this.conversation.addAssistantMessage(response);
      return response;
    } catch (error) {
      // Remove the user message if the request failed
      const messages = this.conversation.getMessages();
      messages.pop();
      throw error;
    }
  }

  /**
   * Send a message and get a response with metadata
   */
  async sendWithMetadata(message: string): Promise<AiResponse> {
    this.conversation.addUserMessage(message);
    
    try {
      const response = await this.client.sendConversationWithMetadata(this.conversation);
      this.conversation.addAssistantMessage(response.content);
      return response;
    } catch (error) {
      // Remove the user message if the request failed
      const messages = this.conversation.getMessages();
      messages.pop();
      throw error;
    }
  }

  /**
   * Stream a response for the given message
   */
  async *stream(message: string): AsyncGenerator<StreamChunk> {
    this.conversation.addUserMessage(message);
    
    try {
      let fullContent = '';
      for await (const chunk of this.client.sendConversationStream(this.conversation)) {
        fullContent += chunk.content;
        yield chunk;
        
        // If this is the last chunk, add to conversation
        if (chunk.isComplete) {
          this.conversation.addAssistantMessage(fullContent);
        }
      }
    } catch (error) {
      // Remove the user message if the request failed
      const messages = this.conversation.getMessages();
      messages.pop();
      throw error;
    }
  }

  /**
   * Add a message to the conversation without sending
   */
  addMessage(message: Message): void {
    this.conversation.addMessage(message);
  }

  /**
   * Get the conversation history
   */
  history(): Conversation {
    return this.conversation;
  }

  /**
   * Clear all messages from the conversation history
   */
  clear(): void {
    this.conversation.clear();
  }

  /**
   * Reset the session with a new system message
   */
  resetWithSystem(message: string): void {
    this.conversation.clear();
    this.conversation.addMessage({
      role: 'system',
      content: message,
    });
  }

  /**
   * Get the number of messages in the conversation
   */
  length(): number {
    return this.conversation.getMessages().length;
  }

  /**
   * Check if the conversation is empty
   */
  isEmpty(): boolean {
    return this.conversation.getMessages().length === 0;
  }
}