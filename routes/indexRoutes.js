const clients = require("../store");
const { formatPlayers, formatGame, createRoomLink } = require("../utils/helpers");

function setupRoutes(app) {
  app.get("/:roomCode", (req, res) => {
    if (req.params.roomCode in clients) {
      if (!req.session) {
          req.session = {}; // in case of error
      }
      return res.render("main", {
        roomCode: req.params.roomCode,
        users: formatPlayers(clients[req.params.roomCode]["players"]),
        game: formatGame(
          clients[req.params.roomCode]["game"],
          clients[req.params.roomCode]["players"],
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
      currentWord: "default",
      round: 1,
      solved: new Set(),
      scores: {},
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
    res.render("index");
  });
}

module.exports = setupRoutes;
