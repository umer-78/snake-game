// The rules of Snake, with no canvas and no DOM, so they can be tested.
//
// The board is a grid. The snake is a list of cells, head first. Each step the
// head moves one cell in the current direction; the tail is dropped unless food
// was eaten. The game ends when the head leaves the board or meets the body.

export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** A small seeded generator, so a game can be replayed exactly in a test. */
export function makeRandom(seed = 1) {
  let state = seed >>> 0 || 1;
  return () => {
    // xorshift32
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    return state / 0x100000000;
  };
}

export class Game {
  constructor({ width = 20, height = 20, seed = 1, startLength = 3, wrap = false } = {}) {
    if (width < 5 || height < 5) throw new RangeError('the board must be at least 5x5');
    this.width = width;
    this.height = height;
    this.wrap = wrap;
    this.random = makeRandom(seed);
    const y = Math.floor(height / 2);
    const x = Math.floor(width / 4);
    this.snake = Array.from({ length: startLength }, (_, i) => ({ x: x - i, y }));
    this.direction = 'right';
    this.queued = [];
    this.score = 0;
    this.over = false;
    this.won = false;
    this.steps = 0;
    this.food = this.placeFood();
  }

  get head() { return this.snake[0]; }

  /** A free cell for food. Picking from the free list means the search cannot
   *  spin for ever when the snake fills most of the board. */
  placeFood() {
    const taken = new Set(this.snake.map((c) => `${c.x},${c.y}`));
    const free = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!taken.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    if (!free.length) return null;
    return free[Math.floor(this.random() * free.length)];
  }

  /** Queue a turn. Reversing into your own neck is ignored, and turns are
   *  queued so two quick presses in one frame both count. */
  turn(direction) {
    if (!DIRECTIONS[direction]) return false;
    const last = this.queued.at(-1) ?? this.direction;
    if (direction === last || direction === OPPOSITE[last]) return false;
    if (this.queued.length < 2) this.queued.push(direction);
    return true;
  }

  step() {
    if (this.over) return this;
    if (this.queued.length) this.direction = this.queued.shift();
    const move = DIRECTIONS[this.direction];
    let next = { x: this.head.x + move.x, y: this.head.y + move.y };

    if (this.wrap) {
      next = { x: (next.x + this.width) % this.width, y: (next.y + this.height) % this.height };
    } else if (next.x < 0 || next.y < 0 || next.x >= this.width || next.y >= this.height) {
      this.over = true;
      this.cause = 'wall';
      return this;
    }

    const eating = this.food && next.x === this.food.x && next.y === this.food.y;
    // The tail cell is free by the time the head arrives, unless the snake grows.
    const body = eating ? this.snake : this.snake.slice(0, -1);
    if (body.some((cell) => cell.x === next.x && cell.y === next.y)) {
      this.over = true;
      this.cause = 'self';
      return this;
    }

    this.snake.unshift(next);
    if (eating) {
      this.score += 10;
      this.food = this.placeFood();
      if (!this.food) {
        this.over = true;
        this.won = true;
        this.cause = 'board full';
      }
    } else {
      this.snake.pop();
    }
    this.steps++;
    return this;
  }

  /** Milliseconds between steps: the game speeds up as the snake grows. */
  get interval() {
    return Math.max(60, 150 - Math.floor(this.score / 50) * 10);
  }

  toString() {
    const grid = Array.from({ length: this.height }, () => Array(this.width).fill('.'));
    if (this.food) grid[this.food.y][this.food.x] = '*';
    this.snake.forEach((cell, i) => { grid[cell.y][cell.x] = i === 0 ? '@' : 'o'; });
    return grid.map((row) => row.join('')).join('\n');
  }
}

/** Persist the best score without letting a broken storage break the game. */
export const highScore = {
  read(storage) {
    try { return Number(storage?.getItem('snake:best') || 0); } catch { return 0; }
  },
  write(storage, score) {
    try {
      if (score > this.read(storage)) storage?.setItem('snake:best', String(score));
    } catch { /* private mode: not worth breaking the game over */ }
    return score;
  },
};
