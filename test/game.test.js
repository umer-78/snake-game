import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, DIRECTIONS, makeRandom, highScore } from '../src/game.js';

const at = (game, x, y) => game.snake.some((c) => c.x === x && c.y === y);

test('a new game has a snake, food and no score', () => {
  const game = new Game({ width: 20, height: 20, seed: 7 });
  assert.equal(game.snake.length, 3);
  assert.equal(game.score, 0);
  assert.ok(game.food);
  assert.ok(!at(game, game.food.x, game.food.y), 'food must not start under the snake');
  assert.throws(() => new Game({ width: 3, height: 3 }), RangeError);
});

test('the snake moves one cell per step and keeps its length', () => {
  const game = new Game({ seed: 1 });
  const head = { ...game.head };
  game.step();
  assert.deepEqual(game.head, { x: head.x + 1, y: head.y });
  assert.equal(game.snake.length, 3);
});

test('turning works but reversing into itself does not', () => {
  const game = new Game({ seed: 1 });
  assert.equal(game.turn('left'), false, 'cannot reverse');
  assert.equal(game.turn('up'), true);
  game.step();
  assert.equal(game.direction, 'up');
  assert.equal(game.turn('nowhere'), false);
});

test('two turns in one frame are both queued', () => {
  const game = new Game({ seed: 1 });
  game.turn('up');
  game.turn('left');   // legal after the queued "up"
  game.step();
  assert.equal(game.direction, 'up');
  game.step();
  assert.equal(game.direction, 'left');
});

test('eating food grows the snake and scores', () => {
  const game = new Game({ seed: 3 });
  game.food = { x: game.head.x + 1, y: game.head.y };
  game.step();
  assert.equal(game.score, 10);
  assert.equal(game.snake.length, 4);
  assert.ok(game.food, 'new food appears');
});

test('hitting a wall ends the game', () => {
  const game = new Game({ width: 8, height: 8, seed: 2 });
  for (let i = 0; i < 10 && !game.over; i++) game.step();
  assert.ok(game.over);
  assert.equal(game.cause, 'wall');
  const before = game.snake.length;
  game.step();
  assert.equal(game.snake.length, before, 'stepping after the end changes nothing');
});

test('wrap mode comes out the other side instead', () => {
  const game = new Game({ width: 8, height: 8, seed: 2, wrap: true });
  for (let i = 0; i < 7; i++) game.step();
  assert.ok(!game.over);
  assert.ok(game.head.x < 8);
});

test('running into the body ends the game', () => {
  const game = new Game({ width: 10, height: 10, seed: 5, startLength: 5 });
  game.food = null;
  game.turn('up'); game.step();
  game.turn('left'); game.step();
  game.turn('down'); game.step();
  assert.ok(game.over);
  assert.equal(game.cause, 'self');
});

test('the tail cell is free: following your own tail is allowed', () => {
  const game = new Game({ width: 10, height: 10, seed: 5, startLength: 4 });
  game.food = null;
  game.snake = [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 3, y: 5 }, { x: 4, y: 5 }];
  game.direction = 'down';
  game.step();                                  // moves onto the cell the tail is leaving
  assert.ok(!game.over, 'the tail moves away in the same step');
});

test('filling the board wins instead of crashing', () => {
  const game = new Game({ width: 5, height: 5, seed: 1, startLength: 24 });
  game.snake = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) game.snake.push({ x, y });
  game.snake.pop();
  game.food = { x: 4, y: 4 };
  game.snake = game.snake.reverse();
  game.direction = 'right';
  game.snake[0] = { x: 3, y: 4 };
  game.step();
  assert.ok(game.over && game.won);
});

test('the speed increases with the score', () => {
  const game = new Game({ seed: 1 });
  const slow = game.interval;
  game.score = 200;
  assert.ok(game.interval < slow);
  game.score = 100000;
  assert.ok(game.interval >= 60, 'but never becomes unplayable');
});

test('the seeded generator replays the same game', () => {
  const a = makeRandom(42);
  const b = makeRandom(42);
  const first = Array.from({ length: 5 }, a);
  assert.deepEqual(first, Array.from({ length: 5 }, b));
  assert.ok(first.every((v) => v >= 0 && v < 1));
  const one = new Game({ seed: 99 });
  const two = new Game({ seed: 99 });
  assert.deepEqual(one.food, two.food);
});

test('the high score survives broken storage', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  highScore.write(storage, 50);
  assert.equal(highScore.read(storage), 50);
  highScore.write(storage, 20);
  assert.equal(highScore.read(storage), 50, 'a lower score does not overwrite');
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(highScore.read(broken), 0);
  assert.doesNotThrow(() => highScore.write(broken, 10));
});

test('the text view shows the head, body and food', () => {
  const game = new Game({ width: 6, height: 6, seed: 4 });
  const text = game.toString();
  assert.equal(text.split('\n').length, 6);
  assert.ok(text.includes('@') && text.includes('o') && text.includes('*'));
  assert.equal(Object.keys(DIRECTIONS).length, 4);
});
