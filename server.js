// ================== IMPORTS ==================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// ================== APP SETUP ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ================== STATIC FILES ==================
// This serves all files inside /public folder
// index.html, public.html, js, css, etc.
app.use(express.static("public"));

// ================== ROOT ROUTE ==================
// Opens the name entry page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// ================== IN-MEMORY STORAGE ==================
// No database as per your requirement
// This survives refresh but NOT server restart
const publicRoom = {
  users: new Map(),   // socket.id -> username
  messages: []        // text + file messages
};

// ================== SOCKET.IO CONNECTION ==================
io.on("connection", socket => {
  console.log("User connected:", socket.id);

  // ---------- JOIN PUBLIC ROOM ----------
  socket.on("joinPublic", username => {
    // Store user
    publicRoom.users.set(socket.id, username);

    // Send members list to everyone
    io.emit("members", Array.from(publicRoom.users.values()));

    // Send old messages to this user (refresh support)
    socket.emit("history", publicRoom.messages);
  });

  // ---------- TEXT MESSAGE ----------
  socket.on("sendMessage", data => {
    // Safety validation
    if (!data || typeof data.text !== "string") return;

    const message = {
      type: "text",                     // message type
      user: publicRoom.users.get(socket.id),
      text: data.text,
      time: new Date().toLocaleTimeString()
    };

    // Store in memory
    publicRoom.messages.push(message);

    // Broadcast to all users
    io.emit("newMessage", message);
  });

  // ---------- FILE MESSAGE ----------
  socket.on("sendFile", file => {
    if (!file || !file.data) return;

    const fileMessage = {
      type: "file",                     // message type
      user: publicRoom.users.get(socket.id),
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        data: file.data                 // base64
      },
      time: new Date().toLocaleTimeString()
    };

    // Store in memory
    publicRoom.messages.push(fileMessage);

    // Broadcast to all users
    io.emit("newFile", fileMessage);
  });

  // ---------- DISCONNECT ----------
  socket.on("disconnect", () => {
    // Remove user
    publicRoom.users.delete(socket.id);

    // Update members list
    io.emit("members", Array.from(publicRoom.users.values()));

    console.log("User disconnected:", socket.id);
  });
});

// ================== SERVER START ==================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
