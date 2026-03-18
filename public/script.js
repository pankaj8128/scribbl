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
const isOwner = Boolean(Number(getCookie("isOwner")));

document.addEventListener("DOMContentLoaded", () => {
  startBtn.innerText = isOwner ? "Start Game" : "Waiting to Start...";
  if (!isOwner) startBtn.style.opacity = "0.6";
});

roomCodeBtn.addEventListener("click", () => {
  navigator.clipboard
    .writeText(roomCodeBtn.innerText)
    .then(() => {
      appendMessage("SYSTEM", "Room Code Copied!", "");
    })
    .catch((err) => {
      console.log("Error copying room code: ", err);
      appendMessage("SYSTEM", "Error copying room code.", "err");
    });
});

socket.onopen = () => {
  appendMessage("SYSTEM", "Connected to Room", "server");
};

socket.onclose = () => {
  appendMessage("SYSTEM", "Disconnected from server", "error");
};

socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data.round) round.innerText = `${data.round} of 3 round`;
    if (data.type === "GameOver") {
      clearInterval(countdown);
      round.innerText = "0 of 3 round";
    }
    if (data.type === "SelectWord") {
      appendMessage("SYSTEM", data.msg, "server");
      clearInterval(countdown);
      let timeLeft = 15;
      timer.textContent = timeLeft;
      countdown = setInterval(() => {
        timeLeft--;
        timer.textContent = timeLeft;
        if (timeLeft <= 0) {
          clearInterval(countdown);
          const button = chooseWord.firstElementChild;
          const word = button.innerText;
          clearInterval(countdown);
          if (socket.readyState === WebSocket.OPEN) {
            const payload = JSON.stringify({
              type: "SetCurrentWord",
              roomCode,
              word,
            });
            socket.send(payload);
            chooseWord.innerHTML = "";
            const button = document.createElement("button");
            button.setAttribute("id", word);
            button.classList.add("word");
            button.innerText = word;
            chooseWord.appendChild(button);
            let timeLeft = 80;
            timer.textContent = timeLeft;
            countdown = setInterval(() => {
              timeLeft--;
              timer.textContent = timeLeft;
              if (timeLeft <= 0) {
                clearInterval(countdown);
                console.log("Time is up!");
              }
            }, 1000);
          } else {
            appendMessage("SYSTEM", "Socket is not open", "error");
          }
          return;
        }
      }, 1000);
      chooseWord.innerHTML = "";
      for (const word of data.words) {
        const button = document.createElement("button");
        button.setAttribute("id", word);
        button.classList.add("word");
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
              chooseWord.innerHTML = "";
              const button = document.createElement("button");
              button.setAttribute("id", word);
              button.classList.add("word");
              button.innerText = word;
              chooseWord.appendChild(button);
              let timeLeft = 80;
              timer.textContent = timeLeft;
              countdown = setInterval(() => {
                timeLeft--;
                timer.textContent = timeLeft;
                if (timeLeft <= 0) {
                  clearInterval(countdown);
                  console.log("Time is up!");
                  clearInterval(countdown);
                  if (socket.readyState === WebSocket.OPEN) {
                    socket.send(
                      JSON.stringify({ type: "casual", msg: "Not Solved" }),
                    );
                  }
                }
              }, 1000);
            } else {
              appendMessage("SYSTEM", "Socket is not open", "error");
            }
          },
          { once: true },
        );
        chooseWord.appendChild(button);
      }
      enableDrawing();
      clearCanvas();
      msgBox.disabled = true;
      return;
    } else if (data.type === "StartGame") {
      appendMessage("SYSTEM", data.msg, "broadcast");
      clearInterval(countdown);
      let timeLeft = 15;
      timer.textContent = timeLeft;
      countdown = setInterval(() => {
        timeLeft--;
        timer.textContent = timeLeft;
        if (timeLeft <= 0) clearInterval(countdown);
      }, 1000);
      return;
    } else if (data.type === "GuessWord") {
      clearInterval(countdown);
      let timeLeft = 80;
      timer.textContent = timeLeft;
      countdown = setInterval(() => {
        timeLeft--;
        timer.textContent = timeLeft;
        if (timeLeft <= 0) {
          clearInterval(countdown);
          console.log("Time is up!");
          clearInterval(countdown);
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "casual", msg: "Not Solved" }));
          }
        }
      }, 1000);
      const word = "_ ".repeat(data.length);
      appendMessage("SYSTEM", data.msg, "server");
      chooseWord.innerHTML = "";
      const button = document.createElement("button");
      button.setAttribute("id", word);
      button.classList.add("word");
      button.innerText = word;
      chooseWord.appendChild(button);
      disableDrawing();
      clearCanvas();
      msgBox.disabled = false;
    } else if (data.type === "AllSolved") {
      if (!isOwner) return;
      if (socket.readyState === WebSocket.OPEN) {
        const payload = JSON.stringify({
          type: "StartGame",
          roomCode,
          msg: "Continuing game...",
        });
        socket.send(payload);
      } else {
        appendMessage("SYSTEM", "Socket is not open", "error");
      }
    } else if (data.type === "newPlayer") {
      addNewPlayer(data.data);
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
    } else {
      appendMessage(data.from, data.msg, "broadcast");
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

function addNewPlayer(dataset) {
  userInfo.innerHTML = `
    <thead>
        <tr>
          <th>Username</th>
          <th>Score</th>
        </tr>
      </thead>
  `;
  for (const data of dataset) {
    userInfo.innerHTML += `
      <tbody>
        <tr>
          <td><strong>${data.username}</strong></td>
          <td>${data.score}</td>
         </tr>
      </tbody>
    `;
  }
}

function appendMessage(from = "SYSTEM", content, type = "broadcast") {
  const msgElement = document.createElement("div");

  // Style based on type
  if (type === "error") {
    msgElement.style.backgroundColor = "#53354a";
    msgElement.style.color = "#e94560";
    msgElement.style.borderLeft = "4px solid #e94560";
  } else if (type === "server") {
    msgElement.style.backgroundColor = "#1b3a31";
    msgElement.style.color = "#4ecca3";
    msgElement.style.textAlign = "center";
    msgElement.style.fontWeight = "bold";
  } else {
    // Standard chat message
    msgElement.innerHTML = `<strong style="color: #4ecca3">${from}:</strong> ${content}`;
  }

  if (type !== "broadcast") {
    msgElement.textContent = `${from}: ${content}`;
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

function startTimer(time) {
  clearInterval(countdown);
  let timeLeft = time;
  timer.textContent = timeLeft;
  countdown = setInterval(() => {
    timeLeft--;
    timer.textContent = timeLeft;
    if (timeLeft <= 0) clearInterval(countdown);
  }, 1000);
}

startBtn.addEventListener("click", () => {
  if (!isOwner) return;
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
