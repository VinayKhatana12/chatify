/**
 * Active socket registry — maps socket IDs to user IDs (and back) so the
 * app can deliver events to every device a user is connected from.
 */
const userSockets = new Map<string, Set<string>>();
const socketToUser = new Map<string, string>();

export function registerSocket(userId: string, socketId: string): void {
  socketToUser.set(socketId, userId);
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.add(socketId);
  } else {
    userSockets.set(userId, new Set([socketId]));
  }
}

export function unregisterSocket(userId: string, socketId: string): void {
  socketToUser.delete(socketId);
  const sockets = userSockets.get(userId);
  if (!sockets) {
    return;
  }
  sockets.delete(socketId);
  if (sockets.size === 0) {
    userSockets.delete(userId);
  }
}

export function getSocketIds(userId: string): string[] {
  return [...(userSockets.get(userId) ?? [])];
}

export function getOnlineUserIds(): string[] {
  return [...userSockets.keys()];
}

export function isUserOnline(userId: string): boolean {
  return userSockets.has(userId);
}
