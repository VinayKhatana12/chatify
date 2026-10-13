import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("error", (error: Error) => {
    console.error("[db] connection error:", error.message);
  });

  await mongoose.connect(env.mongoUri);
  console.log(`[db] connected to ${mongoose.connection.name}`);
}
