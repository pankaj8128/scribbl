socket.onopen = () => {
  appendMessage("SYSTEM", "Connected to Room", "success");
};

socket.onclose = () => {
  appendMessage("SYSTEM", "Disconnected from server", "error");
};

socket.onerror = (error) => {
  appendMessage(
    "SYSTEM",
    `WebSocket error: ${error.message || "Unknown error"}`,
    "error",
  );
};

socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    if (data.drawerId !== undefined) window.currentDrawerId = data.drawerId;
    if (data.players) window.currentPlayers = data.players;
    if (data.game) {
      if (data.game.drawerId !== undefined)
        window.currentDrawerId = data.game.drawerId;
      if (data.game.settings) {
        window.currentSettings = data.game.settings;
        if (document.getElementById("setting-rounds")) {
          document.getElementById("setting-rounds").value =
            data.game.settings.rounds;
          document.getElementById("setting-drawTime").value =
            data.game.settings.drawTime;
          document.getElementById("setting-wordCount").value =
            data.game.settings.wordCount;
          document.getElementById("setting-customWords").value =
            data.game.settings.customWords;
        }
      }
    }

    if (
      data.drawerId !== undefined ||
      data.type === "newPlayer" ||
      data.players
    ) {
      addNewPlayer(window.currentPlayers || []);
    }

    if (data.round && round) {
      const maxRounds =
        (window.currentSettings && window.currentSettings.rounds) || 3;
      round.innerHTML = `<span class="round-prefix">Round </span>${data.round}<span class="round-sep-long"> of </span><span class="round-sep-short">/</span>${maxRounds}`;

      if (window.currentRound !== data.round) {
        window.currentRound = data.round;
        const announcementOverlay = document.getElementById("round-announcement-overlay");
        const announcementText = document.getElementById("round-announcement-text");
        if (announcementOverlay && announcementText) {
          announcementText.innerText = "Round " + data.round;
          announcementOverlay.style.display = "flex";
          setTimeout(() => {
            if (window.currentRound === data.round) {
              announcementOverlay.style.display = "none";
            }
          }, 2000);
        }
      }
    }

    if (data.type === "GameOver") {
      window.isDrawing = false;
      disableDrawing();
      clearInterval(countdown);
      if (startBtn) startBtn.style.display = "flex";
      if (msgBox) msgBox.disabled = false;
      appendMessage("SYSTEM", data.msg, "gameover");

      const sortedFinal = [...(data.players || [])].sort(
        (a, b) => b.score - a.score,
      );
      const leaderboardHtml = sortedFinal
        .map((p, i) => {
          return `
           <div class="result-player-row" style="animation-delay: ${i * 0.1}s">
             <div class="result-rank">#${i + 1}</div>
             <div class="result-name">${p.username}</div>
             <div class="result-score">${p.score} pts</div>
           </div>
         `;
        })
        .join("");

      showCanvasOverlay(`
        <div class="canvas-overlay-content">
          <h2 class="overlay-title" style="color: #facc15; font-size: 2rem;">🏆 Final Results</h2>
          <div class="result-players" style="max-height: 350px; overflow-y: auto;">
            ${leaderboardHtml}
          </div>
          <p style="margin-top: 24px; color: var(--text-muted); font-weight: 700;">Waiting for owner to start a new game...</p>
        </div>
      `);

      data.from = "SYSTEM";
      if (round) {
        round.innerHTML = `<span class="round-prefix">Round </span>0<span class="round-sep-long"> of </span><span class="round-sep-short">/</span>${(window.currentSettings && window.currentSettings.rounds) || 3}`;
      }

      setTimeout(() => {
        hideCanvasOverlay();
        showSettingsOverlay();
      }, 5000);

      return;
    } else if (data.type === "DisplayingResult") {
      hideSettingsOverlay();
      window.isDrawing = false;
      disableDrawing();
      if (msgBox) msgBox.disabled = false;
      appendMessage("SYSTEM", data.msg, "round");
      const timeRemaining = data.time !== undefined ? data.time : 5;
      showResultOverlay(
        data.players,
        data.roundScores || {},
        data.word,
        timeRemaining,
      );
      startTimer(
        timeRemaining,
        "Time to DisplayingResult is over, waiting for server to response...",
      );
      return;
    } else if (data.type === "NewOwner") {
      appendMessage("SYSTEM", data.msg, "owner");
      if (startBtn) startBtn.disabled = false;
      if (document.getElementById("setting-rounds")) {
        document.getElementById("setting-rounds").disabled = false;
        document.getElementById("setting-drawTime").disabled = false;
        document.getElementById("setting-wordCount").disabled = false;
        document.getElementById("setting-customWords").disabled = false;
      }
      const saveBtn = document.getElementById("save-settings-btn");
      if (saveBtn) saveBtn.style.display = "block";
      return;
    } else if (data.type === "GotNewOwner") {
      appendMessage("SYSTEM", data.msg, "owner");
      return;
    } else if (data.type === "SettingsUpdated") {
      window.currentSettings = data.settings;
      if (document.getElementById("setting-rounds")) {
        document.getElementById("setting-rounds").value = data.settings.rounds;
        document.getElementById("setting-drawTime").value =
          data.settings.drawTime;
        document.getElementById("setting-wordCount").value =
          data.settings.wordCount;
        document.getElementById("setting-customWords").value =
          data.settings.customWords;
      }
      appendMessage("SYSTEM", "Room settings updated.", "info");
      return;
    } else if (data.type.startsWith("Solved")) {
      const playerRow = document.getElementById(`player-${data.id}`);
      if (playerRow) playerRow.style.background = "rgba(74, 222, 128, 0.2)";
      appendMessage(data.from, data.msg, "solved");
      if (data.word && chooseWord) {
        chooseWord.innerHTML = "";
        const button = document.createElement("button");
        button.classList.add("word", "word-solved");
        button.innerText = data.word;
        chooseWord.appendChild(button);
      }
      if (data.type.endsWith("First"))
        startTimer(
          30,
          "Time over after shrink, waiting for server to response...",
        );
    } else if (data.type === "SelectWord") {
      if (startBtn) startBtn.style.display = "none";
      hideSettingsOverlay();
      appendMessage("SYSTEM", data.msg, "round");
      startTimer(
        data.time !== undefined ? data.time : 15,
        "Time to SelectWord is over, waiting for server to response...",
      );
      if (chooseWord) chooseWord.innerHTML = "";

      showCanvasOverlay(`
        <div class="canvas-overlay-content">
          <h2 class="overlay-title">Choose a word</h2>
          <div class="word-choices" id="word-choices-container"></div>
        </div>
      `);

      const choicesContainer = document.getElementById(
        "word-choices-container",
      );
      for (const word of data.words) {
        const button = document.createElement("button");
        button.classList.add("choice-btn");
        button.innerText = word;
        button.addEventListener(
          "click",
          () => {
            clearInterval(countdown);
            if (socket.readyState === WebSocket.OPEN) {
              const payload = JSON.stringify({
                type: "SetCurrentWord",
                roomCode,
                word,
              });
              socket.send(payload);
              hideCanvasOverlay();
            }
          },
          { once: true },
        );
        choicesContainer.appendChild(button);
      }
      enableDrawing();
      clearCanvas(false);
      if (msgBox) msgBox.disabled = true;
      return;
    } else if (data.type === "StartGame") {
      if (startBtn) startBtn.style.display = "none";
      hideSettingsOverlay();
      appendMessage("SYSTEM", data.msg, "round");
      if (chooseWord) chooseWord.innerHTML = "";
      startTimer(
        data.time !== undefined ? data.time : 15,
        "Time to WaitForWord is over, waiting for server to response...",
      );
      showCanvasOverlay(`
        <div class="canvas-overlay-content">
          <h2 class="overlay-title">${data.msg}</h2>
        </div>
      `);
      return;
    } else if (data.type === "DrawWord") {
      hideSettingsOverlay();
      hideCanvasOverlay();
      window.isDrawing = true;
      startTimer(
        data.time !== undefined ? data.time : 80,
        "Time to DrawWord is over, waiting for server to response...",
      );
      if (chooseWord) {
        chooseWord.innerHTML = "";
        const button = document.createElement("button");
        button.setAttribute("id", data.word);
        button.classList.add("word");
        button.innerText = data.word;
        chooseWord.appendChild(button);
      }
      appendMessage("SYSTEM", data.msg, "round");
      enableDrawing();
      clearCanvas(false);
    } else if (data.type === "GuessWord") {
      hideSettingsOverlay();
      hideCanvasOverlay();
      window.isDrawing = false;
      startTimer(
        data.time !== undefined ? data.time : 80,
        "Time to GuessWord is over, waiting for server to response...",
      );
      const word = "_ ".repeat(data.length);
      appendMessage("SYSTEM", data.msg, "round");
      if (chooseWord) {
        chooseWord.innerHTML = "";
        const button = document.createElement("button");
        button.setAttribute("id", word);
        button.classList.add("word");
        button.innerText = word;
        chooseWord.appendChild(button);
      }
      disableDrawing();
      clearCanvas(false);
      if (msgBox) msgBox.disabled = false;
    } else if (data.type === "newPlayer") {
    } else if (data.type === "drawStart") {
      if (ctx && canvas) {
        const rx = data.x * canvas.width;
        const ry = data.y * canvas.height;
        ctx.strokeStyle = data.color || "#000000";
        ctx.lineWidth = data.thickness || 5;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
      }
    } else if (data.type === "draw") {
      if (ctx && canvas) {
        const rx = data.x * canvas.width;
        const ry = data.y * canvas.height;
        ctx.strokeStyle = data.color || "#000000";
        ctx.lineWidth = data.thickness || 5;
        ctx.lineTo(rx, ry);
        ctx.stroke();
        ctx.moveTo(rx, ry);
      }
    } else if (data.type === "drawEnd") {
      if (ctx) {
        ctx.closePath();
        saveState();
      }
    } else if (data.type === "fill") {
      if (canvas && ctx) {
        floodFill(
          Math.round(data.x * canvas.width),
          Math.round(data.y * canvas.height),
          data.color
        );
        saveState();
      }
    } else if (data.type === "undo") {
      undo(false);
    } else if (data.type === "clear") {
      clearCanvas(false);
    } else if (data.type === "RequestCanvas") {
      if (socket.readyState === WebSocket.OPEN && canvas) {
        socket.send(
          JSON.stringify({
            type: "SyncCanvas",
            roomCode,
            toPlayerId: data.toPlayerId,
            image: canvas.toDataURL(),
          }),
        );
      }
    } else if (data.type === "SyncCanvas") {
      if (!ctx || !canvas) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveState();
      };
      img.src = data.image;
    } else if (data.type === "Exit") {
      appendMessage("SYSTEM", data.msg, data.msgStyle || "leave");
    } else if (data.type === "SYSTEM") {
      appendMessage("SYSTEM", data.msg, data.msgStyle || "info");
    } else {
      appendMessage(data.from, data.msg, "chat");
    }
  } catch (e) {
    console.log("Error: ", e);
    appendMessage("ERROR", "Server Error", "error");
  }
};
