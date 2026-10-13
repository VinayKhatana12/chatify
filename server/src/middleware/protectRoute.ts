import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { HttpError } from "../lib/errors.js";
import { verifyAuthToken } from "../lib/auth.js";
import { User } from "../models/user.model.js";

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Returns the user attached by protectRoute, or throws a 401. */
export function getAuthUser(req: Request): AuthUser {
  if (!req.user) {
    throw new HttpError(401, "Not authenticated");
  }
  return req.user;
}

function extractToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[env.cookieName];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const bearer = header.slice("Bearer ".length).trim();
    if (bearer.length > 0) {
      return bearer;
    }
  }
  return undefined;
}

/**
 * Verifies the JWT from the auth cookie (preferred) or an
 * `Authorization: Bearer <token>` header, loads the user and attaches
 * it to `req.user`. Rejects with 401 otherwise.
 */
export async function protectRoute(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const payload = verifyAuthToken(token);
    if (!payload) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user) {
      res.status(401).json({ error: "User no longer exists" });
      return;
    }

    req.user = {
      id: String(user._id),
      username: user.username,
      fullName: user.fullName,
    };
    next();
  } catch (error) {
    next(error);
  }
}
