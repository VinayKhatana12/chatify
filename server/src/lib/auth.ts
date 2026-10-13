import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

const SALT_ROUNDS = 12;

export interface AuthTokenPayload {
  sub: string;
  username: string;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAuthToken(payload: AuthTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.jwtSecret, options);
}

/** Returns the payload for a valid, unexpired token — null otherwise. */
export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (typeof payload === "string") {
      return null;
    }
    const { sub, username } = payload;
    if (typeof sub !== "string" || typeof username !== "string") {
      return null;
    }
    return { sub, username };
  } catch {
    return null;
  }
}
