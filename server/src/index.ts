import { existsSync } from "node:fs";
import http from "node:http";
import { resolve } from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { connectDatabase } from "./lib/db.js";
import { createIoServer } from "./lib/sockets.js";
import authRouter from "./routes/auth.routes.js";
import messageRouter from "./routes/message.routes.js";
import { HttpError } from "./lib/errors.js";

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      env: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/messages", messageRouter);

  // JSON 404 for any unmatched /api route.
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  if (env.isProduction) {
    const clientDistPath = resolve(process.cwd(), "../client/dist");
    const indexPath = resolve(clientDistPath, "index.html");

    if (!existsSync(indexPath)) {
      throw new Error(`Frontend build not found at ${indexPath}`);
    }

    app.use(express.static(clientDistPath));
    app.get("/{*path}", (_req, res, next) => {
      res.sendFile(indexPath, (error) => {
        if (error) {
          next(error);
        }
      });
    });
  }

  // Express 5 forwards rejected promises from async handlers here.
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("[server] unhandled error:", error);
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

async function bootstrap(): Promise<void> {
  await connectDatabase();

  const httpServer = http.createServer(createApp());
  const io = createIoServer(httpServer);

  httpServer.listen(env.port, () => {
    console.log(`[server] ready on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[server] ${signal} received — shutting down`);
    io.close();
    httpServer.close();
    await mongoose.connection.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error: unknown) => {
  console.error("[server] failed to start:", error);
  process.exit(1);
});
