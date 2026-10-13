import { create } from "zustand";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { socket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth";
import type { Conversation, HistoryPage, Message, Peer } from "@/types/chat";

interface SendInput {
  text?: string;
  imageFile?: File;
}

interface ChatState {
  conversations: Conversation[];
  messages: Message[];
  selectedUser: Peer | null;
  onlineUsers: string[];
  isTyping: boolean;
  typingUsers: string[];
  loadingConversations: boolean;
  loadingMessages: boolean;
  hasMore: boolean;
  nextCursor: string | null;

  getConversations: () => Promise<void>;
  selectUser: (peer: Peer) => void;
  clearSelection: () => void;
  getMessages: (userId: string) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  sendMessage: (input: SendInput) => Promise<void>;
  sendTyping: (receiverId: string) => void;
  sendStopTyping: (receiverId: string) => void;
  subscribeToMessages: () => void;
  unsubscribeFromMessages: () => void;
}

let typingTimer: ReturnType<typeof setTimeout> | null = null;
let typingClearTimer: ReturnType<typeof setTimeout> | null = null;
let lastTypingSentAt = 0;

function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/** Replaces one optimistic entry by temp id, keeping the list ordered. */
function confirmMessage(messages: Message[], tempId: string, real: Message): Message[] {
  const withoutTemp = messages.filter((m) => m.id !== tempId);
  if (withoutTemp.some((m) => m.id === real.id)) {
    return withoutTemp;
  }
  return [...withoutTemp, { ...real, pending: false }].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export const useChatStore = create<ChatState>()((set, get) => ({
  conversations: [],
  messages: [],
  selectedUser: null,
  onlineUsers: [],
  isTyping: false,
  typingUsers: [],
  loadingConversations: false,
  loadingMessages: false,
  hasMore: false,
  nextCursor: null,

  getConversations: async () => {
    set({ loadingConversations: get().conversations.length === 0 });
    try {
      const res = await api.get<{ conversations: Conversation[] }>("/messages/conversations");
      set({ conversations: sortConversations(res.data.conversations) });
    } catch {
      // Stale session or transient failure - the auth gate handles real 401s.
    } finally {
      set({ loadingConversations: false });
    }
  },

  selectUser: (peer) => {
    if (typingClearTimer) {
      clearTimeout(typingClearTimer);
      typingClearTimer = null;
    }
    set({
      selectedUser: peer,
      messages: [],
      isTyping: false,
      typingUsers: [],
      hasMore: false,
      nextCursor: null,
    });
    void get().getMessages(peer.id);
  },

  clearSelection: () => {
    set({ selectedUser: null, messages: [], isTyping: false, typingUsers: [] });
  },

  getMessages: async (userId) => {
    set({ loadingMessages: true });
    try {
      const res = await api.get<HistoryPage>(`/messages/${userId}`);
      if (get().selectedUser?.id !== userId) {
        return; // user switched chats mid-flight
      }
      set({
        messages: res.data.messages,
        hasMore: res.data.hasMore,
        nextCursor: res.data.nextCursor,
      });
      const conversation = get().conversations.find(
        (c) => c.peer.id === userId,
      );
      if (conversation && conversation.unreadCount > 0) {
        socket.emit("markAsRead", { conversationId: conversation.id });
        set({
          conversations: get().conversations.map((c) =>
            c.peer.id === userId ? { ...c, unreadCount: 0 } : c,
          ),
        });
      }
    } finally {
      set({ loadingMessages: false });
    }
  },

  loadOlderMessages: async () => {
    const { selectedUser, nextCursor, loadingMessages } = get();
    if (!selectedUser || !nextCursor || loadingMessages) {
      return;
    }
    set({ loadingMessages: true });
    try {
      const res = await api.get<HistoryPage>(
        `/messages/${selectedUser.id}?cursor=${nextCursor}`,
      );
      if (get().selectedUser?.id !== selectedUser.id) {
        return;
      }
      set((state) => ({
        messages: [...res.data.messages, ...state.messages],
        hasMore: res.data.hasMore,
        nextCursor: res.data.nextCursor,
      }));
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not load earlier messages"));
    } finally {
      set({ loadingMessages: false });
    }
  },

  sendMessage: async ({ text, imageFile }) => {
    const { selectedUser } = get();
    if (!selectedUser) {
      return;
    }
    const myId = useAuthStore.getState().user?.id;
    if (!myId) {
      return;
    }

    const tempId = crypto.randomUUID();
    const preview =
      imageFile !== undefined
        ? URL.createObjectURL(imageFile)
        : (text ?? "").trim();
    const optimistic: Message = {
      id: tempId,
      senderId: myId,
      receiverId: selectedUser.id,
      conversationId: "",
      messageType: imageFile !== undefined ? "image" : "text",
      content: preview,
      readBy: [],
      createdAt: new Date().toISOString(),
      pending: true,
    };
    set((state) => ({ messages: [...state.messages, optimistic] }));

    const finalize = (real: Message) => {
      URL.revokeObjectURL(preview);
      set((state) => ({
        messages: confirmMessage(state.messages, tempId, real),
        conversations: sortConversations(
          state.conversations.map((c) =>
            c.peer.id === selectedUser.id
              ? { ...c, lastMessage: real, updatedAt: real.createdAt }
              : c,
          ),
        ),
      }));
    };
    const fail = (message: string) => {
      toast.error(message);
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === tempId ? { ...m, pending: false, failed: true } : m,
        ),
      }));
    };

    // Images always go through the REST endpoint (multipart upload).
    if (imageFile !== undefined) {
      const form = new FormData();
      form.append("image", imageFile);
      try {
        const res = await api.post<{ message: Message }>(
          `/messages/send/${selectedUser.id}`,
          form,
        );
        finalize(res.data.message);
      } catch (error) {
        URL.revokeObjectURL(preview);
        fail(getErrorMessage(error, "Upload failed"));
      }
      return;
    }

    const content = (text ?? "").trim();
    if (!content) {
      set((state) => ({ messages: state.messages.filter((m) => m.id !== tempId) }));
      return;
    }

    if (!socket.connected) {
      try {
        const res = await api.post<{ message: Message }>(
          `/messages/send/${selectedUser.id}`,
          { content },
        );
        finalize(res.data.message);
      } catch (error) {
        fail(getErrorMessage(error, "Message not delivered"));
      }
      return;
    }

    socket.timeout(8000).emit(
      "sendMessage",
      { receiverId: selectedUser.id, messageType: "text", content },
      (err: unknown, ack: { ok: boolean; message?: Message; error?: string } | undefined) => {
        if (err || !ack?.ok || !ack.message) {
          fail(ack?.error ?? "Message not delivered");
          return;
        }
        finalize(ack.message);
      },
    );
  },

  sendTyping: (receiverId) => {
    const now = Date.now();
    if (now - lastTypingSentAt < 1100) {
      return; // throttle: at most one typing signal per ~1.1s
    }
    lastTypingSentAt = now;
    socket.emit("typing", { receiverId });
    if (typingTimer) {
      clearTimeout(typingTimer);
    }
    typingTimer = setTimeout(() => {
      socket.emit("stopTyping", { receiverId });
    }, 1600);
  },

  sendStopTyping: (receiverId) => {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    lastTypingSentAt = 0;
    socket.emit("stopTyping", { receiverId });
  },

  subscribeToMessages: () => {
    socket.off("getOnlineUsers");
    socket.off("newMessage");
    socket.off("typing");
    socket.off("stopTyping");
    socket.off("messagesRead");

    socket.on("getOnlineUsers", (ids: string[]) => {
      set({ onlineUsers: ids });
    });

    socket.on("newMessage", (message: Message) => {
      const { selectedUser } = get();
      const myId = useAuthStore.getState().user?.id ?? "";
      const peerId = message.senderId === myId ? message.receiverId : message.senderId;

      set((state) => {
        const existing = state.conversations.find((c) => c.peer.id === peerId);
        const conversations = sortConversations(
          state.conversations.map((c) =>
            c.peer.id === peerId
              ? { ...c, lastMessage: message, updatedAt: message.createdAt }
              : c,
          ),
        );
        // Conversation might be brand new - refresh the list in the background.
        if (!existing) {
          void get().getConversations();
        }

        const isActiveChat = selectedUser?.id === message.senderId;
        if (isActiveChat) {
          socket.timeout(5000).emit("markAsRead", { conversationId: message.conversationId });
          return {
            conversations: conversations.map((c) =>
              c.peer.id === peerId ? { ...c, unreadCount: 0 } : c,
            ),
            messages: [...state.messages, message],
          };
        }
        return {
          conversations: conversations.map((c) =>
            c.peer.id === peerId ? { ...c, unreadCount: c.unreadCount + 1 } : c,
          ),
        };
      });

      if (get().selectedUser?.id !== message.senderId) {
        const sender = get().conversations.find((c) => c.peer.id === message.senderId);
        toast(`New message from ${sender?.peer.fullName ?? "someone"}`, {
          description: message.messageType === "image" ? "Photo" : message.content,
        });
      }
    });

    socket.on("typing", ({ senderId }: { senderId: string }) => {
      const { selectedUser } = get();
      if (selectedUser?.id !== senderId) {
        return;
      }
      if (typingClearTimer) {
        clearTimeout(typingClearTimer);
      }
      set({ isTyping: true, typingUsers: [senderId] });
      typingClearTimer = setTimeout(() => {
        set({ isTyping: false, typingUsers: [] });
      }, 3000); // safety expiry if stopTyping is lost
    });

    socket.on("stopTyping", ({ senderId }: { senderId: string }) => {
      const { selectedUser } = get();
      if (selectedUser?.id !== senderId) {
        return;
      }
      if (typingClearTimer) {
        clearTimeout(typingClearTimer);
        typingClearTimer = null;
      }
      set({ isTyping: false, typingUsers: typingUsersWithout(senderId) });
    });

    socket.on(
      "messagesRead",
      ({ readerId, messageIds }: { readerId: string; messageIds: string[] }) => {
        const { selectedUser } = get();
        if (selectedUser?.id !== readerId) {
          return;
        }
        const ids = new Set(messageIds);
        set((state) => ({
          messages: state.messages.map((m) =>
            ids.has(m.id) && !m.readBy.includes(readerId)
              ? { ...m, readBy: [...m.readBy, readerId] }
              : m,
          ),
        }));
      },
    );
  },

  unsubscribeFromMessages: () => {
    socket.off("getOnlineUsers");
    socket.off("newMessage");
    socket.off("typing");
    socket.off("stopTyping");
    socket.off("messagesRead");
    set({ isTyping: false, typingUsers: [], onlineUsers: [] });
  },
}));

function typingUsersWithout(senderId: string): string[] {
  return useChatStore
    .getState()
    .typingUsers.filter((id) => id !== senderId);
}
