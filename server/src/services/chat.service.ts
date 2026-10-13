import { isValidObjectId, Types } from "mongoose";
import type { HydratedDocument } from "mongoose";
import { HttpError } from "../lib/errors.js";
import { Conversation, type IConversation } from "../models/conversation.model.js";
import { Message, type LeanMessage, type MessageType } from "../models/message.model.js";
import { User } from "../models/user.model.js";

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

export interface SerializedMessage {
  id: string;
  senderId: string;
  receiverId: string;
  conversationId: string;
  messageType: MessageType;
  content: string;
  readBy: string[];
  createdAt: string;
}

export function serializeMessage(message: {
  _id: Types.ObjectId;
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  conversationId: Types.ObjectId;
  messageType: MessageType;
  content: string;
  readBy: Types.ObjectId[];
  createdAt: Date;
}): SerializedMessage {
  return {
    id: String(message._id),
    senderId: String(message.senderId),
    receiverId: String(message.receiverId),
    conversationId: String(message.conversationId),
    messageType: message.messageType,
    content: message.content,
    readBy: message.readBy.map(String),
    createdAt: message.createdAt.toISOString(),
  };
}

export function assertObjectId(value: string, label: string): string {
  if (!isValidObjectId(value)) {
    throw new HttpError(400, `Invalid ${label}`);
  }
  return value;
}

/** Finds the 1:1 conversation between two users or creates it. */
export async function getOrCreateConversation(
  userA: string,
  userB: string,
): Promise<HydratedDocument<IConversation>> {
  const existing = await Conversation.findOne({
    participants: { $all: [userA, userB], $size: 2 },
  });
  if (existing) {
    return existing;
  }
  return Conversation.create({ participants: [userA, userB] });
}

export async function createMessage(input: {
  senderId: string;
  receiverId: string;
  messageType: MessageType;
  content: string;
}): Promise<{ message: SerializedMessage; conversation: HydratedDocument<IConversation> }> {
  const conversation = await getOrCreateConversation(input.senderId, input.receiverId);
  const created = await Message.create({
    senderId: input.senderId,
    receiverId: input.receiverId,
    conversationId: conversation._id,
    messageType: input.messageType,
    content: input.content,
  });

  conversation.lastMessage = created._id;
  conversation.updatedAt = new Date();
  await conversation.save();

  return { message: serializeMessage(created), conversation };
}

export interface ConversationSummary {
  id: string;
  peer: {
    id: string;
    fullName: string;
    username: string;
    avatarUrl: string;
    isOnline: boolean;
  };
  lastMessage: SerializedMessage | null;
  unreadCount: number;
  updatedAt: string;
}

/** All of a user's conversations, newest first, with peer info and unread counts. */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const conversations = await Conversation.find({ participants: userId })
    .populate<{ lastMessage: LeanMessage | null }>("lastMessage")
    .sort({ updatedAt: -1 })
    .lean();

  if (conversations.length === 0) {
    return [];
  }

  const peerIds = [
    ...new Set(
      conversations.flatMap((c) =>
        c.participants.map(String).filter((p) => p !== userId),
      ),
    ),
  ];
  const peers = await User.find({ _id: { $in: peerIds } })
    .select("fullName username avatarUrl isOnline")
    .lean();
  const peersById = new Map(peers.map((peer) => [String(peer._id), peer]));

  const summaries = await Promise.all(
    conversations.map(async (conversation) => {
      const peerId = conversation.participants.map(String).find((p) => p !== userId) ?? "";
      const peerDoc = peersById.get(peerId);
      const unreadCount = await Message.countDocuments({
        conversationId: conversation._id,
        senderId: { $ne: new Types.ObjectId(userId) },
        readBy: { $ne: new Types.ObjectId(userId) },
      });

      return {
        id: String(conversation._id),
        peer: {
          id: peerId,
          fullName: peerDoc?.fullName ?? "Unknown",
          username: peerDoc?.username ?? "unknown",
          avatarUrl: peerDoc?.avatarUrl ?? "",
          isOnline: peerDoc?.isOnline ?? false,
        },
        lastMessage: conversation.lastMessage
          ? serializeMessage(conversation.lastMessage)
          : null,
        unreadCount,
        updatedAt: conversation.updatedAt.toISOString(),
      } satisfies ConversationSummary;
    }),
  );

  return summaries;
}

export interface HistoryPage {
  messages: SerializedMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Chronological message history for the conversation with `peerId`,
 * keyset-paginated on _id (newest page first, returned oldest→newest).
 */
export async function getHistory(
  userId: string,
  peerId: string,
  cursor: string | undefined,
  limitParam: string | undefined,
): Promise<HistoryPage> {
  const limit = Math.min(
    Math.max(Number(limitParam ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );
  if (cursor !== undefined) {
    assertObjectId(cursor, "cursor");
  }

  const conversation = await Conversation.findOne({
    participants: { $all: [userId, peerId], $size: 2 },
  })
    .select("_id")
    .lean();

  if (!conversation) {
    return { messages: [], nextCursor: null, hasMore: false };
  }

  const filter: { conversationId: Types.ObjectId; _id?: { $lt: Types.ObjectId } } = {
    conversationId: conversation._id as Types.ObjectId,
  };
  if (cursor !== undefined) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const fetched = await Message.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();

  const hasMore = fetched.length > limit;
  const page = hasMore ? fetched.slice(0, limit) : fetched;
  page.reverse(); // chronological order within the page

  return {
    messages: page.map((m) => serializeMessage(m as unknown as LeanMessage)),
    nextCursor: hasMore ? String(page[0]._id) : null,
    hasMore,
  };
}

export interface ReadReceipt {
  conversationId: string;
  readerId: string;
  peerId: string;
  messageIds: string[];
}

/** Marks all of the peer's messages in the conversation as read by `readerId`. */
export async function markConversationRead(
  readerId: string,
  conversationId: string,
): Promise<ReadReceipt> {
  assertObjectId(conversationId, "conversationId");

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: readerId,
  });
  if (!conversation) {
    throw new HttpError(404, "Conversation not found");
  }

  const peerId =
    conversation.participants.map(String).find((p) => p !== readerId) ?? "";
  if (!peerId) {
    throw new HttpError(404, "Conversation has no other participant");
  }

  const unread = await Message.find({
    conversationId: conversation._id,
    senderId: peerId,
    readBy: { $ne: new Types.ObjectId(readerId) },
  })
    .select("_id")
    .lean();

  if (unread.length === 0) {
    return {
      conversationId: String(conversation._id),
      readerId,
      peerId,
      messageIds: [],
    };
  }

  const ids = unread.map((m) => m._id);
  await Message.updateMany(
    { _id: { $in: ids } },
    { $addToSet: { readBy: new Types.ObjectId(readerId) } },
  );

  return {
    conversationId: String(conversation._id),
    readerId,
    peerId,
    messageIds: ids.map(String),
  };
}
