const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// IMPORTANT: allow large payloads (files + voice)
const io = new Server(server, {
  maxHttpBufferSize: 100 * 1024 * 1024 // 100MB
});

// ===== STATIC FILES =====
const PUBLIC_PATH = path.join(__dirname, "public");
app.use(express.static(PUBLIC_PATH));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_PATH, "index.html"));
});

// ===== PUBLIC ROOM STATE =====
let cleanupTimer = null;

const publicRoom = {
  users: new Map(), // socket.id -> username
  messages: []
};

const MAX_MESSAGES = 200;

// ===== SOCKET LOGIC =====
io.on("connection", socket => {
  console.log("🔌 User connected:", socket.id);

  // ===== JOIN PUBLIC =====
  socket.on("joinPublic", username => {
    if (!username || !username.trim()) return;

    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }

    publicRoom.users.set(socket.id, username.trim());

    io.emit("members", Array.from(publicRoom.users.values()));
    socket.emit("history", publicRoom.messages);
  });

  // ===== TEXT MESSAGE =====
  socket.on("sendMessage", data => {
    const user = publicRoom.users.get(socket.id);
    if (!user || !data || !data.text) return;

    const text = data.text.trim();
    if (!text) return;

    const msg = {
      type: "text",
      user,
      text,
      time: new Date().toLocaleTimeString()
    };

    pushMessage(msg);
    io.emit("newMessage", msg);
  });

  // ===== FILE MESSAGE =====
  socket.on("sendFile", file => {
    const user = publicRoom.users.get(socket.id);
    if (!user || !file || !file.data) return;

    const msg = {
      type: "file",
      user,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        data: file.data // ArrayBuffer
      },
      time: new Date().toLocaleTimeString()
    };

    pushMessage(msg);
    io.emit("newFile", msg);
  });

  // ===== VOICE MESSAGE =====
  socket.on("sendVoice", audio => {
    const user = publicRoom.users.get(socket.id);
    if (!user || !audio || !audio.data) return;

    const msg = {
      type: "voice",
      user,
      audio, // { data: base64 }
      time: new Date().toLocaleTimeString()
    };

    pushMessage(msg);
    io.emit("newVoice", msg);
  });

  // ===== TYPING INDICATOR =====
  socket.on("typing", name => {
    socket.broadcast.emit("typing", name);
  });

  socket.on("stopTyping", () => {
    socket.broadcast.emit("stopTyping");
  });

  // ===== DISCONNECT =====
  socket.on("disconnect", () => {
    if (!publicRoom.users.has(socket.id)) return;

    publicRoom.users.delete(socket.id);
    io.emit("members", Array.from(publicRoom.users.values()));

    if (publicRoom.users.size === 0) {
      cleanupTimer = setTimeout(() => {
        publicRoom.messages = [];
        console.log("🧹 Public chat cleared after 3 hours inactivity");
      }, 3 * 60 * 60 * 1000);
    }

    console.log("❌ User disconnected:", socket.id);
  });
});

// ===== HELPERS =====
function pushMessage(msg) {
  publicRoom.messages.push(msg);
  if (publicRoom.messages.length > MAX_MESSAGES) {
    publicRoom.messages.shift();
  }
}

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
