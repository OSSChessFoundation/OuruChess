import { apiBase } from './api.js';
import { Chess } from './chess.js';
import { gradeGame } from './grading.js';
import { attachBoardMarks, positionArrow, squareAtIndex } from './board-marks.js';

const $ = id => document.getElementById(id);
const kinds = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export function createGameReview() {
  const dialog = $('review-dialog');
  const arrow = $('review-arrow');
  const report = $('review-link');
  const bestArrow = $('review-best-arrow');
  const bestButton = $('review-best');
  const board = $('review-board');
  const jump = $('review-jump');
  const explore = $('review-explore');
  const marks = attachBoardMarks({
    board, layer: $('review-marks'), toggle: $('draw-review'),
    clearButton: $('clear-review'), flipped: () => flipped,
  });
  let replay;
  let ply = 0;
  let revision = 0;
  let grades = [];
  let stopGrading;
  let gradeKey;
  let showBest = false;
  let analysisError = '';

  let flipped = false;
  let variation = null;
  let selected = null;

  function currentFen() {
    const move = replay.moves[ply - 1];
    return move ? (showBest ? move.before : move.after) : replay.initialFen ?? replay.moves[0].before;
  }

  function reviewLabel(move, index) {
    const turn = move.before.split(' ');
    return turn[5] + (move.color === 'w' ? '. ' : '... ') + move.san
      + (grades[index] ? ' · ' + grades[index].label : '');
  }

  function renderGrade() {
    const move = replay.moves[ply - 1];
    const grade = grades[ply - 1];
    const gradeLabel = $('review-grade');
    gradeLabel.textContent = !move || variation ? '' : grade?.label ?? (analysisError ? 'Grade unavailable' : 'Analyzing this move…');
    gradeLabel.dataset.grade = grade?.label || '';
    const graded = grades.filter(Boolean).length;
    $('review-analysis-status').textContent = !grades.length || variation
      ? '' : analysisError || ('Graded ' + graded + ' of ' + grades.length + ' moves');
    const played = move && move.from + move.to + (move.promotion || '');
    bestButton.hidden = Boolean(variation) || !grade?.best || grade.best === played;
    bestButton.setAttribute('aria-pressed', String(showBest));
    bestButton.textContent = showBest ? 'Show played move' : 'Show best move';
    if (showBest && !bestButton.hidden) {
      bestArrow.hidden = false;
      positionArrow(bestArrow, grade.best.slice(0, 2), grade.best.slice(2, 4), flipped);
    } else {
      bestArrow.hidden = true;
    }
  }

  function render() {
    const move = replay.moves[ply - 1];
    const position = variation || new Chess(currentFen());
    const legal = variation && selected ? new Set(variation.moves({ square: selected, verbose: true }).map(item => item.to)) : new Set();
    const pieces = position.board().flat();
    const order = flipped ? pieces.reverse() : pieces;
    const squares = order.map((piece, index) => {
      const cell = document.createElement(variation ? 'button' : 'div');
      const square = squareAtIndex(index, flipped);
      cell.dataset.square = square;
      cell.className = 'square' + ((index + Math.floor(index / 8)) % 2 ? ' dark' : '');
      cell.classList.toggle('occupied', Boolean(piece));
      cell.classList.toggle('selected', square === selected);
      cell.classList.toggle('legal', legal.has(square));
      if (variation) {
        cell.type = 'button';
        const description = piece ? (piece.color === 'w' ? 'White ' : 'Black ') + kinds[piece.type] : 'empty';
        cell.setAttribute('aria-label', square + ', ' + description);
      }
      if (piece) {
        const image = document.createElement('img');
        image.className = 'piece';
        image.src = 'pieces/' + piece.color + piece.type.toUpperCase() + '.svg';
        image.alt = variation ? '' : (piece.color === 'w' ? 'White ' : 'Black ') + kinds[piece.type] + ' on ' + square;
        cell.append(image);
      }
      return cell;
    });
    board.replaceChildren(...squares);
    marks.render();
    const variationMove = variation?.history({ verbose: true }).at(-1);
    const shownMove = variation ? variationMove : !showBest && move;
    arrow.hidden = !shownMove;
    if (shownMove) positionArrow(arrow, shownMove.from, shownMove.to, flipped);
    $('review-move').textContent = move
      ? (move.color === 'w' ? 'White' : 'Black') + ' played ' + move.san + ' · ' + ply + ' of ' + replay.moves.length
      : 'Starting position';
    if (!variation && showBest) {
      const best = grades[ply - 1].best;
      const alternative = position.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] });
      $('review-move').textContent += ' · Stockfish suggests ' + alternative.san;
    }
    if (variation) {
      const turn = variation.turn() === 'w' ? 'White' : 'Black';
      $('review-move').textContent = variation.isGameOver() ? 'Variation ended'
        : turn + ' to move' + (variation.isCheck() ? ' · Check' : '');
    }
    renderGrade();
    jump.value = String(ply);
    jump.hidden = $('review-jump-label').hidden = !replay.moves.length;
    jump.disabled = Boolean(variation);
    $('review-prev').disabled = Boolean(variation) || ply === 0;
    $('review-next').disabled = Boolean(variation) || ply === replay.moves.length;
    $('review-variation-undo').hidden = $('review-promotion-label').hidden = !variation;
    $('review-variation-undo').disabled = !variationMove;
    explore.hidden = !replay.moves.length;
    explore.textContent = variation ? 'Back to game review' : 'Explore position';
  }

  function goTo(index) {
    ply = index;
    showBest = false;
    marks.clear();
    render();
  }

  function chooseVariation(square) {
    if (!variation || variation.isGameOver()) return;
    const options = selected ? variation.moves({ square: selected, verbose: true }).filter(item => item.to === square) : [];
    if (options.length) {
      const move = options.find(item => !item.promotion || item.promotion === $('review-promotion').value);
      variation.move(move.san);
      selected = null;
    } else {
      selected = selected !== square && variation.get(square)?.color === variation.turn() ? square : null;
    }
    render();
    board.querySelector('[data-square="' + square + '"]')?.focus({ preventScroll: true });
  }

  board.addEventListener('click', event => {
    const square = event.target.closest('[data-square]')?.dataset.square;
    if (square) chooseVariation(square);
  });
  $('review-prev').addEventListener('click', () => goTo(ply - 1));
  $('review-next').addEventListener('click', () => goTo(ply + 1));
  jump.addEventListener('change', () => goTo(Number(jump.value)));
  bestButton.addEventListener('click', () => { showBest = !showBest; render(); });
  $('flip-review').addEventListener('click', () => { flipped = !flipped; render(); });
  explore.addEventListener('click', () => {
    variation = variation ? null : new Chess(currentFen());
    selected = null;
    showBest = false;
    marks.clear();
    render();
  });
  $('review-variation-undo').addEventListener('click', () => {
    variation.undo();
    selected = null;
    render();
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    stopGrading?.();
    replay.onBack?.();
  });
  $('review-submit').addEventListener('click', async () => {
    const current = revision;
    $('review-submit').disabled = true;
    $('review-status').textContent = 'Preparing the Chessigma report…';
    report.hidden = true;
    const game = new Chess(replay.moves[0].before);
    for (const move of replay.moves) game.move(move.san);
    game.setHeader('Result', replay.result);
    const pgn = game.pgn();
    try {
      const response = await fetch(apiBase + 'review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgn }), signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Review unavailable');
      const { url } = await response.json();
      if (current !== revision) return;
      report.href = url;
      report.textContent = 'Open Chessigma report ↗';
      $('review-status').textContent = 'Chessigma grades both players’ moves after the report opens.';
    } catch {
      if (current !== revision) return;
      const fallback = new URL('https://www.chessigma.com/tools/analysis');
      fallback.searchParams.set('pgn', pgn);
      report.href = fallback.href;
      report.textContent = 'Open Chessigma analysis board ↗';
      $('review-status').textContent = 'The full report is unavailable right now. You can still open the game in Chessigma’s analysis board.';
    } finally {
      if (current === revision) {
        report.hidden = false;
        $('review-submit').disabled = false;
      }
    }
  });

  return {
    open(outcome) {
      revision++;
      replay = outcome;
      flipped = Boolean(outcome.flipped);
      selected = null;
      variation = outcome.moves.length ? null : new Chess(outcome.initialFen);
      marks.clear();
      $('review-title').textContent = outcome.study ? 'Analysis Board' : 'Game Review';
      showBest = false;
      analysisError = '';
      const key = outcome.key + ':' + outcome.moves.map(move => move.san).join(' ');
      if (gradeKey !== key) {
        grades = Array.from({ length: outcome.moves.length }, () => null);
        gradeKey = key;
      }
      ply = Math.min(1, outcome.moves.length);
      const options = ['Starting position', ...outcome.moves.map(reviewLabel)].map((label, i) => {
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = label;
        return option;
      });
      jump.replaceChildren(...options);
      const finished = ['1-0', '0-1', '1/2-1/2'].includes(outcome.result) && outcome.moves.length;
      $('review-submit').hidden = !finished;
      $('review-submit').disabled = false;
      $('review-status').textContent = finished ? 'The full report sends this game’s moves to Chessigma.' : '';
      report.hidden = true;
      render();
      dialog.showModal();
      stopGrading = gradeGame(outcome.moves, grades, index => {
        jump.options[index + 1].textContent = reviewLabel(outcome.moves[index], index);
        renderGrade();
      }, message => {
        analysisError = message;
        renderGrade();
      });
    },
  };
}
