const socket = io();

const loginDiv = document.getElementById('login');
const gameDiv = document.getElementById('game');
const joinBtn = document.getElementById('joinBtn');
const usernameInput = document.getElementById('username');
const isGameMasterCheckbox = document.getElementById('isGameMaster');

const playersCountSpan = document.getElementById('playerCount');
const messagesDiv = document.getElementById('messages');
const gmControls = document.getElementById('gmControls');
const guessControls = document.getElementById('guessControls');
const questionInput = document.getElementById('questionInput');
const answerInput = document.getElementById('answerInput');
const setQuestionBtn = document.getElementById('setQuestionBtn');
const startGameBtn = document.getElementById('startGameBtn');
const guessInput = document.getElementById('guessInput');
const submitGuessBtn = document.getElementById('submitGuessBtn');
const scoresList = document.getElementById('scores');

joinBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (!username) {
    alert('Please enter a username.');
    return;
  }
  const isGameMaster = isGameMasterCheckbox.checked;
  socket.emit('joinSession', { username, isGameMaster });
  
  loginDiv.style.display = 'none';
  gameDiv.style.display = 'block';
  
  if (isGameMaster) {
    gmControls.style.display = 'block';
  } else {
    guessControls.style.display = 'block';
  }
});

setQuestionBtn.addEventListener('click', () => {
  const question = questionInput.value.trim();
  const answer = answerInput.value.trim();
  if (!question || !answer) {
    alert('Both question and answer are required.');
    return;
  }
  socket.emit('setQuestion', { question, answer });
  appendMessage('Question set by Game Master.');
});

startGameBtn.addEventListener('click', () => {
  socket.emit('startGame');
});

submitGuessBtn.addEventListener('click', () => {
  const guess = guessInput.value.trim();
  if (!guess) {
    alert('Enter a guess.');
    return;
  }
  socket.emit('submitGuess', { guess });
  guessInput.value = '';
});

// Socket event listeners

socket.on('updatePlayers', (players) => {
  playersCountSpan.innerText = players.length;
  scoresList.innerHTML = '';
  players.forEach(player => {
    const li = document.createElement('li');
    li.textContent = `${player.username}: ${player.score} points`;
    scoresList.appendChild(li);
  });
});

socket.on('sessionError', (error) => {
  alert(error);
});

socket.on('questionSet', (data) => {
  appendMessage(`Question: ${data.question}`);
});

socket.on('gameStarted', (data) => {
  appendMessage(`Game Started! Question: ${data.question}`);
  // Only show guessing controls for players once the game starts.
  gmControls.style.display = 'none';
  guessControls.style.display = 'block';
});

socket.on('guessResult', (data) => {
  appendMessage(data.message);
});

socket.on('gameOver', (data) => {
  appendMessage(`Game Over! ${data.message}. The answer was: ${data.answer}`);
  guessControls.style.display = 'none';
});

socket.on('sessionEnded', (message) => {
  appendMessage(message);
  // Optionally reset UI here.
});

function appendMessage(message) {
  const p = document.createElement('p');
  p.textContent = message;
  messagesDiv.appendChild(p);
}
