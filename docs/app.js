import { apiBase } from './api.js';
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
let online = null;
let busy = false;
let pollTimer;
let localFlip = false;
let localPgn = '';
const leave = get('leave');
const resultDialog = get('result-dialog');
const review = createGameReview();
let outcome = null;
let observedResult = null;
const onlineKey = 'rook-board-online';
const inviteArgs = new URLSearchParams(location.hash.slice(1));
const squares = new Map();

try {
  const saved = JSON.parse(localStorage.getItem('rook-board') || 'null');
  if (saved) {
    game.loadPgn(saved.pgn);
    flipped = Boolean(saved.flipped);
    localFlip = flipped;
    localPgn = saved.pgn;
  }
} catch {
  game.reset();
}

function save() {
  if (online) return;
  localPgn = game.pgn();
  localFlip = flipped;
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
  if (game.isGameOver() || busy || (online && (!online.ready || online.resigned || game.turn() !== online.color))) return;
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

async function play(move) {
  if (online) {
    await updateOnline('move', { move, version: online.version });
    return;
  }
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
  const ended = game.isGameOver() || Boolean(online?.resigned);
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
    active.textContent = !ended && (!online || online.ready) && turn === color ? 'To move' : '';
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
  if (online && !online.ready) {
    title = online.mode === 'quick' ? 'Finding an opponent' : 'Waiting for your friend';
    detail = online.mode === 'quick' ? 'Keep this tab open to stay in the queue' : 'Send the invite link to start';
  } else if (online?.resigned) {
    title = colorName(online.resigned === 'w' ? 'b' : 'w') + ' wins';
    detail = colorName(online.resigned) + ' resigned';
  }
  get('status').textContent = title;
  get('detail').textContent = detail;
  get('indicator').classList.toggle('black', (game.isCheckmate() ? turn === 'w' : turn === 'b'));
  get('undo').disabled = Boolean(online) || !history.length;
  get('new').hidden = Boolean(online);
  renderOnline(ended);
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
  const winner = online?.resigned ? (online.resigned === 'w' ? 'b' : 'w')
    : game.isCheckmate() ? (turn === 'w' ? 'b' : 'w') : null;
  renderResult(ended, winner, detail, history);
}

function showResult() {
  if (!outcome || busy || document.querySelector('dialog[open]')) return;
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
  const title = !winner ? 'You drawed' : !online ? colorName(winner) + ' wins'
    : online.color === winner ? 'You win' : 'You lost';
  const reason = online?.resigned ? 'resignation' : ({
    Checkmate: 'checkmate',
    Stalemate: 'stalemate',
    'Insufficient material': 'insufficient material',
    'Threefold repetition': 'threefold repetition',
    'Fifty-move rule': 'the fifty-move rule',
  })[detail];
  outcome = {
    key: online ? online.id + ':' + online.version : game.fen(),
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

function errorMessage(message = '') {
  const box = get('online-error');
  box.textContent = message;
  box.hidden = !message;
}

function randomKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}

function sessionRead() {
  try { return JSON.parse(sessionStorage.getItem(onlineKey) || 'null'); }
  catch { return null; }
}

function sessionSave(session) {
  try {
    if (session) sessionStorage.setItem(onlineKey, JSON.stringify(session));
    else sessionStorage.removeItem(onlineKey);
  } catch {}
}

async function request(action, token, data = {}) {
  const response = await fetch(apiBase + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...data }),
    signal: AbortSignal.timeout(8000),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'Online play is temporarily unavailable.');
    error.status = response.status;
    error.game = result.game;
    throw error;
  }
  return result;
}

function renderOnline(ended) {
  const room = get('online-room');
  room.hidden = !online;
  get('online-actions').hidden = Boolean(online);
  get('friend').disabled = busy;
  get('quick').disabled = busy;
  get('mode-label').textContent = online ? (online.mode === 'quick' ? 'Quick match' : 'Friend match') : 'Two players, one board.';
  if (!online) return;
  get('room-info').textContent = 'You play ' + colorName(online.color) + '.';
  get('invite-controls').hidden = !online.invite;
  if (online.invite) {
    get('invite-link').value = location.origin + location.pathname + '#game=' + online.id + '&invite=' + online.invite;
  }
  const exit = get('exit-online');
  exit.disabled = busy;
  exit.textContent = ended ? 'Back to local chess' : online.ready ? 'Resign' : 'Cancel';
}

function applyOnline(state, token) {
  if (online?.id === state.id && (state.version < online.version || (online.ready && !state.ready))) return;
  const entering = !online || online.id !== state.id;
  const changed = entering || online.version !== state.version || online.ready !== state.ready;
  online = { ...state, token };
  sessionSave({ id: state.id, token });
  if (entering) {
    flipped = state.color === 'b';
    orient();
  }
  if (changed) {
    game.reset();
    if (state.pgn) game.loadPgn(state.pgn);
    selected = null;
    render();
  }
}

function resetOnline() {
  clearTimeout(pollTimer);
  online = null;
  sessionSave(null);
  selected = null;
  flipped = localFlip;
  game.reset();
  if (localPgn) game.loadPgn(localPgn);
  orient();
  render();
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (!online || online.resigned || game.isGameOver()) return;
  pollTimer = setTimeout(poll, 1200);
}

async function poll() {
  if (!online) return;
  if (busy) return schedulePoll();
  const { token, id } = online;
  try {
    const result = await request('state', token, { id });
    if (online?.id === id) {
      applyOnline(result, token);
      if (get('online-error').textContent === 'Connection interrupted. Reconnecting…') errorMessage();
    }
  } catch (error) {
    if (online?.id !== id) return;
    if (error.status === 404) {
      resetOnline();
      errorMessage('This match is no longer available.');
      return;
    }
    errorMessage('Connection interrupted. Reconnecting…');
  }
  schedulePoll();
}

async function startOnline(action, token, data) {
  if (busy) return;
  busy = true;
  errorMessage();
  render();
  if (action === 'friend' || action === 'quick' || action === 'join') sessionSave({ action, token, data });
  try {
    const state = await request(action, token, data);
    applyOnline(state, token);
    if (inviteArgs.has('game')) history.replaceState(null, '', location.pathname + location.search);
    schedulePoll();
  } catch (error) {
    if (online) sessionSave({ id: online.id, token: online.token });
    else if (error.status === 404) sessionSave(null);
    errorMessage(error.message || 'Could not connect to online play.');
  } finally {
    busy = false;
    render();
  }
}

async function updateOnline(action, data = {}) {
  if (!online || busy) return;
  const { token, id } = online;
  busy = true;
  errorMessage();
  render();
  try {
    const state = await request(action, token, { id, ...data });
    if (state.canceled) resetOnline();
    else applyOnline(state, token);
  } catch (error) {
    if (error.game) applyOnline(error.game, token);
    errorMessage(error.message || 'Could not connect to online play.');
  } finally {
    busy = false;
    render();
    schedulePoll();
  }
}

for (const action of ['friend', 'quick']) {
  get(action).addEventListener('click', () => {
    const pendingSession = sessionRead();
    startOnline(action, pendingSession?.action === action ? pendingSession.token : randomKey());
  });
}
get('copy-link').addEventListener('click', async () => {
  const link = get('invite-link');
  try {
    await navigator.clipboard.writeText(link.value);
    get('room-info').textContent = 'Invite link copied. You play White.';
  } catch {
    link.focus();
    link.select();
    errorMessage('Copy the selected invite link to share it.');
  }
});
get('exit-online').addEventListener('click', () => {
  if (!online || busy) return;
  if (online.resigned || game.isGameOver()) resetOnline();
  else if (!online.ready) updateOnline('cancel');
  else {
    leave.returnValue = 'cancel';
    leave.showModal();
  }
});
leave.addEventListener('close', () => {
  if (leave.returnValue === 'resign') updateOnline('resign', { version: online.version });
});

get('open-tutorial').addEventListener('click', () => get('tutorial').showModal());
get('show-result').addEventListener('click', showResult);
get('tutorial').addEventListener('close', () => {
  if (outcome && observedResult !== outcome.key) showResult();
});
for (const [id, action] of [['again-quick', 'quick'], ['again-friend', 'friend']]) {
  get(id).addEventListener('click', () => {
    if (!outcome || busy) return;
    resultDialog.close();
    startOnline(action, randomKey());
  });
}
get('review-game').addEventListener('click', () => {
  if (!outcome?.moves.length) return;
  resultDialog.close();
  review.open(outcome);
});


orient();
render();
const savedSession = sessionRead();
const inviteId = inviteArgs.get('game');
if (inviteId && savedSession?.id !== inviteId) {
  const token = savedSession?.action === 'join' && savedSession.data?.id === inviteId ? savedSession.token : randomKey();
  startOnline('join', token, { id: inviteId, invite: inviteArgs.get('invite') });
} else if (savedSession?.id) {
  startOnline('state', savedSession.token, { id: savedSession.id });
} else if (savedSession?.action) {
  startOnline(savedSession.action, savedSession.token, savedSession.data);
}
