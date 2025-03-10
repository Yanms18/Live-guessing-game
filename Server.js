const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let gameSession = {
  gameMasterId: null,
  question: '',
  answer: '',
  inProgress: false,
  players: {},
  guessAttempts: {}, // mapping socket id to number of attempts
  timer: null,
};

const GAME_DURATION = 60000; // 60 seconds

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);
  
  // A client joins the session by providing a username and if they are Game Master
  socket.on('joinSession', (data) => {
    // data: { username, isGameMaster }
    if (gameSession.inProgress) {
      socket.emit('sessionError', 'Game already in progress. Cannot join now.');
      return;
    }
    if (data.isGameMaster) {
      if (gameSession.gameMasterId) {
        socket.emit('sessionError', 'A game master is already defined.');
        return;
      }
      gameSession.gameMasterId = socket.id;
    }
    gameSession.players[socket.id] = { username: data.username, score: 0 };
    io.emit('updatePlayers', Object.values(gameSession.players));
  });

  // The Game Master sets the question and answer for the session.
  socket.on('setQuestion', (data) => {
    if (socket.id !== gameSession.gameMasterId) {
      socket.emit('sessionError', 'Only game master can set the question.');
      return;
    }
    // data: { question, answer }
    gameSession.question = data.question;
    gameSession.answer = data.answer.toLowerCase();
    // Reset guess attempts for all players.
    gameSession.guessAttempts = {};
    io.emit('questionSet', { question: gameSession.question });
  });
  
  // The Game Master starts the game session.
  socket.on('startGame', () => {
    if (socket.id !== gameSession.gameMasterId) {
      socket.emit('sessionError', 'Only game master can start the game.');
      return;
    }
    // Ensure there are more than two players (game master + at least 2 players).
    if (Object.keys(gameSession.players).length < 3) {
      socket.emit('sessionError', 'Need at least 3 players to start the game.');
      return;
    }
    gameSession.inProgress = true;
    io.emit('gameStarted', { question: gameSession.question });
    // Set a timer for the game duration.
    gameSession.timer = setTimeout(() => {
      if (gameSession.inProgress) {
        gameSession.inProgress = false;
        io.emit('gameOver', { message: 'Time expired', answer: gameSession.answer });
      }
    }, GAME_DURATION);
  });

  // Handles a player's guess submission.
  socket.on('submitGuess', (guessData) => {
    if (!gameSession.inProgress) {
      socket.emit('sessionError', 'Game is not in progress.');
      return;
    }
    // guessData: { guess }
    const guess = guessData.guess.toLowerCase();
    // Track the number of guess attempts per player.
    gameSession.guessAttempts[socket.id] = (gameSession.guessAttempts[socket.id] || 0) + 1;
    if (gameSession.guessAttempts[socket.id] > 3) {
      socket.emit('guessResult', { correct: false, message: 'No more attempts allowed.' });
      return;
    }
    
    if (guess === gameSession.answer) {
      // Correct guess: assign 10 points, end game, and notify all players.
      gameSession.players[socket.id].score += 10;
      gameSession.inProgress = false;
      clearTimeout(gameSession.timer);
      io.emit('gameOver', { 
        message: `${gameSession.players[socket.id].username} answered correctly!`, 
        answer: gameSession.answer, 
        winner: gameSession.players[socket.id].username 
      });
    } else {
      socket.emit('guessResult', { correct: false, message: 'Incorrect guess. Try again if you have attempts remaining.' });
    }
  });
  
  // When a client disconnects, update the session.
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    delete gameSession.players[socket.id];
    if (socket.id === gameSession.gameMasterId) {
      // End the session if game master leaves.
      gameSession = {
        gameMasterId: null,
        question: '',
        answer: '',
        inProgress: false,
        players: {},
        guessAttempts: {},
        timer: null,
      };
      io.emit('sessionEnded', 'Game master left. Session ended.');
    } else {
      io.emit('updatePlayers', Object.values(gameSession.players));
      // Delete session when all players have left.
      if (Object.keys(gameSession.players).length === 0) {
        gameSession = {
          gameMasterId: null,
          question: '',
          answer: '',
          inProgress: false,
          players: {},
          guessAttempts: {},
          timer: null,
        };
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
