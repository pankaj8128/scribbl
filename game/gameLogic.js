const { WebSocket } = require("ws");
const clients = require("../store");
const {
  getWords,
  getCustomWords,
  formatPlayers,
  formatGame,
} = require("../utils/helpers");

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
  if (getNextDrawer(roomCode) === -1) return;
  if (checkIfGameOver(roomCode)) return;
  return selectingWord(roomCode);
}

function checkIfGameOver(roomCode) {
  if (!clients[roomCode] || !clients[roomCode]["game"].isStarted) return false;
  const maxRounds = clients[roomCode]["game"].settings.rounds || 3;
  if (
    clients[roomCode]["game"].round > maxRounds ||
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
    const isPublic = clients[roomCode]["game"].isPublic;
    resetGame(roomCode);

    if (isPublic && clients[roomCode]["players"].length >= 2) {
      setTimeout(() => {
        if (
          clients[roomCode] &&
          !clients[roomCode]["game"].isStarted &&
          clients[roomCode]["players"].length >= 2
        ) {
          startGame(roomCode);
        }
      }, 10000);
    }
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
  const customWordsInput = clients[roomCode]["game"].settings.customWords;
  const wordCount = clients[roomCode]["game"].settings.wordCount || 3;
  const words = getCustomWords(customWordsInput, wordCount);
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
          time: 15,
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
  const drawTime = clients[roomCode]["game"].settings.drawTime || 80;
  clearTimeout(clients[roomCode]["game"].countDown);
  clients[roomCode]["game"].currentWord = word;
  clients[roomCode]["game"].startTime = Date.now();
  clients[roomCode]["game"].status = "DrawingWord";
  clients[roomCode]["game"].countDown = setTimeout(() => {
    displayResult(roomCode);
  }, drawTime * 1000);
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
          wordLengths: word.split(" ").map((w) => w.length),
          time: drawTime,
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
          time: drawTime,
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
  const currentWord = clients[roomCode]["game"].currentWord;
  clients[roomCode]["game"].currentWord = "";
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
          msg: `'${currentWord}' was the word.`,
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
  const isPublic = clients[roomCode]["game"].isPublic;
  clients[roomCode]["game"] = {
    isStarted: false,
    startTime: Date.now(),
    countDown: "",
    drawing: -1,
    status: "",
    currentWord: "",
    round: 1,
    solved: new Set(),
    scores: {},
    isPublic: isPublic,
    settings: clients[roomCode]["game"].settings || {
      customWords: "",
      rounds: 3,
      drawTime: 80,
      wordCount: 3,
    },
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

const REFILL_RATE = 1; // 1 token/sec
const CAPACITY = 3;

function allowRequest(roomCode, id) {
  const player = clients[roomCode]["players"].find((p) => p.id === id);
  if (!player) return false;

  let bucket = player.bucket;

  if (!bucket || typeof bucket.tokens === "undefined") {
    bucket = {
      tokens: CAPACITY,
      lastRefill: Date.now(),
    };
    player.bucket = bucket;
  }

  const now = Date.now();

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000;
  const tokensToAdd = elapsed * REFILL_RATE;

  bucket.tokens = Math.min(CAPACITY, bucket.tokens + tokensToAdd);

  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true; // allowed
  }

  return false; // rate limited
}

const WARNING_REFILL_RATE = 1 / 30; // 1 token every 30 seconds
const MAX_WARNINGS = 2;

function handleWarning(roomCode, id) {
  const player = clients[roomCode]["players"].find((p) => p.id === id);
  if (!player) return { allowed: false, remaining: 0 };

  let warningBucket = player.warningBucket;

  if (!warningBucket || typeof warningBucket.tokens === "undefined") {
    warningBucket = {
      tokens: MAX_WARNINGS,
      lastRefill: Date.now(),
    };
    player.warningBucket = warningBucket;
  }

  const now = Date.now();
  const elapsed = (now - warningBucket.lastRefill) / 1000;
  const tokensToAdd = elapsed * WARNING_REFILL_RATE;

  warningBucket.tokens = Math.min(MAX_WARNINGS, warningBucket.tokens + tokensToAdd);
  warningBucket.lastRefill = now;

  if (warningBucket.tokens >= 1) {
    warningBucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(warningBucket.tokens) };
  } else {
    if (player.ip) {
      if (!clients[roomCode].bannedIPs) {
        clients[roomCode].bannedIPs = new Set();
      }
      clients[roomCode].bannedIPs.add(player.ip);
    }
    return { allowed: false, remaining: 0 };
  }
}

module.exports = {
  startGame,
  checkIfGameOver,
  selectingWord,
  setCurrentWord,
  displayResult,
  resetGame,
  allowRequest,
  handleWarning,
};
