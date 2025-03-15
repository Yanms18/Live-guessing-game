const { gameSession, getInitialSession, GAME_DURATION } = require('./gameSession');

function assignNewGameMaster(io) {
    const playersIds = Object.keys(gameSession.players);
    if (playersIds.length === 0) {
        // No players left; reset the session.
        Object.assign(gameSession, getInitialSession());
        return;
    }
    // Select a random new game master from the remaining players.
    const randomIndex = Math.floor(Math.random() * playersIds.length);
    const newGameMaster = playersIds[randomIndex];
    gameSession.gameMasterId = newGameMaster;
    // Notify only the new game master.
    io.to(newGameMaster).emit('becomeGameMaster');
    // Update all connected clients.
    io.emit('updatePlayers', Object.values(gameSession.players));
}

module.exports = function(io) {
    io.on('connection', (socket) => {
        console.log('New client connected', socket.id);

        socket.on('joinSession', (data) => {
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

        socket.on('setQuestion', (data) => {
            if (socket.id !== gameSession.gameMasterId) {
                socket.emit('sessionError', 'Only game master can set the question.');
                return;
            }
            gameSession.question = data.question;
            gameSession.answer = data.answer.toLowerCase();
            gameSession.guessAttempts = {};
            io.emit('questionSet', { question: gameSession.question });
        });

        socket.on('startGame', () => {
            if (socket.id !== gameSession.gameMasterId) {
                socket.emit('sessionError', 'Only game master can start the game.');
                return;
            }
            if (Object.keys(gameSession.players).length < 3) {
                socket.emit('sessionError', 'Need at least 3 players to start the game.');
                return;
            }
            gameSession.inProgress = true;
            io.emit('gameStarted', { question: gameSession.question });
            gameSession.timer = setTimeout(() => {
                if (gameSession.inProgress) {
                    gameSession.inProgress = false;
                    io.emit('gameOver', { message: 'Time expired', answer: gameSession.answer });
                    // Reassign game master after the round ends.
                    assignNewGameMaster(io);
                }
            }, GAME_DURATION);
        });

        socket.on('submitGuess', (guessData) => {
            if (!gameSession.inProgress) {
                socket.emit('sessionError', 'Game is not in progress.');
                return;
            }
            const guess = guessData.guess.toLowerCase();
            gameSession.guessAttempts[socket.id] = (gameSession.guessAttempts[socket.id] || 0) + 1;
            if (gameSession.guessAttempts[socket.id] > 3) {
                socket.emit('guessResult', { correct: false, message: 'No more attempts allowed.' });
                return;
            }
            if (guess === gameSession.answer) {
                gameSession.players[socket.id].score += 10;
                gameSession.inProgress = false;
                clearTimeout(gameSession.timer);
                io.emit('gameOver', { 
                    message: `${gameSession.players[socket.id].username} answered correctly!`, 
                    answer: gameSession.answer, 
                    winner: gameSession.players[socket.id].username 
                });
                // Reassign game master after the round ends.
                assignNewGameMaster(io);
            } else {
                socket.emit('guessResult', { correct: false, message: 'Incorrect guess. Try again if you have attempts remaining.' });
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected', socket.id);
            delete gameSession.players[socket.id];
            if (socket.id === gameSession.gameMasterId) {
                // If game master disconnects and players remain, reassign a new game master.
                if (Object.keys(gameSession.players).length > 0) {
                    assignNewGameMaster(io);
                    io.emit('sessionEnded', 'Game master left. A new game master has been assigned.');
                } else {
                    Object.assign(gameSession, getInitialSession());
                    io.emit('sessionEnded', 'Game master left. Session ended.');
                }
            } else {
                io.emit('updatePlayers', Object.values(gameSession.players));
                if (Object.keys(gameSession.players).length === 0) {
                    Object.assign(gameSession, getInitialSession());
                }
            }
        });
    });
};