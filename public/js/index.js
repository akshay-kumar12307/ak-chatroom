document.getElementById("enterBtn").onclick = () => {
  const name = document.getElementById("username").value.trim();
  if (!name) return alert("Enter your name");

  localStorage.setItem("username", name);
  window.location.href = "rooms.html";
};
