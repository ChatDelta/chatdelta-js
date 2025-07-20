import { Message, Conversation as IConversation } from './types';

export class Conversation implements IConversation {
  public messages: Message[] = [];

  addMessage(message: Message): void {
    this.messages.push(message);
  }

  addUserMessage(content: string): void {
    this.addMessage({ role: 'user', content });
  }

  addAssistantMessage(content: string): void {
    this.addMessage({ role: 'assistant', content });
  }

  addSystemMessage(content: string): void {
    this.addMessage({ role: 'system', content });
  }

  clear(): void {
    this.messages = [];
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  getLastMessage(): Message | undefined {
    return this.messages[this.messages.length - 1];
  }

  getMessageCount(): number {
    return this.messages.length;
  }
}