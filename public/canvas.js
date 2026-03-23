function initCanvas() {
  if (!canvas || !ctx) return;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  // Prevent touch scrolling/zooming on canvas
  canvas.style.touchAction = "none";

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
  // Block undo if not the drawer
  if (emit && !window.isDrawing) return;
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
  // Block clear if not the drawer (but allow non-emit calls for local resets)
  if (emit && !window.isDrawing) return;
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
  event.preventDefault(); // Prevent scroll/zoom on mobile
  isPainting = true;
  const pos = getPointerPos(event);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "drawStart",
        roomCode,
        x: pos.x / canvas.width,
        y: pos.y / canvas.height,
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
  event.preventDefault(); // Prevent scroll/zoom on mobile
  const pos = getPointerPos(event);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  ctx.moveTo(pos.x, pos.y);

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "draw",
        roomCode,
        x: pos.x / canvas.width,
        y: pos.y / canvas.height,
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

// Re-scale canvas on window resize to keep drawing surface in sync
window.addEventListener("resize", () => {
  if (!canvas || !ctx) return;
  const imageData = canvas.toDataURL();
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000000";
  };
  img.src = imageData;
});
