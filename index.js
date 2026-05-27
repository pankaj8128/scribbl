const express = require("express");
const http = require("http");
const { Server } = require("ws");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const session = require("express-session");

const setupRoutes = require("./routes/indexRoutes");
const handleSockets = require("./sockets/socketHandler");

const app = express();
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback_screct_key",
    resave: false,
    saveUninitialized: true,
  }),
);

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const wss = new Server({ server });

setupRoutes(app);

handleSockets(wss);

server.listen(3000, "0.0.0.0", () => {
  console.log("Server running");
});
