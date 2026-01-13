document.addEventListener("DOMContentLoaded", () => {
  const publicBtn = document.getElementById("publicBtn");
  const privateBtn = document.getElementById("privateBtn");

  publicBtn.addEventListener("click", () => {
    window.location.href = "/public.html";
  });

  privateBtn.addEventListener("click", () => {
    alert("Private room coming next");
  });
});
