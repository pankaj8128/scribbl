function initCanvas() {
  if (!canvas || !ctx) return;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000000";

  saveState();
}

function saveState() {
  if (!canvas) return;
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
  if (!ctx) return;
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

function disableDrawing() {
  if (!canvas) return;
  canvas.removeEventListener("pointerdown", startPainting);
  canvas.removeEventListener("pointermove", draw);
  canvas.removeEventListener("pointerup", stopPainting);
}

function enableDrawing() {
  if (!canvas) return;
  canvas.addEventListener("pointerdown", startPainting);
  canvas.addEventListener("pointermove", draw);
  canvas.addEventListener("pointerup", stopPainting);
}
