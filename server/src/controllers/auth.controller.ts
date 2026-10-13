import type { Request, Response } from "express";
import type { CookieOptions } from "express";
import type { HydratedDocument } from "mongoose";
import { env } from "../config/env.js";
import { hashPassword, signAuthToken, verifyAuthToken, verifyPassword } from "../lib/auth.js";
import { parseSignupInput } from "../lib/validate.js";
import { User, type IUser } from "../models/user.model.js";

export interface UserPublic {
  id: string;
  fullName: string;
  username: string;
  email: string;
  avatarUrl: string;
  lastSeen: Date;
  isOnline: boolean;
  createdAt: Date;
}

function toPublicUser(user: HydratedDocument<IUser>): UserPublic {
  return {
    id: String(user._id),
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    lastSeen: user.lastSeen,
    isOnline: user.isOnline,
    createdAt: user.createdAt,
  };
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    maxAge: env.cookieMaxAgeMs,
    path: "/",
  };
}

function setAuthCookie(res: Response, token: string): void {
  res.cookie(env.cookieName, token, cookieOptions());
}

function isMongoDuplicateError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export async function signup(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const parsed = parseSignupInput(body);
  if (!parsed.ok) {
    res.status(400).json({ error: "Validation failed", fields: parsed.errors });
    return;
  }
  const { fullName, username, email, password } = parsed.value;

  const existing = await User.findOne({ $or: [{ username }, { email }] }).lean();
  if (existing) {
    const field = existing.username === username ? "username" : "email";
    res.status(409).json({ error: `An account with this ${field} already exists` });
    return;
  }

  let user: HydratedDocument<IUser>;
  try {
    user = await User.create({
      fullName,
      username,
      email,
      passwordHash: await hashPassword(password),
    });
  } catch (error) {
    if (isMongoDuplicateError(error)) {
      res.status(409).json({ error: "An account with this username or email already exists" });
      return;
    }
    throw error;
  }

  const token = signAuthToken({ sub: String(user._id), username: user.username });
  setAuthCookie(res, token);
  res.status(201).json({ user: toPublicUser(user) });
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawIdentifier = body.identifier ?? body.email ?? body.username;
  const identifier = String(rawIdentifier ?? "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!identifier || !password) {
    res.status(400).json({ error: "identifier and password are required" });
    return;
  }

  const user = await User.findOne({
    $or: [{ username: identifier }, { email: identifier }],
  }).select("+passwordHash");

  const passwordOk = user?.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : false;
  if (!user || !passwordOk) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signAuthToken({ sub: String(user._id), username: user.username });
  setAuthCookie(res, token);
  res.json({ user: toPublicUser(user) });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[env.cookieName];
  const payload = typeof token === "string" ? verifyAuthToken(token) : null;
  if (payload) {
    // Best effort — mark the user offline even as their session ends.
    await User.findByIdAndUpdate(payload.sub, { isOnline: false, lastSeen: new Date() });
  }
  res.clearCookie(env.cookieName, cookieOptions());
  res.json({ message: "Logged out" });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const user = await User.findById(req.user.id).select("-passwordHash");
  if (!user) {
    res.status(401).json({ error: "User no longer exists" });
    return;
  }
  res.json({ user: toPublicUser(user) });
}
