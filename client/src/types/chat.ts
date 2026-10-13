export interface User {
  id: string;
  fullName: string;
  username: string;
  email?: string;
  avatarUrl: string;
  lastSeen: string;
  isOnline: boolean;
  createdAt?: string;
}

export type MessageType = "text" | "image";

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  conversationId: string;
  messageType: MessageType;
  content: string;
  readBy: string[];
  createdAt: string;
  /** Optimistic-send markers (client only). */
  pending?: boolean;
  failed?: boolean;
}

export interface Peer {
  id: string;
  fullName: string;
  username: string;
  avatarUrl: string;
  isOnline: boolean;
}

export interface Conversation {
  id: string;
  peer: Peer;
  lastMessage: Message | null;
  unreadCount: number;
  updatedAt: string;
}

export interface HistoryPage {
  messages: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}
