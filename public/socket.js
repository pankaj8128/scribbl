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
    if (data.game && data.game.drawerId !== undefined)
      window.currentDrawerId = data.game.drawerId;

    if (
      data.drawerId !== undefined ||
      data.type === "newPlayer" ||
      data.players
    ) {
      addNewPlayer(window.currentPlayers || []);
    }

    if (data.round && round) round.innerText = `${data.round} of 3 round`;

    if (data.type === "GameOver") {
      clearInterval(countdown);
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
      if (round) round.innerText = "0 of 3 round";
      return;
    } else if (data.type === "DisplayingResult") {
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
      return;
    } else if (data.type === "GotNewOwner") {
      appendMessage("SYSTEM", data.msg, "owner");
      return;
    } else if (data.type === "Solved") {
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
    } else if (data.type === "SelectWord") {
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
      hideCanvasOverlay();
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
      hideCanvasOverlay();
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
      if(ctx) { ctx.beginPath(); ctx.moveTo(data.x, data.y); }
    } else if (data.type === "draw") {
      if(ctx) { ctx.lineTo(data.x, data.y); ctx.stroke(); ctx.moveTo(data.x, data.y); }
    } else if (data.type === "drawEnd") {
      if(ctx) { ctx.closePath(); saveState(); }
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
      if(!ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
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
