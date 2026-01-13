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

/* ================== FILE SEND ================== */
function handleFileSend() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  if (!file) return;

  const MAX_SIZE = 100 * 1024 * 1024; // 100MB
  if (file.size > MAX_SIZE) {
    alert("File too large (max 100MB)");
    fileInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    socket.emit("sendFile", {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      data: reader.result
    });
  };

  reader.readAsArrayBuffer(file);
  fileInput.value = "";
}

/* ================== DOM READY ================== */
document.addEventListener("DOMContentLoaded", () => {

  const username = localStorage.getItem("username");
  if (!username) {
    window.location.href = "/";
    return;
  }

  // ELEMENTS (MATCH HTML)
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
  const membersDiv = document.getElementById("members");
  const typingIndicator = document.getElementById("typingIndicator");
  const menuBtn = document.getElementById("menuBtn");
  const exitBtn = document.getElementById("exitBtn");

  let typingTimeout;
  let recorder = null;
  let lastBlob = null;

  socket.emit("joinPublic", username);

  /* ================== TEXT ================== */
  function sendText() {
    const text = msgInput.value.trim();
    if (!text) return;
    socket.emit("sendMessage", { text });
    msgInput.value = "";
    msgInput.focus();
  }

  sendBtn.addEventListener("click", sendText);
  msgInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendText();
    }
  });

  msgInput.addEventListener("input", () => {
    socket.emit("typing", username);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping");
    }, 800);
  });

  /* ================== FILE ================== */
  fileBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleFileSend);

  /* ================== VOICE ================== */
  voiceBtn.addEventListener("click", async () => {
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
  });

  sendVoiceBtn.addEventListener("click", () => {
    if (!lastBlob) return;
    const reader = new FileReader();
    reader.onload = () => {
      socket.emit("sendVoice", { data: reader.result });
    };
    reader.readAsDataURL(lastBlob);
    clearVoice();
  });

  cancelVoiceBtn.addEventListener("click", clearVoice);

  function clearVoice() {
    lastBlob = null;
    voiceAudio.src = "";
    voicePreview.classList.add("hidden");
  }

  /* ================== RENDER HELPERS ================== */
  function createWrapper(msg) {
    const wrapper = document.createElement("div");
    wrapper.className = "message " + (msg.user === username ? "me" : "other");

    if (msg.user !== username) {
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.style.background = getAvatarColor(msg.user);
      avatar.textContent = msg.user[0].toUpperCase();
      wrapper.appendChild(avatar);
    }
    return wrapper;
  }

  function scrollBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  /* ================== RENDER TEXT ================== */
  function addMessage(msg) {
    const wrapper = createWrapper(msg);
    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (msg.user !== username) {
      bubble.innerHTML += `<div class="username">${msg.user}</div>`;
    }

    bubble.innerHTML += `<div>${msg.text}</div><div class="time">${msg.time}</div>`;
    wrapper.appendChild(bubble);
    messagesDiv.appendChild(wrapper);
    scrollBottom();
  }

  /* ================== RENDER FILE ================== */
  function addFileMessage(msg) {
    const wrapper = createWrapper(msg);
    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const blob = new Blob([msg.file.data], { type: msg.file.type });
    const url = URL.createObjectURL(blob);

    if (msg.file.type.startsWith("image")) {
      const img = document.createElement("img");
      img.src = url;
      img.style.maxWidth = "200px";
      img.alt = "Image sent by " + msg.user;
      bubble.appendChild(img);
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = msg.file.name;
      link.textContent = "📎 " + msg.file.name;
      bubble.appendChild(link);
    }

    bubble.innerHTML += `<div class="time">${msg.time}</div>`;
    wrapper.appendChild(bubble);
    messagesDiv.appendChild(wrapper);
    scrollBottom();
  }

  /* ================== RENDER VOICE ================== */
  function addVoiceMessage(msg) {
    const wrapper = createWrapper(msg);
    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = msg.audio.data;
    bubble.appendChild(audio);

    bubble.innerHTML += `<div class="time">${msg.time}</div>`;
    wrapper.appendChild(bubble);
    messagesDiv.appendChild(wrapper);
    scrollBottom();
  }

  /* ================== SOCKET EVENTS ================== */
  socket.on("history", msgs => {
    msgs.forEach(m => {
      if (m.type === "text") addMessage(m);
      if (m.type === "file") addFileMessage(m);
      if (m.type === "voice") addVoiceMessage(m);
    });
  });

  socket.on("newMessage", addMessage);
  socket.on("newFile", addFileMessage);
  socket.on("newVoice", addVoiceMessage);

  socket.on("members", users => {
    membersDiv.innerHTML = users.map(u => `<div>${u}</div>`).join("");
  });

  socket.on("typing", name => {
    typingIndicator.textContent = `${name} is typing...`;
    typingIndicator.classList.remove("hidden");
  });

  socket.on("stopTyping", () => {
    typingIndicator.classList.add("hidden");
  });

  /* ================== UI ================== */
  menuBtn.addEventListener("click", () => {
    membersDiv.classList.toggle("hidden");
  });

  exitBtn.addEventListener("click", () => {
    window.location.href = "/";
  });

});
