const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 100 * 1024 * 1024
});

/* ================= STATIC ================= */
const PUBLIC_PATH = path.join(__dirname, "public");
app.use(express.static(PUBLIC_PATH));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_PATH, "index.html"));
});

/* ================= STATE ================= */
const publicRoom = {
  users: new Map(),
  messages: []
};

const privateRooms = new Map();
const MAX_MESSAGES = 200;

/* ================= HELPERS ================= */
function createRoomId(name) {
  return "room:" + name.toLowerCase().replace(/\s+/g, "_");
}

function trim(arr) {
  if (arr.length > MAX_MESSAGES) arr.shift();
}

function listRooms() {
  return Array.from(privateRooms.entries()).map(([id, r]) => ({
    id,
    name: r.name,
    users: r.users.length
  }));
}

function createMsg(socket, data) {
  return {
    id: Date.now() + "-" + socket.id,
    ...data,
    time: new Date().toLocaleTimeString()
  };
}

/* ================= SOCKET ================= */
io.on("connection", socket => {
  console.log("🔌 Connected:", socket.id);

  /* ===== PUBLIC JOIN ===== */
  socket.on("joinPublic", username => {
    if (!username) return;
    publicRoom.users.set(socket.id, username);
    socket.emit("history", publicRoom.messages);
    io.emit("members", Array.from(publicRoom.users.values()));
  });

  socket.on("typing", username => {
  socket.broadcast.emit("typing", username);
});

socket.on("stopTyping", () => {
  socket.broadcast.emit("stopTyping");
});

  /* ===== PUBLIC TEXT ===== */
  socket.on("sendMessage", ({ text }) => {
    const user = publicRoom.users.get(socket.id);
    if (!user || !text) return;

    const msg = createMsg(socket, { type: "text", user, text });
    publicRoom.messages.push(msg);
    trim(publicRoom.messages);
    io.emit("newMessage", msg);
  });

  /* ===== PUBLIC FILE ===== */
  socket.on("sendFile", file => {
    const user = publicRoom.users.get(socket.id);
    if (!user || !file?.data) return;

    const msg = createMsg(socket, { type: "file", user, file });
    publicRoom.messages.push(msg);
    trim(publicRoom.messages);
    io.emit("newFile", msg);
  });

  /* ===== PUBLIC VOICE ===== */
  socket.on("sendVoice", audio => {
    const user = publicRoom.users.get(socket.id);
    if (!user || !audio?.data) return;

    const msg = createMsg(socket, { type: "voice", user, audio });
    publicRoom.messages.push(msg);
    trim(publicRoom.messages);
    io.emit("newVoice", msg);
  });

  /* ===== DELETE MESSAGE (PUBLIC + PRIVATE) ===== */
  socket.on("deleteMessage", ({ roomType, roomId, messageId }) => {
    if (roomType === "public") {
      const msg = publicRoom.messages.find(m => m.id === messageId);
      if (!msg) return;

      msg.type = "deleted";
      msg.text = "🗑️ This message was deleted";
      io.emit("messageDeleted", { messageId });
    }

    if (roomType === "private") {
      const room = privateRooms.get(roomId);
      if (!room) return;

      const msg = room.messages.find(m => m.id === messageId);
      if (!msg) return;

      msg.type = "deleted";
      msg.text = "🗑️ This message was deleted";
      io.to(roomId).emit("messageDeleted", { messageId });
    }
  });

  /* ===== PRIVATE ROOM CREATION ===== */
  socket.on("createPrivateRoom", ({ name, password }) => {
    if (!name || !password) return;

    const roomId = createRoomId(name);
    if (privateRooms.has(roomId)) {
      socket.emit("roomError", "Room already exists");
      return;
    }

    privateRooms.set(roomId, {
      name,
      password,
      users: [],
      messages: []
    });

    io.emit("privateRoomsList", listRooms());
  });

  socket.on("getPrivateRooms", () => {
    socket.emit("privateRoomsList", listRooms());
  });

  socket.on("joinPrivateRoom", ({ roomId, password }) => {
    const room = privateRooms.get(roomId);
    const user = publicRoom.users.get(socket.id);
    if (!room || !user) return;

    if (room.password !== password) {
      socket.emit("roomError", "Incorrect password");
      return;
    }

    socket.emit("joinedPrivateRoom", { roomId, name: room.name });
  });

  socket.on("joinPrivateRoomSocket", roomId => {
    const room = privateRooms.get(roomId);
    const user = publicRoom.users.get(socket.id);
    if (!room || !user) return;

    socket.join(roomId);
    if (!room.users.includes(user)) room.users.push(user);

    socket.emit("roomHistory", room.messages);
    io.to(roomId).emit("privateMembers", room.users);
  });

socket.on("privateTyping", ({ roomId, name }) => {
  socket.to(roomId).emit("privateTyping", name);
});

socket.on("privateStopTyping", roomId => {
  socket.to(roomId).emit("privateStopTyping");
});


  /* ===== PRIVATE TEXT ===== */
  socket.on("sendRoomMessage", ({ roomId, text }) => {
    const room = privateRooms.get(roomId);
    const user = publicRoom.users.get(socket.id);
    if (!room || !user || !text) return;

    const msg = createMsg(socket, { type: "text", user, text });
    room.messages.push(msg);
    trim(room.messages);
    io.to(roomId).emit("newRoomMessage", msg);
  });

  /* ===== PRIVATE FILE ===== */
  socket.on("sendPrivateFile", ({ roomId, file }) => {
    const room = privateRooms.get(roomId);
    const user = publicRoom.users.get(socket.id);
    if (!room || !user || !file?.data) return;

    const msg = createMsg(socket, { type: "file", user, file });
    room.messages.push(msg);
    trim(room.messages);
    io.to(roomId).emit("newPrivateFile", msg);
  });

  /* ===== PRIVATE VOICE ===== */
  socket.on("sendPrivateVoice", ({ roomId, audio }) => {
    const room = privateRooms.get(roomId);
    const user = publicRoom.users.get(socket.id);
    if (!room || !user || !audio?.data) return;

    const msg = createMsg(socket, { type: "voice", user, audio });
    room.messages.push(msg);
    trim(room.messages);
    io.to(roomId).emit("newPrivateVoice", msg);
  });

  socket.on("disconnect", () => {
    const user = publicRoom.users.get(socket.id);
    publicRoom.users.delete(socket.id);

    for (const room of privateRooms.values()) {
      room.users = room.users.filter(u => u !== user);
    }

    io.emit("members", Array.from(publicRoom.users.values()));
  });
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
