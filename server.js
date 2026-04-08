// server.js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import fetch from "node-fetch";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

let roomState = {
  players: [],
  scores: [],
  currentPlayer: 0,
  lastLetter: null,
  timer: null
};

// dictionary checker
async function isValidWord(w) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${w}`
    );
    return res.ok;
  } catch {
    return false;
  }
}

function nextPlayer() {
  roomState.currentPlayer =
    (roomState.currentPlayer + 1) % roomState.players.length;
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // add player
  if (roomState.players.length < 3) {
    roomState.players.push(socket.id);
    roomState.scores.push(0);
  }

  io.emit("stateUpdate", roomState);

  socket.on("submitWord", async (word) => {
    word = word.toLowerCase().trim();
    const cp = roomState.currentPlayer;
    const sid = roomState.players[cp];

    if (socket.id !== sid) return;

    if (
      roomState.lastLetter &&
      word[0] !== roomState.lastLetter
    ) {
      io.emit(
        "message",
        `❌ Wrong start letter! Should be "${roomState.lastLetter}"`
      );
      nextPlayer();
      io.emit("stateUpdate", roomState);
      return;
    }

    const valid = await isValidWord(word);
    if (!valid) {
      io.emit("message", "❌ Not a valid English word!");
      nextPlayer();
      io.emit("stateUpdate", roomState);
      return;
    }

    roomState.lastLetter = word[word.length - 1];
    roomState.scores[cp]++;
    nextPlayer();

    io.emit("stateUpdate", roomState);
    io.emit(
      "message",
      `✅ Word accepted! Next should start with "${roomState.lastLetter}"`
    );
  });

  socket.on("resetGame", () => {
    roomState = {
      players: [],
      scores: [],
      currentPlayer: 0,
      lastLetter: null
    };
    io.emit("stateUpdate", roomState);
  });
});

httpServer.listen(3000, () => {
  console.log("Listening on http://localhost:3000");
});