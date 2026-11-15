import { Chess } from './chess.js';
import { gradeGame } from './grading.js';

const $ = id => document.getElementById(id);
const kinds = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export function createGameReview() {
  const dialog = $('review-dialog');
  const arrow = $('review-arrow');
  const bestArrow = $('review-best-arrow');
  const bestButton = $('review-best');
  let replay;
  let ply = 0;
  let grades = [];
  let stopGrading;
  let gradeKey;
  let showBest = false;
  let analysisError = '';

  function squareCenter(square) {
    const x = square.charCodeAt(0) - 97;
    const y = 8 - Number(square[1]);
    return replay.flipped ? [7.5 - x, 7.5 - y] : [x + .5, y + .5];
  }

  function drawArrow(element, from, to) {
    const [x, y] = squareCenter(from);
    const [toX, toY] = squareCenter(to);
    const dx = toX - x;
    const dy = toY - y;
    element.style.left = x * 12.5 + '%';
    element.style.top = y * 12.5 + '%';
    element.style.width = Math.hypot(dx, dy) * 12.5 + '%';
    element.style.transform = 'translateY(-50%) rotate(' + Math.atan2(dy, dx) + 'rad)';
  }

  function renderGrade() {
    const move = replay.moves[ply - 1];
    const grade = grades[ply - 1];
    const gradeLabel = $('review-grade');
    gradeLabel.textContent = !move ? '' : grade?.label ?? (analysisError ? 'Grade unavailable' : 'Analyzing this move…');
    gradeLabel.dataset.grade = grade?.label || '';
    const graded = grades.filter(Boolean).length;
    $('review-analysis-status').textContent = analysisError || ('Graded ' + graded + ' of ' + grades.length + ' moves');
    const played = move && move.from + move.to + (move.promotion || '');
    bestButton.hidden = !grade?.best || grade.best === played;
    bestButton.setAttribute('aria-pressed', String(showBest));
    bestButton.textContent = showBest ? 'Show played move' : 'Show best move';
    if (showBest && !bestButton.hidden) {
      bestArrow.hidden = false;
      drawArrow(bestArrow, grade.best.slice(0, 2), grade.best.slice(2, 4));
    } else {
      bestArrow.hidden = true;
    }
  }

  function render() {
    const move = replay.moves[ply - 1];
    const position = new Chess(move ? (showBest ? move.before : move.after) : replay.moves[0].before);
    const pieces = position.board().flat();
    const order = replay.flipped ? pieces.reverse() : pieces;
    const squares = order.map((piece, index) => {
      const cell = document.createElement('div');
      cell.className = 'square' + ((index + Math.floor(index / 8)) % 2 ? ' dark' : '');
      if (piece) {
        const image = document.createElement('img');
        image.className = 'piece';
        image.src = 'pieces/' + piece.color + piece.type.toUpperCase() + '.svg';
        image.alt = (piece.color === 'w' ? 'White ' : 'Black ') + kinds[piece.type] + ' on ' + piece.square;
        cell.append(image);
      }
      return cell;
    });
    $('review-board').replaceChildren(...squares);
    arrow.hidden = !move || showBest;
    if (move && !showBest) drawArrow(arrow, move.from, move.to);
    $('review-move').textContent = move
      ? (move.color === 'w' ? 'White' : 'Black') + ' played ' + move.san + ' · ' + ply + ' of ' + replay.moves.length
      : 'Starting position';
    if (showBest) {
      const best = grades[ply - 1].best;
      const alternative = position.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] });
      $('review-move').textContent += ' · Stockfish suggests ' + alternative.san;
    }
    renderGrade();
    $('review-prev').disabled = ply === 0;
    $('review-next').disabled = ply === replay.moves.length;
  }

  $('review-prev').addEventListener('click', () => { ply--; showBest = false; render(); });
  $('review-next').addEventListener('click', () => { ply++; showBest = false; render(); });
  bestButton.addEventListener('click', () => { showBest = !showBest; render(); });
  dialog.addEventListener('close', () => stopGrading?.());
  return {
    open(outcome) {
      replay = outcome;
      showBest = false;
      analysisError = '';
      const key = outcome.key + ':' + outcome.moves.map(move => move.san).join(' ');
      if (gradeKey !== key) {
        grades = Array.from({ length: outcome.moves.length }, () => null);
        gradeKey = key;
      }
      ply = 1;
      render();
      dialog.showModal();
      stopGrading = gradeGame(outcome.moves, grades, renderGrade, message => {
        analysisError = message;
        renderGrade();
      });
    },
  };
}
