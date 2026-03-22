const socket = new WebSocket(`ws://${window.location.host}`);

const chatContainer = document.getElementById("chat-container");
const chatMessages = document.getElementById("chat-messages");
const playerListContainer = document.getElementById("player-list-container");
const canvas = document.getElementById("draw-container");
const msgBox = document.querySelector(".msgBox");
const sendBtn = document.querySelector(".sendBtn");
const chooseWord = document.getElementById("choose-words");
const startBtn = document.getElementById("start");
const userInfo = document.getElementById("users-info");
const timer = document.getElementById("timer");
const round = document.getElementById("round");
const roomCodeBtn = document.getElementById("roomCode");

const ctx = canvas ? canvas.getContext("2d") : null;

let isPainting = false;
let undoStack = [];
const MAX_UNDO = 20;

let countdown = 0;

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

const id = getCookie("id");
const username = getCookie("username");
const roomCode = getCookie("roomCode");
