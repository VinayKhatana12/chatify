import { io } from "socket.io-client";
const login = await fetch("http://localhost:5000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: "alan", password: "password123" }),
});
const token = /chatify_token=([^;]+)/.exec(login.headers.get("set-cookie") ?? "")?.[1];
if (!token) { console.log("ALAN_LOGIN_FAIL"); process.exit(1); }
const socket = io("http://localhost:5000", { auth: { token }, reconnection: false });
socket.on("connect", () => console.log("ALAN_CONNECTED"));
socket.on("newMessage", (m) => {
  console.log("ALAN_GOT", m.content);
  const convId = m.conversationId;
  socket.emit("typing", { receiverId: m.senderId });
  setTimeout(() => {
    socket.emit("stopTyping", { receiverId: m.senderId });
    socket.emit("markAsRead", { conversationId: convId }, (res) =>
      console.log("ALAN_READ_ACK", JSON.stringify(res)));
  }, 2500);
});
socket.on("connect_error", (e) => { console.log("ALAN_ERR", e.message); process.exit(1); });
setTimeout(() => { console.log("ALAN_STAYING_ONLINE"); process.exit(0); }, 90000);
