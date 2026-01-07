const socket = io();

document.addEventListener("DOMContentLoaded", () => {

  const username = localStorage.getItem("username");
  if (!username) {
    window.location.href = "/";
    return;
  }

  const messagesDiv = document.getElementById("messages");
  const input = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");
  const menuBtn = document.getElementById("menuBtn");
  const exitBtn = document.getElementById("exitBtn");
  const membersDiv = document.getElementById("members");
  const fileBtn = document.getElementById("fileBtn");
  const fileInput = document.getElementById("fileInput");
  const voiceBtn = document.getElementById("voiceBtn");

  // Join room
  socket.emit("joinPublic", username);

  // ---------------- RENDER TEXT ----------------
  function renderMessage(msg) {
    const div = document.createElement("div");
    div.className = "message";
    div.innerHTML = `
      <strong>${msg.user}</strong>
      <span class="time">${msg.time}</span>
      <div>${msg.text}</div>
    `;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // ---------------- RENDER FILE ----------------
  function renderFile(msg) {
    const div = document.createElement("div");
    div.className = "message";

    let content;
    if (msg.file.type.startsWith("image/")) {
      content = `<img src="${msg.file.data}" style="max-width:200px;border-radius:8px">`;
    } else {
      content = `<a href="${msg.file.data}" download="${msg.file.name}">
        📎 ${msg.file.name}
      </a>`;
    }

    div.innerHTML = `
      <strong>${msg.user}</strong>
      <span class="time">${msg.time}</span>
      <div>${content}</div>
    `;

    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // ---------------- HISTORY ----------------
  socket.on("history", messages => {
    messagesDiv.innerHTML = "";
    messages.forEach(msg => {
      if (msg.file) renderFile(msg);
      else renderMessage(msg);
    });
  });

  socket.on("newMessage", renderMessage);
  socket.on("newFile", renderFile);

  // ---------------- SEND TEXT ----------------
  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    socket.emit("sendMessage", { text });
    input.value = "";
    input.focus();
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
  });

  // ---------------- FILE SHARING ----------------
  fileBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Max file size is 2MB");
      fileInput.value = "";
      input.focus();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      socket.emit("sendFile", {
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result
      });
      input.focus(); // 🔑 FIX: return focus to input
    };

    reader.readAsDataURL(file);
    fileInput.value = "";
  });

  // ---------------- VOICE (PLACEHOLDER) ----------------
  voiceBtn.addEventListener("click", () => {
    alert("Voice messages coming next 🚀");
  });

  // ---------------- MEMBERS ----------------
  socket.on("members", users => {
    membersDiv.innerHTML =
      "<b>Members</b><br><br>" + users.join("<br>");
  });

  // ---------------- UI CONTROLS ----------------
  menuBtn.addEventListener("click", () => {
    membersDiv.classList.toggle("hidden");
  });

  exitBtn.addEventListener("click", () => {
    window.location.href = "rooms.html";
  });

});
