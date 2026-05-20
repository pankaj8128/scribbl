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
    const inviteLink = window.location.origin + "/" + roomCode;
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => {
        appendMessage("SYSTEM", "Invite Link Copied!", "success");
      })
      .catch((err) => {
        console.log("Error copying invite link: ", err);
        appendMessage("SYSTEM", "Error copying invite link.", "error");
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

const saveSettingsBtn = document.getElementById("save-settings-btn");
if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener("click", () => {
    const rounds = document.getElementById("setting-rounds").value;
    const drawTime = document.getElementById("setting-drawTime").value;
    const wordCount = document.getElementById("setting-wordCount").value;
    const customWords = document.getElementById("setting-customWords").value;

    if (socket.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify({
        type: "UpdateSettings",
        roomCode,
        settings: {
          rounds,
          drawTime,
          wordCount,
          customWords,
        },
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
