let currentSelectedColor = "#000000";
let currentBrushSize = 5;
let currentTool = "brush"; // "brush" or "fill"

function hexToRgba(hex) {
  let c = hex.substring(1);
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
    a: 255
  };
}

function floodFill(startX, startY, fillColor) {
  if (!ctx || !canvas) return;

  const width = Math.round(canvas.width);
  const height = Math.round(canvas.height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const fillRGBA = hexToRgba(fillColor);
  const startIdx = (startY * width + startX) * 4;
  const startR = data[startIdx];
  const startG = data[startIdx + 1];
  const startB = data[startIdx + 2];
  const startA = data[startIdx + 3];

  // If the clicked pixel is already matching the fill color, return to prevent infinite loop
  if (
    Math.abs(startR - fillRGBA.r) < 5 &&
    Math.abs(startG - fillRGBA.g) < 5 &&
    Math.abs(startB - fillRGBA.b) < 5 &&
    Math.abs(startA - fillRGBA.a) < 5
  ) {
    return;
  }

  const stack = [startY * width + startX];
  const visited = new Uint8Array(width * height);
  visited[startY * width + startX] = 1;

  while (stack.length > 0) {
    const currIdx = stack.pop();
    const currY = Math.floor(currIdx / width);
    const currX = currIdx % width;

    const idx = currIdx * 4;

    // Tolerance of 20 to handle slightly anti-aliased boundaries
    const match = 
      Math.abs(data[idx] - startR) < 20 &&
      Math.abs(data[idx + 1] - startG) < 20 &&
      Math.abs(data[idx + 2] - startB) < 20 &&
      Math.abs(data[idx + 3] - startA) < 20;

    if (match) {
      data[idx] = fillRGBA.r;
      data[idx + 1] = fillRGBA.g;
      data[idx + 2] = fillRGBA.b;
      data[idx + 3] = fillRGBA.a;

      // Check 4-way neighbors
      if (currX + 1 < width) {
        const nIdx = currIdx + 1;
        if (!visited[nIdx]) { visited[nIdx] = 1; stack.push(nIdx); }
      }
      if (currX - 1 >= 0) {
        const nIdx = currIdx - 1;
        if (!visited[nIdx]) { visited[nIdx] = 1; stack.push(nIdx); }
      }
      if (currY + 1 < height) {
        const nIdx = currIdx + width;
        if (!visited[nIdx]) { visited[nIdx] = 1; stack.push(nIdx); }
      }
      if (currY - 1 >= 0) {
        const nIdx = currIdx - width;
        if (!visited[nIdx]) { visited[nIdx] = 1; stack.push(nIdx); }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

function fillCanvas(x, y, color, emit = true) {
  if (emit && !window.isDrawing) return;
  if (!canvas || !ctx) return;

  const startX = Math.round(x * canvas.width);
  const startY = Math.round(y * canvas.height);

  floodFill(startX, startY, color);
  saveState();

  if (emit && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "fill",
        roomCode,
        x,
        y,
        color,
        username,
        id,
      }),
    );
  }
}

function toggleDrawingToolbar(show) {
  const toolbar = document.getElementById("drawing-toolbar");
  if (toolbar) {
    toolbar.style.display = show ? "flex" : "none";
  }
}

function initDrawingToolbar() {
  const colorPalette = document.getElementById("color-palette");
  const brushSizesPanel = document.getElementById("brush-sizes-panel");
  const colorPreviewBtn = document.getElementById("color-preview-btn");
  const brushPreviewBtn = document.getElementById("brush-preview-btn");

  if (colorPreviewBtn && colorPalette) {
    colorPreviewBtn.addEventListener("click", () => {
      colorPalette.classList.toggle("show");
      if (brushSizesPanel) brushSizesPanel.classList.remove("show");
    });
  }

  if (brushPreviewBtn && brushSizesPanel) {
    brushPreviewBtn.addEventListener("click", () => {
      brushSizesPanel.classList.toggle("show");
      if (colorPalette) colorPalette.classList.remove("show");
    });
  }

  if (colorPalette) {
    colorPalette.addEventListener("click", (e) => {
      const btn = e.target.closest(".color-btn");
      if (!btn) return;
      
      const newColor = btn.getAttribute("data-color");
      if (newColor) {
        currentSelectedColor = newColor;
        const display = document.getElementById("active-color-preview");
        if (display) {
          display.style.setProperty("--selected-color", currentSelectedColor);
        }
      }
      colorPalette.classList.remove("show");
    });
  }

  if (brushSizesPanel) {
    brushSizesPanel.addEventListener("click", (e) => {
      const btn = e.target.closest(".size-btn");
      if (!btn) return;

      brushSizesPanel.querySelectorAll(".size-btn").forEach((b) => {
        b.classList.remove("active");
      });
      btn.classList.add("active");

      const size = parseInt(btn.getAttribute("data-size"));
      if (size) {
        currentBrushSize = size;
        const activeBrushPreview = document.getElementById("active-brush-preview");
        if (activeBrushPreview) {
          const dotClass = Array.from(btn.querySelector('.size-dot').classList).find(c => c.startsWith('dot-'));
          activeBrushPreview.className = `size-dot ${dotClass}`;
        }
      }
      brushSizesPanel.classList.remove("show");
    });
  }

  const btnBrush = document.getElementById("btn-tool-brush");
  const btnFill = document.getElementById("btn-tool-fill");
  
  if (btnBrush && btnFill) {
    btnBrush.addEventListener("click", () => {
      btnBrush.classList.add("active");
      btnFill.classList.remove("active");
      currentTool = "brush";
    });

    btnFill.addEventListener("click", () => {
      btnFill.classList.add("active");
      btnBrush.classList.remove("active");
      currentTool = "fill";
    });
  }

  const btnUndo = document.getElementById("btn-tool-undo");
  const btnClear = document.getElementById("btn-tool-clear");

  if (btnUndo) {
    btnUndo.addEventListener("click", () => {
      undo(true);
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      clearCanvas(true);
    });
  }

  window.addEventListener("keydown", (e) => {
    if (!window.isDrawing) return;
    
    if (
      document.activeElement.tagName === "INPUT" ||
      document.activeElement.tagName === "TEXTAREA"
    ) {
      return;
    }

    const key = e.key.toLowerCase();
    if (key === "b") {
      btnBrush?.click();
    } else if (key === "f") {
      btnFill?.click();
    } else if (key === "u") {
      btnUndo?.click();
    } else if (key === "c") {
      btnClear?.click();
    }
  });
}

function initCanvas() {
  if (!canvas || !ctx) return;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  // Prevent touch scrolling/zooming on canvas
  canvas.style.touchAction = "none";

  ctx.lineWidth = currentBrushSize;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = currentSelectedColor;

  initDrawingToolbar();
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
  if (!window.isDrawing) return;
  event.preventDefault(); // Prevent scroll/zoom on mobile

  const pos = getPointerPos(event);

  if (currentTool === "fill") {
    fillCanvas(pos.x / canvas.width, pos.y / canvas.height, currentSelectedColor);
    return;
  }

  isPainting = true;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  
  ctx.strokeStyle = currentSelectedColor;
  ctx.lineWidth = currentBrushSize;

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "drawStart",
        roomCode,
        x: pos.x / canvas.width,
        y: pos.y / canvas.height,
        color: currentSelectedColor,
        thickness: currentBrushSize,
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
        color: currentSelectedColor,
        thickness: currentBrushSize,
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
  toggleDrawingToolbar(false);
}

function enableDrawing() {
  if (!canvas) return;
  canvas.addEventListener("pointerdown", startPainting);
  canvas.addEventListener("pointermove", draw);
  canvas.addEventListener("pointerup", stopPainting);
  toggleDrawingToolbar(true);
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
    ctx.lineWidth = currentBrushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = currentSelectedColor;
  };
  img.src = imageData;
});
