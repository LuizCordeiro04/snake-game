const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const arenaNumberEl = document.getElementById("arenaNumber");
const bestScoreEl = document.getElementById("bestScore");
const menuBestScoreEl = document.getElementById("menuBestScore");
const finalScoreEl = document.getElementById("finalScore");
const finalBestScoreEl = document.getElementById("finalBestScore");

const menuScreen = document.getElementById("menuScreen");
const pauseScreen = document.getElementById("pauseScreen");
const gameOverScreen = document.getElementById("gameOverScreen");

const playButton = document.getElementById("playButton");
const touchPauseButton = document.getElementById("touchPauseButton");
const continueButton = document.getElementById("continueButton");
const restartPauseButton = document.getElementById("restartPauseButton");
const menuPauseButton = document.getElementById("menuPauseButton");
const playAgainButton = document.getElementById("playAgainButton");
const menuGameOverButton = document.getElementById("menuGameOverButton");

const arenaThresholds = [3, 35, 50, 70, 95, 125];
const arenaGridSizes = [12, 14, 16, 18, 20, 22];
const highScoreKey = "snakeArenaHighScore";
const swipeThreshold = 18;
const maxQueuedDirections = 3;

let arenaIndex = 0;
let arenaTransition = null;
let gridSize = arenaGridSizes[0];
let cellSize = canvas.width / gridSize;
let boardOffset = 0;
let snake;
let food;
let goldenFood;
let goldenSpawnsAt = 0;
let goldenExpiresAt = 0;
let goldenFlash;
let gameTime = 0;
let lastFrameAt = 0;
let foodsEaten = 0;
let direction;
let directionQueue = [];
let touchGesture = null;
let score;
let highScore = Number(localStorage.getItem(highScoreKey)) || 0;
let state = "menu";
let lastStepAt = 0;
let stepDelay = 150;
let animationFrameId = 0;
let audioContext;

function playTone(frequency, duration, delay = 0, type = "sine", volume = 0.055) {
  if (!audioContext) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const start = audioContext.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function enableAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  audioContext ||= new AudioContextClass();
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playEatSound() {
  playTone(660, 0.09, 0, "square", 0.025);
  playTone(880, 0.12, 0.07, "sine");
}

function playGoldenSound() {
  [740, 988, 1480].forEach((note, index) => playTone(note, 0.18, index * 0.075, "sine", 0.045));
}

function playMilestoneSound() {
  [523, 659, 784, 1047].forEach((note, index) => playTone(note, 0.16, index * 0.1));
}

function playDeathSound() {
  [330, 247, 165].forEach((note, index) => playTone(note, 0.22, index * 0.12, "triangle"));
}

function showScreen(screen) {
  [menuScreen, pauseScreen, gameOverScreen].forEach((item) => item.classList.remove("is-visible"));
  if (screen) {
    screen.classList.add("is-visible");
  }
  document.documentElement.classList.toggle("game-active", state === "playing");
  document.body.classList.toggle("game-active", state === "playing");
}

function updateScores() {
  scoreEl.textContent = score;
  arenaNumberEl.textContent = arenaIndex + 1;
  bestScoreEl.textContent = highScore;
  menuBestScoreEl.textContent = highScore;
  finalScoreEl.textContent = score;
  finalBestScoreEl.textContent = highScore;
}

function drawRoundedCell(x, y, color, inset = 2) {
  const px = boardOffset + x * cellSize + inset;
  const py = boardOffset + y * cellSize + inset;
  const size = cellSize - inset * 2;
  const radius = 5;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(px, py, size, size, radius);
  ctx.fill();
}

function drawBoard() {
  ctx.fillStyle = "#0a0f0d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boardSize = gridSize * cellSize;
  ctx.fillStyle = "#101913";
  ctx.fillRect(boardOffset, boardOffset, boardSize, boardSize);

  ctx.strokeStyle = "#1b281e";
  ctx.lineWidth = 1;

  for (let i = 1; i < gridSize; i += 1) {
    const position = boardOffset + i * cellSize;
    ctx.beginPath();
    ctx.moveTo(position, boardOffset);
    ctx.lineTo(position, boardOffset + boardSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(boardOffset, position);
    ctx.lineTo(boardOffset + boardSize, position);
    ctx.stroke();
  }

  const elapsed = arenaTransition ? gameTime - arenaTransition.start : 500;
  const progress = Math.min(1, elapsed / 500);
  const inset = arenaTransition ? arenaTransition.inset * (1 - progress) : 0;
  if (inset > 0) {
    ctx.fillStyle = `rgba(10, 15, 13, ${(1 - progress) * 0.8})`;
    ctx.fillRect(0, 0, canvas.width, inset);
    ctx.fillRect(0, canvas.height - inset, canvas.width, inset);
    ctx.fillRect(0, inset, inset, canvas.height - inset * 2);
    ctx.fillRect(canvas.width - inset, inset, inset, canvas.height - inset * 2);
  }

  ctx.strokeStyle = "#3b5140";
  ctx.lineWidth = 2;
  ctx.strokeRect(inset + 1, inset + 1, canvas.width - inset * 2 - 2, canvas.height - inset * 2 - 2);
}

function drawFood(timestamp = 0) {
  if (!food) {
    return;
  }

  const pulse = Math.sin(timestamp / 160) * 1.5;
  const centerX = boardOffset + food.x * cellSize + cellSize / 2;
  const centerY = boardOffset + food.y * cellSize + cellSize / 2;
  const radius = cellSize * 0.34 + pulse;

  ctx.fillStyle = "#ff5964";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.arc(centerX - 3, centerY - 4, radius * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawGoldenFood() {
  if (!goldenFood) {
    return;
  }

  const remaining = goldenExpiresAt - gameTime;
  const pulse = Math.sin(gameTime / 130) * 1.2;
  const blink = remaining < 800 ? 0.65 + Math.sin(gameTime / 65) * 0.35 : 1;
  const centerX = boardOffset + goldenFood.x * cellSize + cellSize / 2;
  const centerY = boardOffset + goldenFood.y * cellSize + cellSize / 2;

  ctx.save();
  ctx.globalAlpha = blink;
  ctx.shadowColor = "#ffd663";
  ctx.shadowBlur = 10 + pulse * 2;
  ctx.fillStyle = "#ffca45";
  ctx.beginPath();
  ctx.arc(centerX, centerY, cellSize * 0.32 + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGoldenFlash() {
  if (!goldenFlash || gameTime >= goldenFlash.until) {
    return;
  }

  const progress = (goldenFlash.until - gameTime) / 350;
  const centerX = boardOffset + goldenFlash.x * cellSize + cellSize / 2;
  const centerY = boardOffset + goldenFlash.y * cellSize + cellSize / 2;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 213, 94, ${progress * 0.8})`;
  ctx.lineWidth = 2;
  ctx.shadowColor = "#ffca45";
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(centerX, centerY, cellSize * (0.4 + (1 - progress) * 0.5), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSnake() {
  snake.forEach((part, index) => {
    drawRoundedCell(part.x, part.y, index === 0 ? "#c7ff89" : "#8ee36d", index === 0 ? 1.5 : 2.5);
  });
}

function drawArenaNotice() {
  if (!arenaTransition) {
    return;
  }

  const elapsed = gameTime - arenaTransition.start;
  if (elapsed >= 1000) {
    arenaTransition = null;
    return;
  }

  const opacity = Math.min(1, elapsed / 150, (1000 - elapsed) / 300);
  ctx.save();
  ctx.fillStyle = `rgba(237, 246, 238, ${opacity * 0.9})`;
  ctx.shadowColor = "#0a0f0d";
  ctx.shadowBlur = 8;
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`ARENA ${arenaIndex + 1}`, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

function render(timestamp) {
  drawBoard();
  drawFood(timestamp);
  drawGoldenFood();
  drawSnake();
  drawGoldenFlash();
  drawArenaNotice();
}

function isSamePosition(a, b) {
  return a.x === b.x && a.y === b.y;
}

function randomFood(excluded = []) {
  const freeCells = [];

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if (!snake.some((part) => part.x === x && part.y === y) &&
          !excluded.some((item) => item && item.x === x && item.y === y)) {
        freeCells.push({ x, y });
      }
    }
  }

  if (!freeCells.length) {
    return null;
  }

  return freeCells[Math.floor(Math.random() * freeCells.length)];
}

function scheduleGoldenFood() {
  goldenSpawnsAt = gameTime + 7000 + Math.random() * 6000;
}

function updateGoldenFood() {
  if (goldenFood && gameTime >= goldenExpiresAt) {
    goldenFood = null;
    scheduleGoldenFood();
  } else if (!goldenFood && gameTime >= goldenSpawnsAt) {
    goldenFood = randomFood([food]);
    if (goldenFood) {
      goldenExpiresAt = gameTime + 3000;
    } else {
      scheduleGoldenFood();
    }
  }
}

function calculateStepDelay() {
  const earlyScore = Math.min(score, 250);
  const laterScore = Math.max(0, score - 250);
  return Math.max(68, 150 - earlyScore * 0.18 - arenaIndex * 5 - laterScore * 0.03);
}

function expandArena() {
  const previousSize = gridSize;
  arenaIndex += 1;
  gridSize = arenaGridSizes[arenaIndex];
  cellSize = canvas.width / gridSize;
  const shift = (gridSize - previousSize) / 2;

  snake.forEach((part) => {
    part.x += shift;
    part.y += shift;
  });
  [food, goldenFood, goldenFlash].forEach((item) => {
    if (item) {
      item.x += shift;
      item.y += shift;
    }
  });

  arenaTransition = { start: gameTime, inset: shift * cellSize };
  updateScores();
}

function updateArena() {
  while (arenaIndex < arenaThresholds.length - 1 && snake.length >= arenaThresholds[arenaIndex + 1]) {
    expandArena();
  }
}

function resetGame() {
  arenaIndex = 0;
  arenaTransition = null;
  gridSize = arenaGridSizes[0];
  cellSize = canvas.width / gridSize;
  boardOffset = 0;
  const center = Math.floor(gridSize / 2);

  snake = [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];
  direction = { x: 1, y: 0 };
  directionQueue = [];
  touchGesture = null;
  score = 0;
  foodsEaten = 0;
  stepDelay = 150;
  food = randomFood();
  goldenFood = null;
  goldenFlash = null;
  gameTime = 0;
  lastFrameAt = 0;
  scheduleGoldenFood();
  lastStepAt = 0;
  updateScores();
}

function startGame() {
  enableAudio();
  resetGame();
  state = "playing";
  showScreen(null);
}

function pauseGame() {
  if (state !== "playing") {
    return;
  }

  state = "paused";
  showScreen(pauseScreen);
}

function resumeGame() {
  if (state !== "paused") {
    return;
  }

  state = "playing";
  lastFrameAt = 0;
  lastStepAt = 0;
  showScreen(null);
}

function returnToMenu() {
  state = "menu";
  showScreen(menuScreen);
  resetGame();
  render(0);
}

function endGame() {
  state = "gameover";
  goldenFood = null;
  playDeathSound();

  if (score > highScore) {
    highScore = score;
    localStorage.setItem(highScoreKey, String(highScore));
  }

  updateScores();
  showScreen(gameOverScreen);
}

function canChangeDirection(newDirection, currentDirection = direction) {
  return currentDirection.x + newDirection.x !== 0 || currentDirection.y + newDirection.y !== 0;
}

function queueDirection(newDirection) {
  const lastDirection = directionQueue[directionQueue.length - 1] || direction;
  if (state !== "playing" || directionQueue.length >= maxQueuedDirections ||
      !canChangeDirection(newDirection, lastDirection) ||
      (newDirection.x === lastDirection.x && newDirection.y === lastDirection.y)) {
    return false;
  }

  directionQueue.push(newDirection);
  return true;
}

function step() {
  direction = directionQueue.shift() || direction;

  const head = snake[0];
  const nextHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  const hitWall = nextHead.x < 0 || nextHead.x >= gridSize || nextHead.y < 0 || nextHead.y >= gridSize;
  const bodyToCheck = snake.slice(0, -1);
  const hitBody = bodyToCheck.some((part) => isSamePosition(part, nextHead));

  if (hitWall || hitBody) {
    endGame();
    return;
  }

  snake.unshift(nextHead);

  if (food && isSamePosition(nextHead, food)) {
    score += 1;
    foodsEaten += 1;
    updateArena();
    stepDelay = calculateStepDelay();
    playEatSound();
    if (foodsEaten % 10 === 0) {
      playMilestoneSound();
    }
    food = randomFood([goldenFood]);
    updateScores();
  } else if (goldenFood && isSamePosition(nextHead, goldenFood)) {
    score += 3;
    foodsEaten += 1;
    goldenFlash = { ...goldenFood, until: gameTime + 350 };
    goldenFood = null;
    updateArena();
    stepDelay = calculateStepDelay();
    scheduleGoldenFood();
    playGoldenSound();
    if (foodsEaten % 10 === 0) {
      playMilestoneSound();
    }
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(highScoreKey, String(highScore));
    }
    updateScores();
  } else {
    snake.pop();
  }
}

function loop(timestamp) {
  if (state === "playing") {
    if (lastFrameAt) {
      gameTime += timestamp - lastFrameAt;
    }
    lastFrameAt = timestamp;
    updateGoldenFood();
    if (!lastStepAt || timestamp - lastStepAt >= stepDelay) {
      step();
      lastStepAt = timestamp;
    }
  }

  render(timestamp);
  animationFrameId = requestAnimationFrame(loop);
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();

  if (key === "escape") {
    if (state === "playing") {
      pauseGame();
    } else if (state === "paused") {
      resumeGame();
    }
    return;
  }

  const directions = {
    arrowup: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 },
    d: { x: 1, y: 0 },
  };

  if (directions[key]) {
    event.preventDefault();
    queueDirection(directions[key]);
  }
}

function findTouch(touches, identifier) {
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches[index];
    if (touch.identifier === identifier) {
      return touch;
    }
  }
  return null;
}

function readSwipe(touch) {
  const deltaX = touch.clientX - touchGesture.x;
  const deltaY = touch.clientY - touchGesture.y;
  const horizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
  const vertical = Math.abs(deltaY) > Math.abs(deltaX) * 1.2;
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < swipeThreshold || (!horizontal && !vertical)) {
    return false;
  }

  const newDirection = horizontal
    ? { x: Math.sign(deltaX), y: 0 }
    : { x: 0, y: Math.sign(deltaY) };
  touchGesture.x = touch.clientX;
  touchGesture.y = touch.clientY;

  if (queueDirection(newDirection) && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(8);
    } catch (_) {
      // Haptics are optional and may be blocked by the browser.
    }
  }
  return true;
}

function handleTouchStart(event) {
  if (state !== "playing" || event.touches.length !== 1 || event.target.closest?.("button")) {
    touchGesture = null;
    return;
  }

  const touch = event.changedTouches[0];
  touchGesture = { identifier: touch.identifier, x: touch.clientX, y: touch.clientY };
}

function handleTouchMove(event) {
  if (state !== "playing" || !touchGesture) {
    return;
  }

  event.preventDefault();
  const touch = findTouch(event.changedTouches, touchGesture.identifier);
  if (touch) {
    readSwipe(touch);
  }
}

function handleTouchEnd(event) {
  if (!touchGesture) {
    return;
  }

  const touch = findTouch(event.changedTouches, touchGesture.identifier);
  if (touch) {
    if (state === "playing" && readSwipe(touch)) {
      event.preventDefault();
    }
    touchGesture = null;
  }
}

playButton.addEventListener("click", startGame);
touchPauseButton.addEventListener("click", pauseGame);
continueButton.addEventListener("click", resumeGame);
restartPauseButton.addEventListener("click", startGame);
menuPauseButton.addEventListener("click", returnToMenu);
playAgainButton.addEventListener("click", startGame);
menuGameOverButton.addEventListener("click", returnToMenu);
document.addEventListener("keydown", handleKeydown);
document.addEventListener("touchstart", handleTouchStart, { passive: true });
document.addEventListener("touchmove", handleTouchMove, { passive: false });
document.addEventListener("touchend", handleTouchEnd, { passive: false });
document.addEventListener("touchcancel", () => { touchGesture = null; });

resetGame();
render(0);
updateScores();
cancelAnimationFrame(animationFrameId);
animationFrameId = requestAnimationFrame(loop);
