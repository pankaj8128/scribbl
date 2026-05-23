const fs = require("fs");
const clients = require("../store");

let cachedWords = null;

function formatPlayers(players) {
  if (!players) return;
  return players.map((p) => ({
    id: p.id,
    username: p.username,
    score: p.score,
  }));
}

function formatGame(g, players) {
  if (!g) return;
  return {
    isStarted: g.isStarted,
    startTime: g.startTime,
    drawing: g.drawing,
    drawerId:
      g.drawing !== -1 && players && players[g.drawing]
        ? players[g.drawing].id
        : null,
    round: g.round,
    status: g.status,
    solved: Array.from(g.solved),
    wordLength: g.currentWord.length,
    settings: g.settings,
    isPublic: g.isPublic,
  };
}

function createRoomLink() {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let link = "";
  while (link.length < 7)
    link += charset[Math.floor(Math.random() * charset.length)];
  return link;
}

function getWords(excludeWords = []) {
  try {
    if (!cachedWords) {
      let data = fs.readFileSync("words.txt", "utf8");
      cachedWords = data
        .split("\n")
        .map((w) => w.trim())
        .filter((w) => w.length > 0);
      if (cachedWords.length < 3) cachedWords = ["Home", "Traffic", "School"];
    }

    // Return the full array instead of random sampling here, so getCustomWords can use it
    return cachedWords;
  } catch (err) {
    return ["Home", "Traffic", "School"];
  }
}

function getCustomWords(customWordsString, count = 3) {
  let list = [];
  if (customWordsString && typeof customWordsString === "string") {
    list = customWordsString.split(",").map(w => w.trim()).filter(w => w.length > 0);
  }
  
  if (list.length < 10) {
    list = getWords();
  }

  const words = [];
  let attempts = 0;
  while (words.length < count && attempts < 50) {
    let word = list[Math.floor(Math.random() * list.length)];
    if (words.indexOf(word) === -1) words.push(word);
    attempts++;
  }
  return words;
}

function calculateScore(endTime, startTime, rank, drawTime = 80) {
  const maxTime = drawTime * 1000;
  const remainingTime = maxTime - (endTime - startTime);
  if (remainingTime <= 0) return 0;
  const rankFactor = getRankFactor(rank);
  const score = 450 * (remainingTime / maxTime) * rankFactor;
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
  if (!room) return;
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
  if (!clients[roomCode]) return 0;
  return Math.floor((Date.now() - clients[roomCode]["game"].startTime) / 1000);
}

module.exports = {
  formatPlayers,
  formatGame,
  createRoomLink,
  getWords,
  getCustomWords,
  calculateScore,
  getRankFactor,
  roomData,
  getTime,
};
