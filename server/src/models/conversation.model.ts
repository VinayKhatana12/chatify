import { model, Schema, Types } from "mongoose";

export interface IConversation {
  participants: Types.ObjectId[];
  lastMessage: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

export const Conversation = model<IConversation>("Conversation", conversationSchema);
