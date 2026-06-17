const clients = require("../store");
const {
  formatPlayers,
  formatGame,
  createRoomLink,
} = require("../utils/helpers");

function setupRoutes(app) {

  app.get("/:roomCode", (req, res) => {
    const roomCode = req.params.roomCode;
    if (roomCode in clients) {
      if (clients[roomCode].bannedIPs && clients[roomCode].bannedIPs.has(req.ip)) {
        return res.redirect("/?error=banned");
      }

      if (!req.session) {
        req.session = {}; // in case of error
      }

      if (
        !req.cookies ||
        !req.cookies.username ||
        req.cookies.roomCode !== roomCode
      ) {
        return res.redirect(`/?room=${roomCode}`);
      }

      return res.render("main", {
        roomCode: roomCode,
        users: formatPlayers(clients[roomCode]["players"]),
        game: formatGame(
          clients[roomCode]["game"],
          clients[roomCode]["players"],
        ),
        isOwner: clients[roomCode]["game"].isPublic
          ? false
          : req.session.isOwner,
      });
    }
    res.redirect("/");
  });

  app.post("/play-random", (req, res) => {
    const username = req.body.username;
    if (!username) return res.redirect("/");

    const MAX_PUBLIC_ROOM_SIZE = 8;
    let roomCode = null;

    // Search for an existing public room with space
    for (const code in clients) {
      const room = clients[code];
      if (
        room.game &&
        room.game.isPublic &&
        room.players.length < MAX_PUBLIC_ROOM_SIZE &&
        !(room.bannedIPs && room.bannedIPs.has(req.ip))
      ) {
        roomCode = code;
        break;
      }
    }

    const id = createRoomLink();
    const player = {
      ip: req.ip,
      id: id,
      username: username,
      score: 0,
      bucket: { capacity: 3, lastRefill: "" },
    };

    if (roomCode) {
      // Join existing room
      clients[roomCode]["players"].push(player);
      res.cookie("id", id, { path: "/" });
      res.cookie("username", username, { path: "/" });
      res.cookie("roomCode", roomCode, { path: "/" });
      if (!req.session) req.session = {};
      req.session.isOwner = false;
      res.redirect(`/${roomCode}`);
    } else {
      // Create new public room
      roomCode = createRoomLink();
      clients[roomCode] = { players: [player], bannedIPs: new Set() };
      const game = {
        isStarted: false,
        startTime: Date.now(),
        countDown: "",
        drawing: -1,
        status: "",
        currentWord: "",
        round: 1,
        solved: new Set(),
        scores: {},
        isPublic: true, // Flag this room as public/random matchmaking
        settings: {
          customWords: "",
          rounds: 3,
          drawTime: 80,
          wordCount: 3,
        },
      };
      clients[roomCode]["game"] = game;
      res.cookie("id", id, { path: "/" });
      res.cookie("username", username, { path: "/" });
      res.cookie("roomCode", roomCode, { path: "/" });
      if (!req.session) req.session = {};
      req.session.isOwner = false; // No owner in public rooms!
      res.redirect(`/${roomCode}`);
    }
  });

  app.post("/create-room", (req, res) => {
    const username = req.body.username;
    if (!username) return res.redirect("/");
    const roomCode = createRoomLink();
    const id = createRoomLink();
    const player = {
      ip: req.ip,
      id: id,
      username: username,
      score: 0,
      bucket: { capacity: 3, lastRefill: "" },
    };
    clients[roomCode] = { players: [player], bannedIPs: new Set() };
    const game = {
      isStarted: false,
      startTime: Date.now(),
      countDown: "",
      drawing: -1,
      status: "",
      currentWord: "",
      round: 1,
      solved: new Set(),
      scores: {},
      settings: {
        customWords: "",
        rounds: 3,
        drawTime: 80,
        wordCount: 3,
      },
    };
    clients[roomCode]["game"] = game;
    res.cookie("id", id, { path: "/" });
    res.cookie("username", username, { path: "/" });
    res.cookie("roomCode", roomCode, { path: "/" });
    if (!req.session) req.session = {};
    req.session.isOwner = true;
    res.redirect(`/${roomCode}`);
  });

  app.post("/join-room", (req, res) => {
    const username = req.body.username;
    const roomCode = req.body.roomCode;
    if (!username || !roomCode) return res.redirect("/");
    const id = createRoomLink();
    if (roomCode in clients) {
      if (clients[roomCode].bannedIPs && clients[roomCode].bannedIPs.has(req.ip)) {
        return res.redirect("/?error=banned");
      }
      const player = {
        ip: req.ip,
        id: id,
        username: username,
        score: 0,
        bucket: { capacity: 3, lastRefill: "" },
      };
      clients[roomCode]["players"].push(player);
      res.cookie("id", id, { path: "/" });
      res.cookie("username", username, { path: "/" });
      res.cookie("roomCode", roomCode, { path: "/" });
      if (!req.session) req.session = {};
      req.session.isOwner = false;
      res.redirect(`/${roomCode}`);
    } else {
      res.redirect("/");
    }
  });

  app.get("/", (req, res) => {
    const prefillRoom = req.query.room || "";
    const error = req.query.error || "";
    res.render("index", { prefillRoom, error });
  });
}

module.exports = setupRoutes;
