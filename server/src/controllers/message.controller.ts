import type { Request, Response } from "express";
import { HttpError } from "../lib/errors.js";
import { uploadImage } from "../lib/cloudinary.js";
import { emitToUser } from "../lib/sockets.js";
import { getAuthUser } from "../middleware/protectRoute.js";
import {
  assertObjectId,
  createMessage,
  getHistory,
  listConversations,
} from "../services/chat.service.js";
import { User } from "../models/user.model.js";

/** GET /api/messages/conversations — active conversations with lastMessage + unread count. */
export async function getConversations(req: Request, res: Response): Promise<void> {
  const conversations = await listConversations(getAuthUser(req).id);
  res.json({ conversations });
}

/** GET /api/messages/:userId — chronological history, cursor-paginated. */
export async function getMessages(req: Request, res: Response): Promise<void> {
  const userId = getAuthUser(req).id;
  const peerId = assertObjectId(String(req.params.userId), "userId");

  const peer = await User.findById(peerId).select("_id");
  if (!peer) {
    throw new HttpError(404, "User not found");
  }

  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const limit = typeof req.query.limit === "string" ? req.query.limit : undefined;

  const page = await getHistory(userId, peerId, cursor, limit);
  res.json(page);
}

/** POST /api/messages/send/:userId — JSON text message or multipart image upload. */
export async function sendMessage(req: Request, res: Response): Promise<void> {
  const userId = getAuthUser(req).id;
  const receiverId = assertObjectId(String(req.params.userId), "userId");

  if (receiverId === userId) {
    throw new HttpError(400, "You cannot send a message to yourself");
  }
  const receiver = await User.findById(receiverId).select("_id");
  if (!receiver) {
    throw new HttpError(404, "User not found");
  }

  let messageType: "text" | "image" = "text";
  let content: string;

  if (req.file) {
    messageType = "image";
    content = await uploadImage(req.file.buffer, req.file.originalname);
  } else {
    content = String(req.body?.content ?? "").trim();
    if (content.length === 0) {
      throw new HttpError(400, "Message content is required");
    }
    if (content.length > 4000) {
      throw new HttpError(400, "Message content is too long (max 4000 characters)");
    }
  }

  const { message } = await createMessage({ senderId: userId, receiverId, messageType, content });

  emitToUser(receiverId, "newMessage", message);

  res.status(201).json({ message });
}
