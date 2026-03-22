function sendMessage() {
  if (!msgBox) return;
  const msg = msgBox.value.trim();

  if (msg !== "") {
    if (socket.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify({
        type: "casual",
        from: username,
        id,
        roomCode,
        msg,
      });
      socket.send(payload);
      msgBox.value = "";
    } else {
      appendMessage("SYSTEM", "Socket is not open", "error");
    }
  }
}

if (roomCodeBtn) {
  roomCodeBtn.addEventListener("click", () => {
    navigator.clipboard
      .writeText(roomCodeBtn.innerText)
      .then(() => {
        appendMessage("SYSTEM", "Room Code Copied!", "success");
      })
      .catch((err) => {
        console.log("Error copying room code: ", err);
        appendMessage("SYSTEM", "Error copying room code.", "error");
      });
  });
}

if (canvas) {
  initCanvas();
  canvas.addEventListener("pointerdown", startPainting);
  canvas.addEventListener("pointermove", draw);
}
window.addEventListener("pointerup", stopPainting);

if (startBtn) {
  startBtn.addEventListener("click", () => {
    if (socket.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify({
        type: "StartGame",
        roomCode,
        msg: "Starting game...",
      });
      socket.send(payload);
    } else {
      appendMessage("SYSTEM", "Socket is not open", "error");
    }
  });
}

if (sendBtn) {
  sendBtn.addEventListener("click", sendMessage);
}

if (msgBox) {
  msgBox.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
}
