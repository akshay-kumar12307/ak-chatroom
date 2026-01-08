const socket = io();

document.addEventListener("DOMContentLoaded", () => {

  const username = localStorage.getItem("username");
  if (!username) {
    window.location.href = "/";
    return;
  }

  // ---------- ELEMENTS ----------
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
  const menuBtn = document.getElementById("menuBtn");
  const exitBtn = document.getElementById("exitBtn");
  const membersDiv = document.getElementById("members");
const typingIndicator = document.getElementById("typingIndicator");
let typingTimeout;

  socket.emit("joinPublic", username);

  // ---------- RENDER ----------
  function render(msg) {
    const div = document.createElement("div");
    div.className = "message-card";

    let content = "";
    if (msg.type === "text") {
      content = `<p>${msg.text}</p>`;
    }
    if (msg.type === "file") {
      content = msg.file.type.startsWith("image/")
        ? `<img src="${msg.file.data}" style="max-width:220px;border-radius:8px">`
        : `<a href="${msg.file.data}" download>${msg.file.name}</a>`;
    }
    if (msg.type === "voice") {
      content = `<audio controls src="${msg.audio.data}"></audio>`;
    }

    div.innerHTML = `
      <strong>${msg.user}</strong>
      <div>${content}</div>
    `;

    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  socket.on("history", msgs => {
    messagesDiv.innerHTML = "";
    msgs.forEach(render);
  });

  socket.on("newMessage", render);
  socket.on("newFile", render);
  socket.on("newVoice", render);

  // ===== ONLINE MEMBERS =====
socket.on("members", users => {
  membersDiv.innerHTML = "";

  if (!users || users.length === 0) {
    membersDiv.innerHTML = "<div>No users online</div>";
    return;
  }

  users.forEach(name => {
    const div = document.createElement("div");
    div.textContent = name;
    membersDiv.appendChild(div);
  });
});

  // ---------- TEXT ----------
  sendBtn.onclick = () => {
    const text = msgInput.value.trim();
    if (!text) return;
    socket.emit("sendMessage", { text });
    msgInput.value = "";
    msgInput.focus();
  };

  msgInput.onkeydown = e => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendBtn.click();
    }
  };

  // ---------- FILE ----------
  fileBtn.onclick = () => fileInput.click();

  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      socket.emit("sendFile", {
        name: file.name,
        type: file.type || "application/octet-stream",
        data: reader.result
      });
    };
    reader.readAsDataURL(file);
    fileInput.value = "";
  };

  // ---------- 🎤 VOICE (FINAL FIX) ----------
  let recorder = null;
  let lastBlob = null;

  voiceBtn.onclick = async () => {
    if (!recorder || recorder.state === "inactive") {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      lastBlob = null;

      recorder.start();
      voiceBtn.textContent = "⏹";

      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);

      recorder.onstop = () => {
        lastBlob = new Blob(chunks, { type: "audio/webm" });
        voiceAudio.src = URL.createObjectURL(lastBlob);
        voicePreview.classList.remove("hidden");
         voiceBtn.textContent = "🎤";
      };

    } else {
      recorder.stop();
    }
  };

  sendVoiceBtn.onclick = () => {
    if (!lastBlob) return;

    const reader = new FileReader();
    reader.onload = () => {
      socket.emit("sendVoice", { data: reader.result });
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
msgInput.addEventListener("input", () => {
  socket.emit("typing", username);

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("stopTyping");
  }, 800);
});
socket.on("typing", name => {
  typingIndicator.textContent = `${name} is typing...`;
  typingIndicator.classList.remove("hidden");
});

socket.on("stopTyping", () => {
  typingIndicator.classList.add("hidden");
});

  // ---------- UI ----------
 menuBtn.onclick = () => {
  membersDiv.classList.toggle("hidden");
};
 exitBtn.onclick = () => window.location.href = "rooms.html";
});
