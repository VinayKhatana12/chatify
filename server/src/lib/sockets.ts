import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { env } from "../config/env.js";
import { HttpError } from "./errors.js";
import { verifyAuthToken } from "./auth.js";
import {
  getOnlineUserIds,
  getSocketIds,
  registerSocket,
  unregisterSocket,
} from "./socketRegistry.js";
import type { AuthUser } from "../middleware/protectRoute.js";
import { User } from "../models/user.model.js";
import {
  assertObjectId,
  createMessage,
  markConversationRead,
} from "../services/chat.service.js";

export interface SendMessagePayload {
  receiverId?: unknown;
  content?: unknown;
  messageType?: unknown;
}

type AckResponse =
  | { ok: true; message: import("../services/chat.service.js").SerializedMessage }
  | { ok: false; error: string };

let ioRef: Server | null = null;

/** Emits an event to every socket a user currently has open. */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!ioRef) {
    return;
  }
  for (const socketId of getSocketIds(userId)) {
    ioRef.to(socketId).emit(event, payload);
  }
}

function tokenFromHandshake(socket: Socket): string | undefined {
  const auth = socket.handshake.auth?.token;
  if (typeof auth === "string" && auth.length > 0) {
    return auth;
  }

  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${env.cookieName}=([^;]*)`));
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return undefined;
}

function broadcastOnlineUsers(io: Server): void {
  io.emit("getOnlineUsers", getOnlineUserIds());
}

function emitTypingStatus(
  socket: Socket,
  event: "typing" | "stopTyping",
  payload: { receiverId?: unknown },
): void {
  const sender = socket.data.user as AuthUser;
  const receiverId = typeof payload?.receiverId === "string" ? payload.receiverId : "";
  if (!receiverId || receiverId === sender.id || !/^[0-9a-fA-F]{24}$/.test(receiverId)) {
    return;
  }
  for (const socketId of getSocketIds(receiverId)) {
    socket.to(socketId).emit(event, { senderId: sender.id });
  }
}

export function createIoServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigins,
      credentials: true,
    },
  });
  ioRef = io;

  io.use(async (socket, next) => {
    const token = tokenFromHandshake(socket);
    const payload = token ? verifyAuthToken(token) : null;
    const user = payload ? await User.findById(payload.sub).select("username fullName") : null;
    if (!user) {
      return next(new Error("unauthorized"));
    }

    socket.data.user = {
      id: String(user._id),
      username: user.username,
      fullName: user.fullName,
    } satisfies AuthUser;
    next();
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user as AuthUser;
    console.log(`[io] connected: ${user.username} (${socket.id})`);

    registerSocket(user.id, socket.id);
    void User.findByIdAndUpdate(user.id, { isOnline: true, lastSeen: new Date() });
    broadcastOnlineUsers(io);

    // ── sendMessage: persist, then deliver to the receiver's live sockets ──
    socket.on("sendMessage", async (payload: SendMessagePayload, ack?: (res: AckResponse) => void) => {
      try {
        const sender = socket.data.user as AuthUser;
        const receiverId = assertObjectId(String(payload?.receiverId ?? ""), "receiverId");
        const messageType = payload?.messageType === "image" ? "image" : "text";
        const content = String(payload?.content ?? "").trim();

        if (messageType === "text" && content.length === 0) {
          throw new HttpError(400, "Message content is required");
        }
        if (content.length > 4000) {
          throw new HttpError(400, "Message content is too long (max 4000 characters)");
        }
        if (receiverId === sender.id) {
          throw new HttpError(400, "You cannot send a message to yourself");
        }
        const receiver = await User.findById(receiverId).select("_id");
        if (!receiver) {
          throw new HttpError(404, "Receiver not found");
        }

        const { message } = await createMessage({
          senderId: sender.id,
          receiverId,
          messageType,
          content,
        });

        for (const socketId of getSocketIds(receiverId)) {
          io.to(socketId).emit("newMessage", message);
        }

        ack?.({ ok: true, message });
      } catch (error) {
        const messageText =
          error instanceof HttpError ? error.message : "Failed to send message";
        console.error("[io] sendMessage failed:", error);
        ack?.({ ok: false, error: messageText });
      }
    });

    // ── typing / stopTyping: relay the sender's status to the receiver ──
    socket.on("typing", (payload: { receiverId?: unknown }) =>
      emitTypingStatus(socket, "typing", payload),
    );
    socket.on("stopTyping", (payload: { receiverId?: unknown }) =>
      emitTypingStatus(socket, "stopTyping", payload),
    );

    // ── markAsRead: flag the peer's messages read and notify the peer ──
    socket.on("markAsRead", async (payload: { conversationId?: unknown }, ack?: (res: { ok: boolean; error?: string; updatedCount?: number }) => void) => {
      try {
        const reader = socket.data.user as AuthUser;
        const receipt = await markConversationRead(
          reader.id,
          String(payload?.conversationId ?? ""),
        );

        if (receipt.messageIds.length > 0) {
          emitToUser(receipt.peerId, "messagesRead", {
            conversationId: receipt.conversationId,
            readerId: receipt.readerId,
            messageIds: receipt.messageIds,
          });
        }
        ack?.({ ok: true, updatedCount: receipt.messageIds.length });
      } catch (error) {
        const messageText =
          error instanceof HttpError ? error.message : "Failed to mark messages as read";
        console.error("[io] markAsRead failed:", error);
        ack?.({ ok: false, error: messageText });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[io] disconnected: ${user.username} (${reason})`);

      unregisterSocket(user.id, socket.id);
      if (!getSocketIds(user.id).length) {
        void User.findByIdAndUpdate(user.id, { isOnline: false, lastSeen: new Date() });
      }
      broadcastOnlineUsers(io);
    });
  });

  return io;
}
