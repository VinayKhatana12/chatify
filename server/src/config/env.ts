import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  isProduction: process.env.NODE_ENV === "production",

  mongoUri: required("MONGO_URI", "mongodb://127.0.0.1:27017/chatify"),
  jwtSecret: required("JWT_SECRET", "dev-only-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",

  cookieName: process.env.COOKIE_NAME ?? "chatify_token",
  cookieMaxAgeMs: Number(process.env.COOKIE_MAX_AGE_MS ?? 7 * 24 * 60 * 60 * 1000),

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },

  clientOrigins: (process.env.CLIENT_URL ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
