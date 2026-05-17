const socket = new WebSocket(`ws://${window.location.host}`);

const chatContainer = document.getElementById("chat-container");
const chatMessages = document.getElementById("chat-messages");
const playerListContainer = document.getElementById("player-list-container");
const canvas = document.getElementById("draw-container");
const msgBox = document.querySelector(".msgBox");
const sendBtn = document.querySelector(".sendBtn");
const chooseWord = document.getElementById("choose-words");
const startBtn = document.getElementById("start");
const userInfo = document.getElementById("users-info");
const timer = document.getElementById("timer");
const round = document.getElementById("round");
const roomCodeBtn = document.getElementById("roomCode");

const ctx = canvas.getContext("2d");

let isPainting = false;
let undoStack = [];
const MAX_UNDO = 20;

initCanvas();

let countdown = 0;
const id = getCookie("id");
const username = getCookie("username");
const roomCode = getCookie("roomCode");

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

socket.onopen = () => {
  appendMessage("SYSTEM", "Connected to Room", "success");
};

socket.onclose = () => {
  appendMessage("SYSTEM", "Disconnected from server", "error");
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

    if (data.round && round) {
      round.innerHTML = `<span class="round-prefix">Round </span>${data.round}<span class="round-sep-long"> of </span><span class="round-sep-short">/</span>3`;
    }

    if (data.type === "GameOver") {
      clearInterval(countdown);
      appendMessage("SYSTEM", data.msg, "gameover");

      const sortedFinal = [...(data.players || [])].sort(
        (a, b) => b.score - a.score,
      );
      const leaderboardHtml = sortedFinal
        .map((p, i) => {
          const hue =
            Array.from(p.username).reduce((a, b) => a + b.charCodeAt(0), 0) %
            360;
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
        round.innerHTML = `<span class="round-prefix">Round </span>0<span class="round-sep-long"> of </span><span class="round-sep-short">/</span>3`;
      }
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
      startBtn.disabled = false;
      return;
    } else if (data.type === "GotNewOwner") {
      appendMessage("SYSTEM", data.msg, "owner");
      return;
    } else if (data.type === "Solved") {
      const playerRow = document.getElementById(`player-${data.id}`);
      if (playerRow) playerRow.style.background = "rgba(74, 222, 128, 0.2)";
      appendMessage(data.from, data.msg, "solved");
      if (data.word) {
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
      chooseWord.innerHTML = "";

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
      msgBox.disabled = true;
      return;
    } else if (data.type === "StartGame") {
      appendMessage("SYSTEM", data.msg, "round");
      chooseWord.innerHTML = "";
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
      chooseWord.innerHTML = "";
      const button = document.createElement("button");
      button.setAttribute("id", data.word);
      button.classList.add("word");
      button.innerText = data.word;
      chooseWord.appendChild(button);
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
      chooseWord.innerHTML = "";
      const button = document.createElement("button");
      button.setAttribute("id", word);
      button.classList.add("word");
      button.innerText = word;
      chooseWord.appendChild(button);
      disableDrawing();
      clearCanvas(false);
      msgBox.disabled = false;
    } else if (data.type === "newPlayer") {
    } else if (data.type === "drawStart") {
      ctx.beginPath();
      ctx.moveTo(data.x, data.y);
    } else if (data.type === "draw") {
      ctx.lineTo(data.x, data.y);
      ctx.stroke();
      ctx.moveTo(data.x, data.y);
    } else if (data.type === "drawEnd") {
      ctx.closePath();
      saveState();
    } else if (data.type === "undo") {
      undo(false);
    } else if (data.type === "clear") {
      clearCanvas(false);
    } else if (data.type === "RequestCanvas") {
      if (socket.readyState === WebSocket.OPEN) {
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

socket.onerror = (error) => {
  appendMessage(
    "SYSTEM",
    `WebSocket error: ${error.message || "Unknown error"}`,
    "error",
  );
};

function showResultOverlay(players, roundScores, word, timeRemainingSecs = 5) {
  const container = document.querySelector(".main-game-container");
  const existing = document.getElementById("result-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "result-overlay";
  overlay.innerHTML = `
    <div class="result-overlay-inner">
      <h2 class="result-title">🎯 Round Results</h2>
      ${word ? `<div class="result-word-reveal">The word was: <span class="revealed-word">${word}</span></div>` : ""}
      <div class="result-players">
        ${players
      .map((p, i) => {
        const gained = roundScores[p.id] || 0;
        const isMe = p.id === id;
        return `
              <div class="result-player-row ${isMe ? "result-me" : ""}" style="animation-delay: ${i * 0.1}s">
                <div class="result-rank">${i + 1}</div>
                <div class="result-name">${p.username}${isMe ? " (you)" : ""}</div>
                <div class="result-score">${p.score}</div>
                ${gained > 0 ? `<div class="result-gained">+${gained}</div>` : `<div class="result-gained zero">+0</div>`}
              </div>
            `;
      })
      .join("")}
      </div>
    </div>
  `;

  container.insertBefore(overlay, container.firstChild);

  setTimeout(
    () => {
      overlay.classList.add("result-fade-out");
      setTimeout(() => overlay.remove(), 400);
    },
    Math.max(0, timeRemainingSecs * 1000 - 400),
  );
}

function showCanvasOverlay(htmlContent) {
  hideCanvasOverlay();
  const container = document.querySelector(".canvas-wrapper");
  const overlay = document.createElement("div");
  overlay.id = "canvas-status-overlay";
  overlay.innerHTML = htmlContent;
  container.appendChild(overlay);
}

function hideCanvasOverlay() {
  const existing = document.getElementById("canvas-status-overlay");
  if (existing) existing.remove();
}

function addNewPlayer(dataset) {
  if (!dataset || !dataset.length) return;
  const sortedPlayers = [...dataset].sort((a, b) => b.score - a.score);

  let htmlResult = "";

  sortedPlayers.forEach((player, index) => {
    const isMe = player.id === id;
    const isDrawer = window.currentDrawerId === player.id;
    const hue =
      Array.from(player.username).reduce((a, b) => a + b.charCodeAt(0), 0) %
      360;

    htmlResult += `
      <div class="player-entry" id="player-${player.id}">
        <div class="player-rank">#${index + 1}</div>
        <div class="player-info">
          <div class="player-name">
            <strong>${player.username}${isMe ? " (you)" : ""}</strong>
            ${isDrawer ? '<span class="pencil-icon" title="Drawing">✏️</span>' : ""}
          </div>
          <div class="player-score">${player.score} points</div>
        </div>
      </div>
    `;
  });

  const usersInfoDiv = document.getElementById("users-info");
  if (usersInfoDiv) {
    usersInfoDiv.innerHTML = htmlResult;
  }
}

function appendMessage(from = "SYSTEM", content, type = "chat") {
  const msgElement = document.createElement("div");
  msgElement.classList.add("msg", `msg-${type}`);

  const isSystem = [
    "success",
    "error",
    "join",
    "leave",
    "round",
    "gameover",
    "owner",
    "warning",
    "info",
    "solved",
  ].includes(type);

  if (isSystem) {
    const icon =
      {
        success: "✅",
        error: "❌",
        join: "🟢",
        leave: "🔴",
        round: "🎯",
        gameover: "🏆",
        owner: "👑",
        warning: "⚠️",
        info: "ℹ️",
        solved: "✔️",
      }[type] || "";
    msgElement.innerHTML = `<span class="msg-icon">${icon}</span><span class="msg-content">${content}</span>`;
  } else {
    msgElement.innerHTML = `<span class="msg-user">${from}:</span> <span class="msg-content">${content}</span>`;
  }

  chatMessages.appendChild(msgElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
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

function initCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000000";

  saveState();
}

function saveState() {
  if (undoStack.length >= MAX_UNDO) undoStack.shift();
  undoStack.push(canvas.toDataURL());
}

function undo(emit = true) {
  if (undoStack.length <= 1) return;

  undoStack.pop();
  const previousState = undoStack[undoStack.length - 1];

  const img = new Image();
  img.src = previousState;
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };

  if (emit && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "undo",
        roomCode,
        username,
        id,
      }),
    );
  }
}

function clearCanvas(emit = true) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  undoStack = [];
  saveState();

  if (emit && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "clear",
        roomCode,
        username,
        id,
      }),
    );
  }
}

function getPointerPos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function startPainting(event) {
  isPainting = true;
  const pos = getPointerPos(event);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "drawStart",
        roomCode,
        x: pos.x,
        y: pos.y,
        username,
        id,
      }),
    );
  }
}

function stopPainting() {
  if (!isPainting) return;
  isPainting = false;
  ctx.closePath();
  saveState();

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "drawEnd",
        roomCode,
        username,
        id,
      }),
    );
  }
}

function draw(event) {
  if (!isPainting) return;
  const pos = getPointerPos(event);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  ctx.moveTo(pos.x, pos.y);

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "draw",
        roomCode,
        x: pos.x,
        y: pos.y,
        username,
        id,
      }),
    );
  }
}

canvas.addEventListener("pointerdown", startPainting);
canvas.addEventListener("pointermove", draw);
window.addEventListener("pointerup", stopPainting);

function disableDrawing() {
  canvas.removeEventListener("pointerdown", startPainting);
  canvas.removeEventListener("pointermove", draw);
  canvas.removeEventListener("pointerup", stopPainting);
}

function enableDrawing() {
  canvas.addEventListener("pointerdown", startPainting);
  canvas.addEventListener("pointermove", draw);
  canvas.addEventListener("pointerup", stopPainting);
}

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function getWords() {
  if (socket.readyState === WebSocket.OPEN) {
    const payload = JSON.stringify({ type: "word" });
    socket.send(payload);
  } else {
    appendMessage("SYSTEM", "Socket is not open", "error");
  }
}

function startTimer(time, msg) {
  clearInterval(countdown);
  let timeLeft = time;
  timer.textContent = timeLeft;
  countdown = setInterval(() => {
    timeLeft--;
    timer.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(countdown);
      console.log(msg);
    }
  }, 1000);
}

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

sendBtn.addEventListener("click", sendMessage);

msgBox.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});
