/* Chatify real-time + REST integration test. Run: node chat-integration.test.mjs */
import { io } from "socket.io-client";

const BASE = "http://localhost:5050";
const URL = BASE;
let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`PASS ${name}`);
  } else {
    failures.push(name);
    console.log(`FAIL ${name} ${detail}`);
  }
}

function waitForEvent(socket, event, predicate, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout waiting for "${event}"`));
    }, timeoutMs);
    const handler = (payload) => {
      let ok = false;
      try {
        ok = predicate(payload);
      } catch {
        ok = false;
      }
      if (ok) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      }
    };
    socket.on(event, handler);
  });
}

function connectUser(token) {
  return new Promise((resolve, reject) => {
    const socket = io(URL, { auth: { token }, reconnection: false, timeout: 6000 });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (err) => reject(new Error(err.message)));
  });
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`ack timeout for "${event}"`)), 6000);
    socket.emit(event, payload, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

async function api(path, { method = "GET", token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  const setCookie = res.headers.get("set-cookie") ?? "";
  const cookieToken = /chatify_token=([^;]+)/.exec(setCookie)?.[1] ?? null;
  return { status: res.status, json, cookieToken };
}

/* ── setup: two users ── */
async function ensureUser(fullName, username) {
  let res = await api("/api/auth/signup", {
    method: "POST",
    body: { fullName, username, email: `${username}@example.com`, password: "password123" },
  });
  if (res.status !== 201) {
    res = await api("/api/auth/login", {
      method: "POST",
      body: { identifier: username, password: "password123" },
    });
  }
  if (res.status !== 200 && res.status !== 201 || !res.cookieToken) {
    throw new Error(`setup failed for ${username}: ${JSON.stringify(res)}`);
  }
  const token = res.cookieToken;
  const me = await api("/api/auth/me", { token });
  if (me.status !== 200) {
    throw new Error(`me failed for ${username}: ${JSON.stringify(me)}`);
  }
  return { token, id: me.json.user.id };
}

const ada = await ensureUser("Ada Lovelace", "ada");
const alan = await ensureUser("Alan Turing", "alan");
console.log(`setup: ada=${ada.id} alan=${alan.id}`);

/* ── 1. registry + getOnlineUsers broadcast on connect ── */
const adaOnlineFeed = [];
ada.token && (await 0);
const adaSocket = await connectUser(ada.token);
const onlinePromise = waitForEvent(adaSocket, "getOnlineUsers", (ids) => ids.length >= 1);
const firstOnline = await onlinePromise;
check("connect: ada receives getOnlineUsers with her id", firstOnline.includes(ada.id), JSON.stringify(firstOnline));

const bothPromise = waitForEvent(
  adaSocket,
  "getOnlineUsers",
  (ids) => ids.includes(ada.id) && ids.includes(alan.id),
);
const alanSocket = await connectUser(alan.token);
const bothOnline = await bothPromise;
check("connect: getOnlineUsers broadcast includes both users", true, JSON.stringify(bothOnline));

/* ── 2. typing / stopTyping ── */
const typingPromise = waitForEvent(
  alanSocket,
  "typing",
  (p) => p.senderId === ada.id,
);
adaSocket.emit("typing", { receiverId: alan.id });
const typing = await typingPromise;
check("typing: receiver gets senderId", typing.senderId === ada.id);

const stopPromise = waitForEvent(
  alanSocket,
  "stopTyping",
  (p) => p.senderId === ada.id,
);
adaSocket.emit("stopTyping", { receiverId: alan.id });
await stopPromise;
check("stopTyping: receiver notified", true);

/* ── 3. sendMessage via socket: ack + delivery + persistence ── */
const newMessagePromise = waitForEvent(
  alanSocket,
  "newMessage",
  (m) => m.senderId === ada.id,
);
const sendAck = await emitWithAck(adaSocket, "sendMessage", {
  receiverId: alan.id,
  messageType: "text",
  content: "hello alan",
});
check("sendMessage: ack ok with persisted message", sendAck.ok === true && !!sendAck.message?.id);
const m1 = sendAck.message;
const delivered = await newMessagePromise;
check(
  "sendMessage: receiver gets newMessage in real time",
  delivered.content === "hello alan" && delivered.conversationId === m1.conversationId,
);

const selfAck = await emitWithAck(adaSocket, "sendMessage", {
  receiverId: ada.id,
  content: "note to self",
});
check("sendMessage: sending to self rejected", selfAck.ok === false && /yourself/.test(selfAck.error));

const ghostAck = await emitWithAck(adaSocket, "sendMessage", {
  receiverId: "5f1f3f3f3f3f3f3f3f3f3f3f",
  content: "anyone there?",
});
check("sendMessage: unknown receiver rejected", ghostAck.ok === false && /not found/i.test(ghostAck.error));

/* ── 4. REST: conversations with lastMessage + unread count ── */
const convAlan = await api("/api/messages/conversations", { token: alan.token });
const conv = convAlan.json.conversations?.[0];
check(
  "conversations: alan sees 1 conversation",
  convAlan.status === 200 && convAlan.json.conversations.length === 1,
);
check(
  "conversations: peer info correct",
  conv.peer.id === ada.id && conv.peer.username === "ada",
  JSON.stringify(conv.peer),
);
check(
  "conversations: lastMessage populated",
  conv.lastMessage?.content === "hello alan" && conv.lastMessage?.messageType === "text",
);
check("conversations: unreadCount is 1", conv.unreadCount === 1, String(conv.unreadCount));

/* ── 5. REST send text → receiver online gets newMessage ── */
const restDeliverPromise = waitForEvent(
  alanSocket,
  "newMessage",
  (m) => m.content === "rest hello",
);
const restSend = await api(`/api/messages/send/${alan.id}`, {
  method: "POST",
  token: ada.token,
  body: { content: "rest hello" },
});
check("REST send: 201 with message", restSend.status === 201 && restSend.json.message?.content === "rest hello");
await restDeliverPromise;
check("REST send: online receiver gets newMessage push", true);

/* ── 6. REST history chronological ── */
const hist = await api(`/api/messages/${ada.id}?limit=50`, { token: alan.token });
check(
  "history: 2 messages chronological",
  hist.json.messages.length === 2 &&
    hist.json.messages[0].content === "hello alan" &&
    hist.json.messages[1].content === "rest hello" &&
    hist.json.messages[0].createdAt <= hist.json.messages[1].createdAt,
);
check("history: hasMore false, nextCursor null on single page", hist.json.hasMore === false && hist.json.nextCursor === null);

/* ── 7. cursor-based pagination across 5 messages ── */
for (const content of ["m3", "m4", "m5"]) {
  const r = await api(`/api/messages/send/${alan.id}`, {
    method: "POST",
    token: ada.token,
    body: { content },
  });
  if (r.status !== 201) throw new Error(`pagination setup failed: ${JSON.stringify(r)}`);
}

const page1 = await api(`/api/messages/${ada.id}?limit=2`, { token: alan.token });
check(
  "pagination page1: newest 2 in chronological order",
  page1.json.messages.map((m) => m.content).join(",") === "m4,m5" && page1.json.hasMore === true,
  JSON.stringify(page1.json.messages.map((m) => m.content)),
);
const page2 = await api(`/api/messages/${ada.id}?limit=2&cursor=${page1.json.nextCursor}`, { token: alan.token });
check(
  "pagination page2: next 2 older, chronological",
  page2.json.messages.map((m) => m.content).join(",") === "rest hello,m3" && page2.json.hasMore === true,
  JSON.stringify(page2.json.messages.map((m) => m.content)),
);
const page3 = await api(`/api/messages/${ada.id}?limit=2&cursor=${page2.json.nextCursor}`, { token: alan.token });
check(
  "pagination page3: oldest message, exhausted",
  page3.json.messages.map((m) => m.content).join(",") === "hello alan" &&
    page3.json.hasMore === false &&
    page3.json.nextCursor === null,
);

/* ── 8. markAsRead via socket ── */
const readPromise = waitForEvent(
  adaSocket,
  "messagesRead",
  (p) => p.readerId === alan.id && p.messageIds.length === 5,
);
const readAck = await emitWithAck(alanSocket, "markAsRead", { conversationId: conv.id });
check("markAsRead: ack reports 5 updated", readAck.ok === true && readAck.updatedCount === 5, JSON.stringify(readAck));
await readPromise;
check("markAsRead: sender notified with messageIds", true);

const convAfter = await api("/api/messages/conversations", { token: alan.token });
check("conversations: unreadCount drops to 0 after markAsRead", convAfter.json.conversations[0].unreadCount === 0);

/* ── 9. error paths ── */
const badCursor = await api(`/api/messages/${ada.id}?cursor=notanobjectid`, { token: alan.token });
check("history: invalid cursor → 400", badCursor.status === 400, String(badCursor.status));

const ghostUser = await api("/api/messages/5f1f3f3f3f3f3f3f3f3f3f3f", { token: alan.token });
check("history: unknown peer → 404", ghostUser.status === 404, String(ghostUser.status));

const emptySend = await api(`/api/messages/send/${alan.id}`, { method: "POST", token: ada.token, body: { content: "" } });
check("REST send: empty content → 400", emptySend.status === 400, String(emptySend.status));

const noAuth = await api("/api/messages/conversations");
check("conversations: unauthenticated → 401", noAuth.status === 401, String(noAuth.status));

const badId = await api("/api/messages/xyz", { token: alan.token });
check("history: malformed userId → 400", badId.status === 400, String(badId.status));

/* ── 10. image upload without Cloudinary creds → 503 ── */
const form = new FormData();
form.append("image", new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), "pixel.png");
const imgRes = await fetch(`${BASE}/api/messages/send/${alan.id}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${ada.token}` },
  body: form,
});
check("REST send: image without Cloudinary creds → 503", imgRes.status === 503, String(imgRes.status));

/* ── 11. getOnlineUsers broadcast on disconnect ── */
const afterDisconnectPromise = waitForEvent(
  adaSocket,
  "getOnlineUsers",
  (ids) => ids.length === 1 && ids[0] === ada.id,
);
alanSocket.disconnect();
await afterDisconnectPromise;
check("disconnect: getOnlineUsers updated to [ada]", true);

adaSocket.disconnect();

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log("FAILURES:", failures.join(" | "));
  process.exit(1);
}
console.log("CHAT_INTEGRATION_PASS");
process.exit(0);
