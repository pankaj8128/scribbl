const { WebSocket } = require("ws");
const cookie = require("cookie");
const clients = require("../store");
const { formatPlayers, formatGame, calculateScore, getTime } = require("../utils/helpers");
const { startGame, setCurrentWord, displayResult, checkIfGameOver } = require("../game/gameLogic");

function onConnect(socket, roomCode) {
  const player = clients[roomCode]["players"].find((p) => p.id === socket.id);
  if (player) player["client"] = socket;

  clients[roomCode]["players"].forEach((player) => {
    if (player.client && player.client.readyState === WebSocket.OPEN) {
      player.client.send(
        JSON.stringify({
          type: "newPlayer",
          players: formatPlayers(clients[roomCode]["players"]),
          game: formatGame(
            clients[roomCode]["game"],
            clients[roomCode]["players"],
          ),
        }),
      );
    }
  });

  clients[roomCode]["players"].forEach((player) => {
    if (
      socket !== player.client &&
      player.client &&
      player.client.readyState === WebSocket.OPEN
    ) {
      player.client.send(
        JSON.stringify({
          type: "SYSTEM",
          msgStyle: "join",
          msg: `${socket.username} has joined!`,
        }),
      );
    }
  });

  const msg =
    socket.id === clients[roomCode]["players"][0].id
      ? "You are the room owner now!"
      : `${clients[roomCode]["players"][0].username} is now the room owner!`;
  socket.send(
    JSON.stringify({
      type: "SYSTEM",
      msgStyle: "owner",
      msg,
    }),
  );

  const game = clients[roomCode]["game"];
  if (game.isStarted) {
    const elapsed = Math.floor((Date.now() - game.startTime) / 1000);
    if (game.status === "SelectingWord") {
      const remaining = 15 - elapsed;
      socket.send(
        JSON.stringify({
          type: "StartGame",
          msg: `${clients[roomCode]["players"][game.drawing].username} is selecting the word...`,
          round: game.round,
          drawerId: clients[roomCode]["players"][game.drawing].id,
          time: remaining > 0 ? remaining : 0,
        }),
      );
    } else if (game.status === "DrawingWord") {
      const remaining = 80 - elapsed;
      socket.send(
        JSON.stringify({
          type: "GuessWord",
          msg: `Guess the word of length: ${game.currentWord.length}`,
          length: game.currentWord.length,
          drawerId: clients[roomCode]["players"][game.drawing].id,
          time: remaining > 0 ? remaining : 0,
        }),
      );
      const drawer = clients[roomCode]["players"][game.drawing];
      if (
        drawer &&
        drawer.client &&
        drawer.client.readyState === WebSocket.OPEN
      ) {
        drawer.client.send(
          JSON.stringify({
            type: "RequestCanvas",
            toPlayerId: socket.id,
          }),
        );
      }
    } else if (game.status === "DisplayingResult") {
      const remaining = 5 - elapsed;
      socket.send(
        JSON.stringify({
          type: "DisplayingResult",
          msg: `${game.currentWord} was the current word. View the result!`,
          players: formatPlayers(clients[roomCode]["players"]),
          roundScores: game.scores,
          word: game.currentWord,
          time: remaining > 0 ? remaining : 0,
        }),
      );
    }
  }
}

function handleSockets(wss) {
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
    onConnect(socket, roomCode);

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
        if (
          clients[roomCode].players[0].id !== socket.id ||
          clients[roomCode].game.isStarted
        )
          return;
        const { resetGame } = require("../game/gameLogic"); // To prevent circular dependency at top level
        resetGame(roomCode);
        return startGame(roomCode);
      }

      if (data.type === "SetCurrentWord") {
        const roomCode = data.roomCode;
        const word = data.word;
        return setCurrentWord(roomCode, word);
      }

      if (data.type === "SyncCanvas") {
        if (!clients[data.roomCode]) return;
        const targetPlayer = clients[data.roomCode]["players"].find(
          (p) => p.id === data.toPlayerId,
        );
        if (
          targetPlayer &&
          targetPlayer.client &&
          targetPlayer.client.readyState === WebSocket.OPEN
        ) {
          targetPlayer.client.send(
            JSON.stringify({
              type: "SyncCanvas",
              image: data.image,
            }),
          );
        }
        return;
      }

      if (["drawStart", "draw", "drawEnd", "undo", "clear"].includes(data.type)) {
        clients[data.roomCode]["players"].forEach((player) => {
          if (
            player.client !== socket &&
            player.client &&
            player.client.readyState === WebSocket.OPEN
          ) {
            player.client.send(message.toString());
          }
        });
        return;
      }

      if (data.type === "GetTime") return getTime(data.roomCode);

      if (
        data.msg && typeof data.msg === "string" &&
        data.msg.toLowerCase() ===
        clients[data.roomCode]["game"].currentWord.toLowerCase()
      ) {
        data.type = "Solved";
        const id = data.id;

        if (!clients[data.roomCode]["game"]["solved"].has(id)) {
          clients[data.roomCode]["game"]["solved"].add(id);
          const player = clients[data.roomCode]["players"].find(
            (player) => player.id === id,
          );
          const currentScore = calculateScore(
            Date.now(),
            clients[data.roomCode]["game"].startTime,
            clients[data.roomCode]["game"]["solved"].size,
          );
          if (player)
            clients[data.roomCode]["game"]["scores"][player.id] = currentScore;
          const drawingPlayer =
            clients[data.roomCode]["players"][
              clients[data.roomCode]["game"].drawing
            ];
          if (drawingPlayer) {
            const drawerBonus = Math.floor(currentScore / 2);
            clients[data.roomCode]["game"]["scores"][drawingPlayer.id] =
              (clients[data.roomCode]["game"]["scores"][drawingPlayer.id] || 0) +
              drawerBonus;
          }
        }
        data.msg = `${socket.username} guessed the word!`;
      }

      clients[data.roomCode]["players"].forEach((player) => {
        if (player.client && player.client.readyState === WebSocket.OPEN) {
          let payload = {
            type: data.type ? data.type : "casual",
            from: data.from,
            id: data.id,
            msg: data.msg,
          };
          if (data.type === "Solved" && player.id === data.id) {
            payload.word = clients[data.roomCode]["game"].currentWord;
          }
          player.client.send(JSON.stringify(payload));
        }
      });

      if (
        clients[data.roomCode]["game"]["solved"].size ===
        clients[data.roomCode]["players"].length - 1
      )
        displayResult(data.roomCode);
    });

    socket.on("close", () => {
      const roomCode = socket.roomCode;
      if (!roomCode || !clients[roomCode]) return;

      const playerIndex = clients[roomCode]["players"].findIndex(
        (p) => p.id === socket.id,
      );

      const wasDrawer = playerIndex === clients[roomCode]["game"].drawing;

      if (playerIndex !== -1) {
        clients[roomCode]["players"].splice(playerIndex, 1);
        if (
          clients[roomCode]["game"].drawing !== -1 &&
          playerIndex <= clients[roomCode]["game"].drawing
        ) {
          clients[roomCode]["game"].drawing--;
        }
      }

      clients[roomCode]["players"].forEach((player) => {
        if (player.client && player.client.readyState === WebSocket.OPEN) {
          player.client.send(
            JSON.stringify({
              type: "Exit",
              msgStyle: "leave",
              msg: `${socket.username} left the game`,
            }),
          );
          player.client.send(
            JSON.stringify({
              type: "newPlayer",
              players: formatPlayers(clients[roomCode]["players"]),
              game: formatGame(
                clients[roomCode]["game"],
                clients[roomCode]["players"],
              ),
            }),
          );
        }
      });

      checkIfGameOver(roomCode);

      if (clients[roomCode]["game"].isStarted) {
        if (
          wasDrawer &&
          clients[roomCode]["game"].status !== "DisplayingResult"
        ) {
          displayResult(roomCode);
        } else if (
          clients[roomCode]["game"].status === "DrawingWord" &&
          clients[roomCode]["game"]["solved"].size >=
            clients[roomCode]["players"].length - 1
        ) {
          displayResult(roomCode);
        }
      }

      if (playerIndex !== 0) return;

      if (clients[roomCode]["players"].length >= 1) {
        if (
          clients[roomCode]["players"][0].client &&
          clients[roomCode]["players"][0].client.readyState === WebSocket.OPEN
        ) {
          clients[roomCode]["players"][0].client.send(
            JSON.stringify({
              type: "NewOwner",
              msg: "You are now the proud owner of this room!",
            }),
          );
        }
        for (let i = 1; i < clients[roomCode]["players"].length; i++) {
          if (
            clients[roomCode]["players"][i].client &&
            clients[roomCode]["players"][i].client.readyState === WebSocket.OPEN
          ) {
            clients[roomCode]["players"][i].client.send(
              JSON.stringify({
                type: "GotNewOwner",
                msg: `${clients[roomCode]["players"][0].username} is now the room owner!`,
              }),
            );
          }
        }
      } else {
        delete clients[roomCode];
      }
    });

    socket.on("error", (error) => {
      console.log("Error: ", error);
    });
  });
}

module.exports = handleSockets;
