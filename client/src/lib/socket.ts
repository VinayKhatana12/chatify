import { io, type Socket } from "socket.io-client";

/**
 * Shared Socket.io client. Connects to the current origin by default, which
 * the Vite dev server proxies to the backend. The auth cookie rides along
 * automatically; call socket.connect() once the session is confirmed.
 */
export const socket: Socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
  autoConnect: false,
  withCredentials: true,
});
