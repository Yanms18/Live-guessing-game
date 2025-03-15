const GAME_DURATION = 60000;

function getInitialSession() {
    return {
        gameMasterId: null,
        question: '',
        answer: '',
        inProgress: false,
        players: {},
        guessAttempts: {},
        timer: null,
    };
}

let gameSession = getInitialSession();

module.exports = { gameSession, getInitialSession, GAME_DURATION };