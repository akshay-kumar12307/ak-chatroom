const socket = io();

/* ================== HELPERS ================== */
function getAvatarColor(name) {
  const colors = [
    "#f44336","#e91e63","#9c27b0","#673ab7",
    "#3f51b5","#2196f3","#03a9f4","#009688",
    "#4caf50","#8bc34a","#ffc107","#ff9800",
    "#ff5722","#795548","#607d8b"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/* ================== DOM READY ================== */
document.addEventListener("DOMContentLoaded", () => {

  /* ---------- STATE ---------- */
  const username = localStorage.getItem("username");
  const roomId = localStorage.getItem("roomId");
  const roomName = localStorage.getItem("roomName");

  if (!username || !roomId) {
    window.location.href = "rooms.html";
    return;
  }

  /* ---------- ELEMENTS ---------- */
  const messagesDiv = document.getElementById("messages");
  const msgInput = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");
  const fileBtn = document.getElementById("fileBtn");
  const fileInput = document.getElementById("fileInput");
  const voiceBtn = document.getElementById("voiceBtn");
  const voicePreview = document.getElementById("voicePreview");
  const voiceAudio = document.getElementById("voiceAudio");
  const sendVoiceBtn = document.getElementById("sendVoiceBtn");
  const cancelVoiceBtn = document.getElementById("cancelVoiceBtn");
  const typingIndicator = document.getElementById("typingIndicator");
  const membersDiv = document.getElementById("members");
  const menuBtn = document.getElementById("menuBtn");
  const exitBtn = document.getElementById("exitBtn");
  const roomTitle = document.getElementById("roomTitle");

  if (roomTitle) roomTitle.textContent = roomName;

  let typingTimeout;
  let recorder = null;
  let lastBlob = null;

  /* ---------- JOIN ---------- */
  socket.emit("joinPublic", username);
  socket.emit("joinPrivateRoomSocket", roomId);

  /* ================== TEXT ================== */
  function sendText() {
    const text = msgInput.value.trim();
    if (!text) return;
    socket.emit("sendRoomMessage", { roomId, text });
    msgInput.value = "";
  }

  sendBtn.onclick = sendText;

  msgInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendText();
    }
  });

  msgInput.addEventListener("input", () => {
    socket.emit("privateTyping", { roomId, name: username });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("privateStopTyping", roomId);
    }, 800);
  });

  /* ================== FILE ================== */
  fileBtn.onclick = () => fileInput.click();

  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      socket.emit("sendPrivateFile", {
        roomId,
        file: {
          name: file.name,
          type: file.type,
          data: reader.result
        }
      });
    };
    reader.readAsDataURL(file);
    fileInput.value = "";
  };

  /* ================== VOICE ================== */
  voiceBtn.onclick = async () => {
    if (!recorder || recorder.state === "inactive") {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      lastBlob = null;

      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);

      recorder.onstop = () => {
        lastBlob = new Blob(chunks, { type: "audio/webm" });
        voiceAudio.src = URL.createObjectURL(lastBlob);
        voicePreview.classList.remove("hidden");
        voiceBtn.textContent = "🎤";
      };

      recorder.start();
      voiceBtn.textContent = "⏹";
    } else {
      recorder.stop();
    }
  };

  sendVoiceBtn.onclick = () => {
    if (!lastBlob) return;

    const reader = new FileReader();
    reader.onload = () => {
      socket.emit("sendPrivateVoice", {
        roomId,
        audio: { data: reader.result }
      });
    };
    reader.readAsDataURL(lastBlob);
    clearVoice();
  };

  cancelVoiceBtn.onclick = clearVoice;

  function clearVoice() {
    lastBlob = null;
    voiceAudio.src = "";
    voicePreview.classList.add("hidden");
  }

  /* ================== RENDER ================== */
  function render(msg) {
    const wrapper = document.createElement("div");
    wrapper.className = "message " + (msg.user === username ? "me" : "other");
    wrapper.dataset.id = msg.id;

    if (msg.user !== username) {
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.style.background = getAvatarColor(msg.user);
      avatar.textContent = msg.user[0].toUpperCase();
      wrapper.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (msg.user !== username) {
      bubble.innerHTML += `<div class="username">${msg.user}</div>`;
    }

    if (msg.type === "text") bubble.innerHTML += `<div>${msg.text}</div>`;
    if (msg.type === "file") {
      bubble.innerHTML += msg.file.type.startsWith("image")
        ? `<img src="${msg.file.data}" style="max-width:200px">`
        : `<a href="${msg.file.data}" download>${msg.file.name}</a>`;
    }
    if (msg.type === "voice") {
      bubble.innerHTML += `<audio controls src="${msg.audio.data}"></audio>`;
    }
    if (msg.type === "deleted") {
      bubble.innerHTML += `<i>🗑️ This message was deleted</i>`;
    }

    bubble.innerHTML += `<div class="time">${msg.time}</div>`;
    wrapper.appendChild(bubble);
    messagesDiv.appendChild(wrapper);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  /* ================== SOCKET EVENTS ================== */
  socket.on("roomHistory", msgs => msgs.forEach(render));
  socket.on("newRoomMessage", render);
  socket.on("newPrivateFile", render);
  socket.on("newPrivateVoice", render);

  socket.on("messageDeleted", ({ messageId }) => {
    const el = document.querySelector(`[data-id="${messageId}"]`);
    if (el) el.querySelector(".bubble").innerHTML = "<i>🗑️ This message was deleted</i>";
  });

  socket.on("privateTyping", name => {
    typingIndicator.textContent = `${name} is typing...`;
    typingIndicator.classList.remove("hidden");
  });

  socket.on("privateStopTyping", () => {
    typingIndicator.classList.add("hidden");
  });

  socket.on("privateMembers", users => {
    membersDiv.innerHTML = users.map(u => `<div>${u}</div>`).join("");
  });

  /* ================== UI ================== */
  menuBtn.onclick = () => membersDiv.classList.toggle("hidden");
  exitBtn.onclick = () => window.location.href = "rooms.html";
});
