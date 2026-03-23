const { WebSocket } = require("ws");
const clients = require("../store");
const { getWords, formatPlayers, formatGame } = require("../utils/helpers");

function startGame(roomCode) {
  if (!clients[roomCode] || !clients[roomCode]["players"]) return;
  if (clients[roomCode]["players"].length < 2) {
    clients[roomCode]["players"][0].client?.send(
      JSON.stringify({
        type: "SYSTEM",
        msgStyle: "warning",
        msg: "At least 2 players are required to start the game.",
      }),
    );
    return;
  }
  clients[roomCode]["players"].forEach((player) => {
    if (player.client && player.client.readyState === WebSocket.OPEN) {
      player.client.send(
        JSON.stringify({ type: "SYSTEM", msg: "Starting game..." }),
      );
    }
  });
  if (getNextDrawer(roomCode) === -1) return;
  if (checkIfGameOver(roomCode)) return;
  return selectingWord(roomCode);
}

function checkIfGameOver(roomCode) {
  if (!clients[roomCode] || !clients[roomCode]["game"].isStarted) return false;
  if (
    clients[roomCode]["game"].round > 3 ||
    clients[roomCode]["players"].length <= 1
  ) {
    clearTimeout(clients[roomCode]["game"].countDown);
    let winner,
      score = 0,
      id;
    clients[roomCode]["players"].forEach((player) => {
      if (player.score >= score) {
        score = player.score;
        winner = player.username;
        id = player.id;
      }
    });
    const finalPlayers = formatPlayers(clients[roomCode]["players"]);
    clients[roomCode]["players"].forEach((player) => {
      if (player.client && player.client.readyState === WebSocket.OPEN) {
        player.client.send(
          JSON.stringify({
            type: "GameOver",
            msg: `Game is over!! ${winner} won the game!`,
            winnerId: id,
            players: finalPlayers,
          }),
        );
      }
    });
    resetGame(roomCode);
    return true;
  }
  return false;
}

function getNextDrawer(roomCode) {
  if (!clients[roomCode]) return -1;
  clients[roomCode]["game"].drawing++;
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
      ?.readyState !== WebSocket.OPEN
  ) {
    ++clients[roomCode]["game"].drawing;
    if (
      clients[roomCode]["game"].drawing >= clients[roomCode]["players"].length
    ) {
      clients[roomCode]["game"].round++;
      clients[roomCode]["game"].drawing = 0;
    }
    loopCheck++;
  }

  if (loopCheck >= clients[roomCode]["players"].length) {
    clients[roomCode]["game"].isStarted = false;
    console.log("No one to draw?");
    return -1;
  }
  return clients[roomCode]["game"].drawing;
}

function selectingWord(roomCode) {
  if (!clients[roomCode]) return;
  clients[roomCode]["game"].isStarted = true;
  const words = getWords();
  clients[roomCode]["game"].solved.clear();
  clients[roomCode]["game"].startTime = Date.now();
  clients[roomCode]["game"].status = "SelectingWord";
  clearTimeout(clients[roomCode]["game"].countDown);
  clients[roomCode]["game"].countDown = setTimeout(() => {
    setCurrentWord(roomCode, words[Math.floor(Math.random() * words.length)]);
  }, 15000);
  clients[roomCode]["players"].forEach((player) => {
    if (
      player.id !==
      clients[roomCode]["players"][clients[roomCode]["game"].drawing].id &&
      player.client &&
      player.client.readyState === WebSocket.OPEN
    ) {
      player.client.send(
        JSON.stringify({
          type: "StartGame",
          msg: `${clients[roomCode]["players"][clients[roomCode]["game"].drawing].username} is selecting the word...`,
          round: clients[roomCode]["game"].round,
          drawerId:
            clients[roomCode]["players"][clients[roomCode]["game"].drawing].id,
        }),
      );
    } else if (
      player.id ===
      clients[roomCode]["players"][clients[roomCode]["game"].drawing].id &&
      player.client &&
      player.client.readyState === WebSocket.OPEN
    ) {
      player.client.send(
        JSON.stringify({
          type: "SelectWord",
          msg: "Select the word...",
          words,
          round: clients[roomCode]["game"].round,
          drawerId:
            clients[roomCode]["players"][clients[roomCode]["game"].drawing].id,
        }),
      );
    }
  });
}

function setCurrentWord(roomCode, word) {
  if (!clients[roomCode]) return;
  clearTimeout(clients[roomCode]["game"].countDown);
  clients[roomCode]["game"].currentWord = word;
  clients[roomCode]["game"].startTime = Date.now();
  clients[roomCode]["game"].status = "DrawingWord";
  clients[roomCode]["game"].countDown = setTimeout(() => {
    displayResult(roomCode);
  }, 80000);
  clients[roomCode]["players"].forEach((player) => {
    if (
      clients[roomCode]["players"].indexOf(player) !==
      clients[roomCode]["game"].drawing &&
      player.client &&
      player.client.readyState === WebSocket.OPEN
    ) {
      player.client.send(
        JSON.stringify({
          type: "GuessWord",
          msg: `Guess the word of length: ${word.length}`,
          length: word.length,
          drawerId:
            clients[roomCode]["players"][clients[roomCode]["game"].drawing].id,
        }),
      );
    } else if (
      clients[roomCode]["players"].indexOf(player) ===
      clients[roomCode]["game"].drawing &&
      player.client &&
      player.client.readyState === WebSocket.OPEN
    ) {
      player.client.send(
        JSON.stringify({
          type: "DrawWord",
          word,
          msg: "Draw the word.",
          drawerId:
            clients[roomCode]["players"][clients[roomCode]["game"].drawing].id,
        }),
      );
    }
  });
}

function displayResult(roomCode) {
  if (!clients[roomCode]) return;
  clients[roomCode]["game"].status = "DisplayingResult";
  clients[roomCode]["game"].startTime = Date.now();
  clearTimeout(clients[roomCode]["game"].countDown);

  const roundScores = clients[roomCode]["game"]["scores"];

  clients[roomCode]["game"].countDown = setTimeout(() => {
    if (!clients[roomCode]) return;
    applyRoundScores(roomCode, roundScores);
    clients[roomCode]["game"]["scores"] = {};
    startGame(roomCode);
  }, 5000);

  clients[roomCode]["players"].forEach((player) => {
    if (player.client && player.client.readyState === WebSocket.OPEN) {
      player.client.send(
        JSON.stringify({
          type: "DisplayingResult",
          msg: `'${clients[roomCode]["game"].currentWord}' was the word.`,
          players: formatPlayers(clients[roomCode]["players"]),
          roundScores: roundScores,
          word: clients[roomCode]["game"].currentWord,
        }),
      );
    }
  });
}

function applyRoundScores(roomCode, roundScores) {
  if (!clients[roomCode]) return;
  clients[roomCode]["players"].forEach((player) => {
    if (roundScores[player.id]) {
      player.score += roundScores[player.id];
    }
  });
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
}

function resetGame(roomCode) {
  if (!clients[roomCode]) return;
  clients[roomCode]["game"] = {
    isStarted: false,
    startTime: Date.now(),
    countDown: "",
    drawing: -1,
    status: "",
    currentWord: "default",
    round: 1,
    solved: new Set(),
    scores: {},
  };

  clients[roomCode]["players"].forEach((player) => {
    player.score = 0;
  });

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
}

module.exports = {
  startGame,
  checkIfGameOver,
  selectingWord,
  setCurrentWord,
  displayResult,
  resetGame,
};
