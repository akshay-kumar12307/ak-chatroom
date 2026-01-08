const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// In-memory public room
const publicRoom = {
  users: new Map(),
  messages: []
};

io.on("connection", socket => {
  console.log("User connected:", socket.id);

  
  // Join public room
  socket.on("joinPublic", username => {
    publicRoom.users.set(socket.id, username);
    io.emit("members", Array.from(publicRoom.users.values()));
    socket.emit("history", publicRoom.messages);
  });

  // Text message
  socket.on("sendMessage", data => {
    if (!data || !data.text) return;

    const msg = {
      type: "text",
      user: publicRoom.users.get(socket.id),
      text: data.text,
      time: new Date().toLocaleTimeString()
    };

    publicRoom.messages.push(msg);
    io.emit("newMessage", msg);
  });

  // File message
  socket.on("sendFile", file => {
    if (!file || !file.data) return;

    const msg = {
      type: "file",
      user: publicRoom.users.get(socket.id),
      file,
      time: new Date().toLocaleTimeString()
    };

    publicRoom.messages.push(msg);
    io.emit("newFile", msg);
  });

  // Voice message
  socket.on("sendVoice", audio => {
    if (!audio || !audio.data) return;

    const msg = {
      type: "voice",
      user: publicRoom.users.get(socket.id),
      audio,
      time: new Date().toLocaleTimeString()
    };

    publicRoom.messages.push(msg);
    io.emit("newVoice", msg);
  });

    // ===== TYPING INDICATOR =====
  socket.on("typing", username => {
    socket.broadcast.emit("typing", username);
  });

  socket.on("stopTyping", () => {
    socket.broadcast.emit("stopTyping");
  });

  socket.on("disconnect", () => {
    publicRoom.users.delete(socket.id);
    io.emit("members", Array.from(publicRoom.users.values()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
