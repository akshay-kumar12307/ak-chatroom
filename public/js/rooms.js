const socket = io();

const username = localStorage.getItem("username");
if (!username) {
  window.location.href = "/";
}

// elements
const publicBtn = document.getElementById("publicBtn");
const privateBtn = document.getElementById("privateBtn");
const privatePanel = document.getElementById("privatePanel");
const createRoomBtn = document.getElementById("createRoomBtn");
const roomNameInput = document.getElementById("roomName");
const roomPassInput = document.getElementById("roomPass");
const roomsList = document.getElementById("roomsList");

// join presence
socket.emit("joinPublic", username);

// PUBLIC
publicBtn.onclick = () => {
  window.location.href = "public.html";
};

// PRIVATE toggle
privateBtn.onclick = () => {
  privatePanel.classList.toggle("hidden");
  socket.emit("getPrivateRooms");
};

// CREATE ROOM
createRoomBtn.onclick = () => {
  const name = roomNameInput.value.trim();
  const password = roomPassInput.value.trim();

  if (!name || !password) {
    alert("Room name and password required");
    return;
  }

  socket.emit("createPrivateRoom", { name, password });

  roomNameInput.value = "";
  roomPassInput.value = "";
};

// RECEIVE ROOMS LIST
socket.on("privateRoomsList", rooms => {
  roomsList.innerHTML = "";

  if (rooms.length === 0) {
    roomsList.innerHTML = "<div>No rooms created yet</div>";
    return;
  }

  rooms.forEach(room => {
    const div = document.createElement("div");
    div.textContent = `${room.name} (${room.users} users)`;
    div.style.padding = "8px";
    div.style.cursor = "pointer";

    div.onclick = () => {
      const password = prompt("Enter room password");
      if (!password) return;

      socket.emit("joinPrivateRoom", {
        roomId: room.id,
        password
      });
    };

    roomsList.appendChild(div);
  });
});

// JOIN SUCCESS
socket.on("joinedPrivateRoom", data => {
  localStorage.setItem("roomId", data.roomId);
  localStorage.setItem("roomName", data.name);
  window.location.href = "private.html";
});

// ERRORS
socket.on("roomError", msg => {
  alert(msg);
});
