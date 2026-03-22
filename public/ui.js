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

  if (chatMessages) {
    chatMessages.appendChild(msgElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function startTimer(time, msg) {
  clearInterval(countdown);
  let timeLeft = time;
  if(timer) timer.textContent = timeLeft;
  countdown = setInterval(() => {
    timeLeft--;
    if(timer) timer.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(countdown);
      console.log(msg);
    }
  }, 1000);
}
