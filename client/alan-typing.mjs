import { io } from "socket.io-client";
// login as alan to get a valid token cookie
const login = await fetch("http://localhost:5000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: "alan", password: "password123" }),
});
const setCookie = login.headers.get("set-cookie") ?? "";
const token = /chatify_token=([^;]+)/.exec(setCookie)?.[1];
if (!token) { console.log("ALAN_LOGIN_FAIL"); process.exit(1); }
const socket = io("http://localhost:5000", { auth: { token }, reconnection: false });
socket.on("connect", () => {
  console.log("ALAN_CONNECTED");
  let n = 0;
  const timer = setInterval(() => {
    n++;
    if (n % 4 === 0) { socket.emit("stopTyping", { receiverId: process.env.ADA_ID }); }
    else { socket.emit("typing", { receiverId: process.env.ADA_ID }); }
    if (n >= 32) { clearInterval(timer); socket.disconnect(); console.log("ALAN_DONE"); process.exit(0); }
  }, 1000);
});
socket.on("connect_error", (e) => { console.log("ALAN_ERR", e.message); process.exit(1); });
setTimeout(() => { console.log("ALAN_TIMEOUT"); process.exit(1); }, 60000);
