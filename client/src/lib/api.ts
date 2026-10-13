import axios from "axios";

/**
 * Pre-configured axios instance for the Chatify API.
 * Base URL defaults to `/api`, which the Vite dev server proxies to the
 * backend - override with VITE_API_URL for a deployed API.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined;
    if (data?.error) {
      return data.error;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
