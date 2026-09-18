import { Game, highScore } from './game.js';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

let game = new Game({ width: 24, height: 24, seed: Date.now() % 100000 });
let timer = null;
let paused = false;

const css = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();

function draw() {
  const cell = canvas.width / game.width;
  ctx.fillStyle = css('--surface');
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = css('--border');
  ctx.lineWidth = 1;
  for (let i = 1; i < game.width; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height);
    ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell);
    ctx.stroke();
  }

  if (game.food) {
    ctx.fillStyle = css('--food');
    ctx.beginPath();
    ctx.arc((game.food.x + 0.5) * cell, (game.food.y + 0.5) * cell, cell * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  game.snake.forEach((segment, i) => {
    ctx.fillStyle = i === 0 ? css('--accent') : css('--accent');
    ctx.globalAlpha = i === 0 ? 1 : Math.max(0.35, 1 - i / (game.snake.length + 4));
    const pad = i === 0 ? 1 : 2;
    ctx.fillRect(segment.x * cell + pad, segment.y * cell + pad, cell - pad * 2, cell - pad * 2);
  });
  ctx.globalAlpha = 1;

  $('score').textContent = game.score;
  $('length').textContent = game.snake.length;
  $('best').textContent = highScore.read(window.localStorage);
}

function tick() {
  game.step();
  draw();
  if (game.over) {
    stop();
    highScore.write(window.localStorage, game.score);
    $('best').textContent = highScore.read(window.localStorage);
    show(game.won ? 'You filled the board!' : `Game over — ${game.cause === 'wall' ? 'hit the wall' : 'hit yourself'}`);
    return;
  }
  timer = setTimeout(tick, game.interval);
}

function start() {
  stop();
  hide();
  paused = false;
  timer = setTimeout(tick, game.interval);
}

function stop() {
  clearTimeout(timer);
  timer = null;
}

const show = (text) => { $('overlayText').textContent = text; $('overlay').hidden = false; };
const hide = () => { $('overlay').hidden = true; };

function restart() {
  game = new Game({ width: 24, height: 24, seed: Date.now() % 100000, wrap: $('wrap').checked });
  draw();
  start();
}

// Space does the obvious thing in every state: start, pause, resume, or start
// a new game once this one is over.
function togglePause() {
  if (game.over) { restart(); return; }
  if (!timer) {            // not running: start or resume
    paused = false;
    hide();
    timer = setTimeout(tick, game.interval);
    return;
  }
  paused = true;
  stop();
  show('Paused');
}

const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); togglePause(); return; }
  const direction = KEYS[e.key] || KEYS[e.key.toLowerCase?.()];
  if (!direction) return;
  e.preventDefault();          // stop the page scrolling under the board
  game.turn(direction);
});

document.querySelectorAll('.pad button').forEach((button) => {
  button.addEventListener('click', () => game.turn(button.dataset.dir));
});

let touchStart = null;
canvas.addEventListener('pointerdown', (e) => { touchStart = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!touchStart) return;
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) { togglePause(); return; }
  game.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

$('restart').addEventListener('click', restart);
$('wrap').addEventListener('change', restart);
$('overlay').addEventListener('click', togglePause);
document.addEventListener('visibilitychange', () => { if (document.hidden && timer) togglePause(); });

draw();
show('Snake');
