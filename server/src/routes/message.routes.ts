import { Router } from "express";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { getConversations, getMessages, sendMessage } from "../controllers/message.controller.js";
import { HttpError } from "../lib/errors.js";
import { protectRoute } from "../middleware/protectRoute.js";

const messageRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new HttpError(400, "Only image uploads are supported"));
    }
  },
});

messageRouter.use(protectRoute);

messageRouter.get("/conversations", getConversations);

messageRouter.get("/:userId", getMessages);

messageRouter.post(
  "/send/:userId",
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        next(err instanceof HttpError ? err : new HttpError(400, err.message));
        return;
      }
      next();
    });
  },
  sendMessage,
);

export default messageRouter;
