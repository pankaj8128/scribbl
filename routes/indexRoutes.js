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
        isOwner: req.session.isOwner,
      });
    }
    res.redirect("/");
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
    };
    clients[roomCode] = { players: [player] };
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
      const player = {
        ip: req.ip,
        id: id,
        username: username,
        score: 0,
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
    res.render("index", { prefillRoom });
  });
}

module.exports = setupRoutes;
