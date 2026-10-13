import { model, Schema, Types } from "mongoose";

export type MessageType = "text" | "image";

export interface IMessage {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  conversationId: Types.ObjectId;
  messageType: MessageType;
  content: string;
  readBy: Types.ObjectId[];
  createdAt: Date;
}

/** IMessage as returned by lean queries (including _id). */
export type LeanMessage = IMessage & { _id: Types.ObjectId };

const messageSchema = new Schema<IMessage>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    messageType: {
      type: String,
      enum: ["text", "image"],
      default: "text",
    },
    // For text messages this is the message body; for images, the asset URL.
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    readBy: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Sorted history lookup per conversation.
messageSchema.index({ conversationId: 1, createdAt: -1 });

export const Message = model<IMessage>("Message", messageSchema);
