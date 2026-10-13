# Chatify

Production-ready scaffold for a full-stack realtime chat application, organized
as two independently installable folders (dual-folder layout, shared repo).

## Stack

| Folder | What's inside |
| --- | --- |
| `server/` | Node.js + Express 5, TypeScript (ESM, strict), Socket.io, Mongoose (MongoDB), JWT auth (bcryptjs + jsonwebtoken, httpOnly cookie), cookie-parser, cors, dotenv |
| `client/` | React 19 + Vite 8, TypeScript (strict), Tailwind CSS v4, Zustand, Socket.io-client, Axios, Sonner, lucide-react |

## Getting started

Prerequisites: **Node.js ≥ 20.19** and a reachable MongoDB instance (local or
MongoDB Atlas).

```bash
# 1 — Backend (terminal 1)
cd server
cp .env.example .env          # then edit MONGO_URI / JWT_SECRET
npm install
npm run dev                   # → http://localhost:5000 (GET /api/health)

# 2 — Frontend (terminal 2)
cd client
cp .env.example .env
npm install
npm run dev                   # → http://localhost:5173
```

The Vite dev server proxies `/api` and `/socket.io` to the backend, so the
client works with same-origin requests in development (no CORS setup needed).

## Data model (`server/src/models/`)

| Model | Fields |
| --- | --- |
| `User` | fullName, username (unique, lowercase), email (unique, lowercase), passwordHash (`select: false`), avatarUrl, lastSeen, isOnline |
| `Message` | senderId → User, receiverId → User, conversationId → Conversation, messageType (`text` \| `image`), content, readBy (User ids), createdAt |
| `Conversation` | participants (User ids), lastMessage → Message |

## Auth API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | — | Validates input, hashes the password (bcryptjs), creates the user, sets the JWT cookie |
| POST | `/api/auth/login` | — | `{ identifier, password }` (username or email) → verifies credentials, sets the JWT cookie |
| POST | `/api/auth/logout` | — | Clears the cookie, marks the user offline |
| GET | `/api/auth/me` | ✔ | Returns the current user; guarded by `protectRoute` |

## Messages API

All routes require auth (`protectRoute`).

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/messages/conversations` | The user's conversations, newest first — each with peer info, populated `lastMessage` and `unreadCount` |
| GET | `/api/messages/:userId?limit=&cursor=` | Chronological history with the peer; keyset pagination (`cursor` = `_id` of the oldest message of the previous page, max limit 50) |
| POST | `/api/messages/send/:userId` | JSON `{ content }` for text, or `multipart/form-data` with an `image` file (≤5 MB) uploaded to Cloudinary |

## Realtime (Socket.io)

The handshake requires a valid JWT — via the auth cookie (the Vite dev proxy
forwards it automatically) or `auth: { token }`. Connections without one are
rejected.

- **Presence**: a registry maps socket IDs ↔ user IDs (`server/src/lib/socketRegistry.ts`),
  multi-device safe. Every connect/disconnect broadcasts `getOnlineUsers`
  (array of online user IDs) to all clients. `isOnline`/`lastSeen` are
  persisted on the User document.
- **Client → server events**:
  - `sendMessage({ receiverId, content, messageType })` with an ack — persists
    the message, upserts the conversation, emits `newMessage` to the
    receiver's sockets.
  - `typing({ receiverId })` / `stopTyping({ receiverId })` — relayed to the
    receiver as `typing` / `stopTyping` with `{ senderId }`.
  - `markAsRead({ conversationId })` with an ack — adds the reader to
    `readBy` on the peer's messages, emits `messagesRead` to the peer.
- **Server → client events**: `getOnlineUsers`, `newMessage`, `typing`,
  `stopTyping`, `messagesRead`.

**Token transport** — `protectRoute` (`server/src/middleware/protectRoute.ts`)
verifies the JWT from the httpOnly cookie (`chatify_token`) or an
`Authorization: Bearer <token>` header, loads the user from the database and
attaches it to `req.user`. The login/signup cookie is `httpOnly`,
`sameSite=lax`, `secure` in production. The Socket.io handshake accepts the
same token via the `auth.token` payload or the cookie header; unauthenticated
sockets are rejected. User `isOnline`/`lastSeen` are updated on connect and
disconnect.

## Scripts

| Folder | Script | Command runs |
| --- | --- | --- |
| `server/` | `npm run dev` | `tsx watch src/index.ts` — live-reload dev server |
| | `npm run build` | Type-checks and emits JS to `dist/` |
| | `npm start` | Runs the compiled `dist/index.js` |
| | `npm run typecheck` | `tsc --noEmit` |
| `client/` | `npm run dev` | Vite dev server on port 5173 |
| | `npm run build` | `tsc -b && vite build` → `dist/` |
| | `npm run preview` | Serves the production build locally |
| | `npm run typecheck` | `tsc -b --force` |

## Notes

- **Tailwind v4 is configured CSS-first** — the design system lives in
  `client/src/index.css` (`@theme` tokens on the zinc scale, class-based dark
  mode via the `.dark` class on `<html>`). There is intentionally no
  `tailwind.config.js`.
- **Env handling**: `.env.example` files in both folders document every
  variable; real `.env` files are git-ignored.
- **Cloudinary**: optional — leave the three `CLOUDINARY_*` vars empty to run
  text-only; image uploads then respond `503` until configured.
- **Integration check**: with a server running on `:5050` (e.g. against
  `mongodb-memory-server`), `node chat-integration.test.mjs` inside `client/`
  exercises the realtime events and message endpoints end-to-end (29 checks).
