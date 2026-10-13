import { model, Schema } from "mongoose";

export interface IUser {
  fullName: string;
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl: string;
  lastSeen: Date;
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]+$/;

const userSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 60,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: USERNAME_PATTERN,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: EMAIL_PATTERN,
    },
    // Excluded from query results by default; use .select("+passwordHash")
    // where the hash is genuinely needed (login).
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: "" },
    lastSeen: { type: Date, default: () => new Date() },
    isOnline: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const User = model<IUser>("User", userSchema);
