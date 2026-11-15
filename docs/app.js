import { Chess } from './chess.js';
import { createGameReview } from './review.js';

const game = new Chess();
const names = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const colorName = color => color === 'w' ? 'White' : 'Black';
const get = id => document.getElementById(id);
const board = get('board');
const promotion = get('promotion');
const restart = get('restart');
let selected = null;
let pending = null;
let flipped = false;
const resultDialog = get('result-dialog');
const review = createGameReview();
let outcome = null;
let observedResult = null;
const squares = new Map();

try {
  const saved = JSON.parse(localStorage.getItem('rook-board') || 'null');
  if (saved) {
    game.loadPgn(saved.pgn);
    flipped = Boolean(saved.flipped);
  }
} catch {
  game.reset();
}

function save() {
  try {
    localStorage.setItem('rook-board', JSON.stringify({ pgn: game.pgn(), flipped }));
  } catch {}
}

function artwork(color, type, className = '') {
  const img = document.createElement('img');
  img.src = 'pieces/' + color + type.toUpperCase() + '.svg';
  img.alt = '';
  img.className = className;
  img.draggable = false;
  return img;
}

for (const file of 'abcdefgh') {
  for (const rank of '12345678') {
    const square = file + rank;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.square = square;
    button.addEventListener('click', () => choose(square));
    button.addEventListener('keydown', event => {
      const shifts = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 };
      const shift = shifts[event.key];
      if (!shift) return;
      event.preventDefault();
      const index = Array.prototype.indexOf.call(board.children, button);
      if ((shift === -1 && index % 8 === 0) || (shift === 1 && index % 8 === 7)) return;
      board.children[index + shift]?.focus();
    });
    squares.set(square, button);
  }
}

function orient() {
  const files = flipped ? 'hgfedcba' : 'abcdefgh';
  const ranks = flipped ? '12345678' : '87654321';
  for (const rank of ranks) {
    for (const file of files) board.append(squares.get(file + rank));
  }
}

function movesFrom(square) {
  return square ? game.moves({ square, verbose: true }) : [];
}

function choose(square) {
  if (game.isGameOver()) return;
  const options = movesFrom(selected).filter(move => move.to === square);
  if (options.some(move => move.promotion)) {
    pending = { from: selected, to: square };
    promotion.returnValue = 'cancel';
    get('choices').replaceChildren(...options.map(move => {
      const choice = document.createElement('button');
      choice.value = move.promotion;
      choice.setAttribute('aria-label', 'Promote to ' + names[move.promotion]);
      choice.append(artwork(game.turn(), move.promotion));
      return choice;
    }));
    promotion.showModal();
    return;
  }
  if (options.length) {
    play({ from: selected, to: square });
    return;
  }
  selected = square !== selected && game.get(square)?.color === game.turn() ? square : null;
  render();
}

function play(move) {
  game.move(move);
  selected = null;
  save();
  render();
  squares.get(move.to).focus({ preventScroll: true });
}

function render() {
  const history = game.history({ verbose: true });
  const last = history.at(-1);
  const turn = game.turn();
  const checked = game.isCheck();
  const ended = game.isGameOver();
  const legal = new Set(movesFrom(selected).map(move => move.to));
  const left = flipped ? 'h' : 'a';
  const bottom = flipped ? '8' : '1';

  for (const [square, button] of squares) {
    const [file, rank] = square;
    const piece = game.get(square);
    button.className = 'square';
    button.classList.toggle('dark', ('abcdefgh'.indexOf(file) + Number(rank)) % 2 === 1);
    button.classList.toggle('last', last?.from === square || last?.to === square);
    button.classList.toggle('selected', square === selected);
    button.classList.toggle('check', checked && piece?.type === 'k' && piece.color === turn);
    button.classList.toggle('legal', legal.has(square));
    button.classList.toggle('occupied', Boolean(piece));
    button.setAttribute('aria-pressed', String(square === selected));
    button.setAttribute('aria-label', [square, piece ? colorName(piece.color) + ' ' + names[piece.type] : 'empty', legal.has(square) ? 'legal destination' : ''].filter(Boolean).join(', '));
    button.replaceChildren();
    if (piece) button.append(artwork(piece.color, piece.type, 'piece'));
    for (const [show, value, label] of [[file === left, rank, 'rank'], [rank === bottom, file, 'file']]) {
      if (!show) continue;
      const mark = document.createElement('span');
      mark.className = 'coord ' + label;
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = value;
      button.append(mark);
    }
  }

  for (const [id, color] of [['top', flipped ? 'w' : 'b'], ['bottom', flipped ? 'b' : 'w']]) {
    const active = document.createElement('span');
    active.textContent = !ended && turn === color ? 'To move' : '';
    get(id).replaceChildren(artwork(color, 'k'), colorName(color), active);
  }

  let title = colorName(turn) + ' to move';
  let detail = checked ? 'King in check' : selected ? 'Choose a highlighted square' : 'Select a piece to see its legal moves';
  if (game.isCheckmate()) {
    title = colorName(turn === 'w' ? 'b' : 'w') + ' wins';
    detail = 'Checkmate';
  } else if (ended) {
    title = 'Draw';
    if (game.isStalemate()) detail = 'Stalemate';
    else if (game.isInsufficientMaterial()) detail = 'Insufficient material';
    else if (game.isThreefoldRepetition()) detail = 'Threefold repetition';
    else detail = 'Fifty-move rule';
  }
  get('status').textContent = title;
  get('detail').textContent = detail;
  get('indicator').classList.toggle('black', (game.isCheckmate() ? turn === 'w' : turn === 'b'));
  get('undo').disabled = !history.length;
  get('count').textContent = Math.ceil(history.length / 2);

  const list = get('moves');
  list.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No moves yet.';
    list.append(empty);
  }
  for (let index = 0; index < history.length; index += 2) {
    const row = document.createElement('div');
    row.className = 'move-row';
    for (const value of [index / 2 + 1 + '.', history[index].san, history[index + 1]?.san || '']) {
      const cell = document.createElement('span');
      cell.textContent = value;
      row.append(cell);
    }
    list.append(row);
  }
  list.scrollTop = list.scrollHeight;
  const winner = game.isCheckmate() ? (turn === 'w' ? 'b' : 'w') : null;
  renderResult(ended, winner, detail, history);
}

function showResult() {
  if (!outcome || document.querySelector('dialog[open]')) return;
  observedResult = outcome.key;
  resultDialog.showModal();
}

function renderResult(ended, winner, detail, moves) {
  if (!ended) {
    outcome = null;
    observedResult = null;
    get('show-result').hidden = true;
    return;
  }
  const title = winner ? colorName(winner) + ' wins' : 'Draw';
  const reason = ({
    Checkmate: 'checkmate',
    Stalemate: 'stalemate',
    'Insufficient material': 'insufficient material',
    'Threefold repetition': 'threefold repetition',
    'Fifty-move rule': 'the fifty-move rule',
  })[detail];
  outcome = {
    key: game.fen(),
    moves, flipped,
    result: winner === 'w' ? '1-0' : winner === 'b' ? '0-1' : '1/2-1/2',
  };
  get('result-title').textContent = title;
  get('result-reason').textContent = reason ? 'By ' + reason + '.' : '';
  get('review-game').disabled = !moves.length;
  get('show-result').hidden = false;
  if (observedResult !== outcome.key) showResult();
}

promotion.addEventListener('close', () => {
  const choice = promotion.returnValue;
  if (pending && ['q', 'r', 'b', 'n'].includes(choice)) play({ ...pending, promotion: choice });
  pending = null;
});
get('undo').addEventListener('click', () => {
  game.undo();
  selected = null;
  save();
  render();
});
get('flip').addEventListener('click', () => {
  flipped = !flipped;
  orient();
  save();
  render();
});
get('new').addEventListener('click', () => {
  if (!game.history().length) return;
  restart.returnValue = 'cancel';
  restart.showModal();
});
restart.addEventListener('close', () => {
  if (restart.returnValue !== 'reset') return;
  game.reset();
  selected = null;
  save();
  render();
});

get('open-tutorial').addEventListener('click', () => get('tutorial').showModal());
get('show-result').addEventListener('click', showResult);
get('tutorial').addEventListener('close', () => {
  if (outcome && observedResult !== outcome.key) showResult();
});
get('again-local').addEventListener('click', () => {
  resultDialog.close();
  game.reset();
  selected = null;
  save();
  render();
});
get('review-game').addEventListener('click', () => {
  if (!outcome?.moves.length) return;
  resultDialog.close();
  review.open(outcome);
});


orient();
render();
