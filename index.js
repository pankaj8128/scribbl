const express = require("express");
const http = require("http");
const { Server, WebSocket } = require("ws");
const app = express();
const cookieParser = require("cookie-parser");
app.use(cookieParser());
const cookie = require("cookie");
const server = http.createServer(app);
const wss = new Server({ server });
const fs = require("fs");
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
const clients = new Map();

app.get("/:roomCode", (req, res) => {
  if (req.params.roomCode in clients)
    return res.render("main", {
      roomCode: req.params.roomCode,
      users: clients[req.params.roomCode]["players"],
      game: clients[req.params.roomCode]["game"],
    });
  res.redirect("/");
});

app.post("/create-room", (req, res) => {
  const username = req.body.username;
  if (!username) return res.redirect("/");
  const roomCode = createRoomLink();
  const id = createRoomLink();
  const player = {
    ip: req.ip,
    isOwner: true,
    id: id,
    username: username,
    score: 0,
  };
  clients[roomCode] = { players: [player] };
  const game = {
    started: false,
    startTime: Date.now(),
    drawing: 0,
    currentWord: "default",
    round: 1,
    solved: new Set(),
  };
  clients[roomCode]["game"] = game;
  res.cookie("roomCode", roomCode);
  res.cookie("id", id);
  res.cookie("username", username);
  res.cookie("isOwner", 1);
  res.redirect(`/${roomCode}`);
});

app.post("/join-room", (req, res) => {
  const username = req.body.username;
  const roomCode = req.body.roomCode;
  if (!username || !roomCode) return res.redirect("/");
  const id = createRoomLink();
  if (roomCode in clients) {
    const player = {
      ip: req.ip,
      isOwner: false,
      id: id,
      username: username,
      score: 0,
    };
    clients[roomCode]["players"].push(player);
    res.cookie("roomCode", roomCode);
    res.cookie("id", id);
    res.cookie("username", username);
    res.cookie("isOwner", 0);
    res.redirect(`/${roomCode}`);
  } else {
    res.redirect("/");
  }
});

wss.on("connection", (socket, req) => {
  const rawCookies = req.headers.cookie || "";
  const cookies = cookie.parse(rawCookies);
  const roomCode = cookies.roomCode;
  if (!roomCode || !clients[roomCode]) {
    socket.close();
    return;
  }
  socket["roomCode"] = cookies.roomCode;
  socket["username"] = cookies.username;
  socket["id"] = cookies.id;
  const player = clients[roomCode]["players"].find((p) => p.id === cookies.id);
  if (player) player["client"] = socket;
  clients[roomCode]["players"].forEach((player) => {
    if (player.client.readyState === WebSocket.OPEN) {
      player.client.send(
        JSON.stringify({
          type: "newPlayer",
          data: clients[roomCode]["players"],
        }),
      );
    }
  });

  socket.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (e) {
      return;
    }

    if (!data.roomCode) data.roomCode = roomCode;
    if (!clients[data.roomCode]) return;
    if (!clients[roomCode]) return;

    if (data.type === "StartGame") {
      const roomCode = data.roomCode;

      // selecting next drawer
      clients[roomCode]["game"].started = true;
      clients[roomCode]["game"].solved.clear();
      if (
        clients[roomCode]["game"].drawing >= clients[roomCode]["players"].length
      ) {
        clients[roomCode]["game"].round++;
        clients[roomCode]["game"].drawing = 0;
      }

      let loopCheck = 0;
      while (
        loopCheck < clients[roomCode]["players"].length &&
        clients[roomCode]["players"][clients[roomCode]["game"].drawing].client
          .readyState !== WebSocket.OPEN
      ) {
        ++clients[roomCode]["game"].drawing;
        if (
          clients[roomCode]["game"].drawing >=
          clients[roomCode]["players"].length
        ) {
          clients[roomCode]["game"].round++;
          clients[roomCode]["game"].drawing = 0;
        }
        loopCheck++;
      }

      if (loopCheck >= clients[roomCode]["players"].length) {
        clients[roomCode]["game"].started = false;
        return;
      }

      // checking if 3 rounds are over
      if (clients[roomCode]["game"].round > 3) {
        clients[roomCode]["game"].round = 1;
        clients[roomCode]["game"].started = false;
        clients[roomCode]["players"].forEach((player) => (player.score = 0));
        clients[roomCode]["players"].forEach((player) => {
          if (player.client.readyState === WebSocket.OPEN) {
            player.client.send(
              JSON.stringify({ type: "GameOver", msg: "Game is over!!" }),
            );
          }
        });
        return;
      }

      const words = getWords();
      clients[roomCode]["game"].startTime = Date.now();
      clients[roomCode]["players"].forEach((player) => {
        if (
          player.username !==
            clients[roomCode]["players"][clients[roomCode]["game"].drawing]
              .username &&
          player.client.readyState === WebSocket.OPEN
        ) {
          player.client.send(
            JSON.stringify({
              type: "StartGame",
              from: data.from,
              msg: `Starting round: ${clients[roomCode]["game"].round}/3. ${clients[roomCode]["players"][clients[roomCode]["game"].drawing].username.toUpperCase()} is drawing...`,
              round: clients[roomCode]["game"].round,
            }),
          );
        } else if (
          player.username ===
            clients[roomCode]["players"][clients[roomCode]["game"].drawing]
              .username &&
          player.client.readyState === WebSocket.OPEN
        ) {
          player.client.send(
            JSON.stringify({
              type: "SelectWord",
              msg: `Starting round: ${clients[roomCode]["game"].round}/3. Select the word`,
              words,
              round: clients[roomCode]["game"].round,
            }),
          );
        }
      });
      return;
    }

    if (data.type === "SetCurrentWord") {
      const roomCode = data.roomCode;
      const word = data.word;
      clients[roomCode]["game"].currentWord = word;
      clients[roomCode]["game"].startTime = Date.now();
      clients[roomCode]["players"].forEach((player) => {
        if (
          clients[roomCode]["players"].indexOf(player) !==
            clients[roomCode]["game"].drawing &&
          player.client.readyState === WebSocket.OPEN
        ) {
          player.client.send(
            JSON.stringify({
              type: "GuessWord",
              msg: `Word of length: ${word.length}`,
              length: word.length,
            }),
          );
        } else if (
          clients[roomCode]["players"].indexOf(player) ===
            clients[roomCode]["game"].drawing &&
          player.client.readyState === WebSocket.OPEN
        ) {
          player.client.send(
            JSON.stringify({
              type: "SYSTEM",
              msg: "Draw the word",
            }),
          );
        }
      });
      return;
    }

    if (["drawStart", "draw", "drawEnd", "undo", "clear"].includes(data.type)) {
      clients[data.roomCode]["players"].forEach((player) => {
        if (
          player.client !== socket &&
          player.client.readyState === WebSocket.OPEN
        ) {
          // Broadcast to all other players in the room
          player.client.send(message.toString());
        }
      });
      return;
    }

    if (data.type === "GetTime") return getTime(data.roomCode);

    if (
      data.msg === clients[data.roomCode]["game"].currentWord ||
      Date.now() >= clients[data.roomCode]["game"].startTime + 80000
    ) {
      if (data.msg === clients[data.roomCode]["game"].currentWord)
        data.msg = "Solved";
      data.type = "Solved";
      const username = data.from;
      if (!clients[data.roomCode]["game"]["solved"].has(username)) {
        clients[data.roomCode]["game"]["solved"].add(username);
        const player = clients[data.roomCode]["players"].find(
          (player) => player.username === username,
        );
        const currentScore = calculateScore(
          Date.now(),
          clients[data.roomCode]["game"].startTime,
          clients[data.roomCode]["game"]["solved"].size,
        );
        if (player) player.score += currentScore;
        const drawingPlayer =
          clients[data.roomCode]["players"][clients[roomCode]["game"].drawing];
        if (drawingPlayer) drawingPlayer.score += Math.floor(currentScore / 2);
      }
    }

    // send message to all
    clients[data.roomCode]["players"].forEach((player) => {
      if (player.client.readyState === WebSocket.OPEN) {
        player.client.send(
          JSON.stringify({ type: "casual", from: data.from, msg: data.msg }),
        );
      }
    });

    // everyone solved
    if (
      clients[data.roomCode]["game"]["solved"].size ===
      clients[data.roomCode]["players"].length - 1
    ) {
      clients[roomCode]["game"].drawing++;
      clients[data.roomCode]["players"].forEach((player) => {
        if (player.client.readyState === WebSocket.OPEN) {
          player.client.send(
            JSON.stringify({
              type: "newPlayer",
              data: clients[roomCode]["players"],
            }),
          );
          player.client.send(
            JSON.stringify({
              type: "AllSolved",
              msg: "Everyone guessed it correctly!",
            }),
          );
        }
      });
    }
  });

  socket.on("close", () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !clients[roomCode]) return;

    const playerIndex = clients[roomCode]["players"].findIndex(
      (p) => p.id === socket.id,
    );
    if (playerIndex !== -1) {
      clients[roomCode]["players"].splice(playerIndex, 1);
    }

    clients[roomCode]["players"].forEach((player) => {
      if (player.client.readyState === WebSocket.OPEN) {
        player.client.send(
          JSON.stringify({
            type: "Exit",
            msg: `${socket.username} exited the game`,
          }),
        );
        player.client.send(
          JSON.stringify({
            type: "newPlayer",
            data: clients[roomCode]["players"],
          }),
        );
      }
    });
  });

  socket.on("error", (error) => {
    console.log("Error: ", error);
  });
});

app.get("/", (req, res) => {
  res.render("index");
});

function createRoomLink() {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let link = "";
  while (link.length != 7)
    link += charset[Math.floor(Math.random() * charset.length)];
  return link;
}

let cachedWords = null;

function getWords() {
  try {
    if (!cachedWords) {
      let data = fs.readFileSync("words.txt", "utf8");
      cachedWords = data
        .split("\n")
        .map((w) => w.trim())
        .filter((w) => w.length > 0);
      if (cachedWords.length < 3) cachedWords = ["Home", "Traffic", "School"];
    }

    const words = [];
    let attempts = 0;
    while (words.length < 3 && attempts < 50) {
      let word = cachedWords[Math.floor(Math.random() * cachedWords.length)];
      if (words.indexOf(word) == -1) words.push(word);
      attempts++;
    }
    return words;
  } catch (err) {
    return ["Home", "Traffic", "School"];
  }
}

function calculateScore(endTime, startTime, rank) {
  const remainingTime = 80000 - (endTime - startTime);
  if (remainingTime <= 0) return 0;
  const rankFactor = getRankFactor(rank);
  const score = 450 * (remainingTime / 80000) * rankFactor;
  return Math.round(score);
}

function getRankFactor(rank) {
  if (rank === 1) return 1;
  if (rank === 2) return 0.9;
  if (rank === 3) return 0.8;
  if (rank === 4) return 0.7;
  if (rank === 5) return 0.6;
  return 0.5;
}

function roomData(roomCode) {
  const room = clients[roomCode];
  console.log(`--- Debugging Room: ${roomCode} ---`);
  console.log("Players:");
  room.players.forEach((player, index) => {
    console.log(`  [${index}] ${player.username} - Score: ${player.score})`);
  });
  console.log("Game State:");
  for (const key in room.game) {
    if (key === "startTime")
      console.log(`  ${key}: ${new Date(room.game[key]).toLocaleString()}`);
    else if (key === "solved")
      console.log(`Solved data: ${JSON.stringify(room.game[key])}`);
    else console.log(`  ${key}: ${room.game[key]}`);
  }
  console.log("------------------------------");
}

function getTime(roomCode) {
  return Math.floor((Date.now() - clients[roomCode]["game"].startTime) / 1000);
}

server.listen(3000, () => {
  console.log("http://localhost:3000");
});
