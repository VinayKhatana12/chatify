import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { env } from "../config/env.js";
import { HttpError } from "./errors.js";

let configured = false;

function ensureConfigured(): void {
  if (configured) {
    return;
  }
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new HttpError(
      503,
      "Media uploads are not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET",
    );
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  configured = true;
}

/** Uploads an image buffer to Cloudinary and returns the hosted URL. */
export function uploadImage(buffer: Buffer, filename = "upload"): Promise<string> {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "chatify",
        resource_type: "image",
        public_id: `${Date.now()}-${filename.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "_")}`,
      },
      (error, result) => {
        if (error) {
          reject(new HttpError(502, `Image upload failed: ${error.message}`));
          return;
        }
        if (!result?.secure_url) {
          reject(new HttpError(502, "Image upload failed: empty response"));
          return;
        }
        resolve(result.secure_url);
      },
    );

    Readable.from(buffer).pipe(stream);
  });
}
