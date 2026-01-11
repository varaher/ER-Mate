export interface Conversation {
  id: number;
  title: string;
  createdAt: Date;
}

export interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: Date;
}

export interface IChatStorage {
  getConversation(id: number): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(title: string): Promise<Conversation>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<Message>;
}

const conversations: Map<number, Conversation> = new Map();
const messages: Map<number, Message[]> = new Map();
let conversationIdCounter = 1;
let messageIdCounter = 1;

export const chatStorage: IChatStorage = {
  async getConversation(id: number) {
    return conversations.get(id);
  },

  async getAllConversations() {
    return Array.from(conversations.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async createConversation(title: string) {
    const conversation: Conversation = {
      id: conversationIdCounter++,
      title,
      createdAt: new Date(),
    };
    conversations.set(conversation.id, conversation);
    messages.set(conversation.id, []);
    return conversation;
  },

  async deleteConversation(id: number) {
    conversations.delete(id);
    messages.delete(id);
  },

  async getMessagesByConversation(conversationId: number) {
    return messages.get(conversationId) || [];
  },

  async createMessage(conversationId: number, role: string, content: string) {
    const message: Message = {
      id: messageIdCounter++,
      conversationId,
      role,
      content,
      createdAt: new Date(),
    };
    const convMessages = messages.get(conversationId) || [];
    convMessages.push(message);
    messages.set(conversationId, convMessages);
    return message;
  },
};
