import { Chess } from './chess.js';

const material = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const enginePath = new URL('./engine/stockfish-19-lite-single.js', import.meta.url);

function startEngine() {
  const worker = new Worker(enginePath);
  let pending;
  let failure;
  let score;
  function fail(error) {
    failure = error;
    pending?.reject(error);
  }
  worker.onerror = () => fail(new Error('Stockfish could not start.'));
  worker.onmessage = ({ data }) => {
    for (const line of String(data).split('\n')) {
      const evaluation = line.match(/\bscore (cp|mate) (-?\d+)/);
      if (evaluation) {
        const value = Number(evaluation[2]);
        score = evaluation[1] === 'cp' ? value : Math.sign(value) * (10_000 - Math.abs(value));
      }
      if (pending && line.startsWith(pending.prefix)) pending.resolve(line);
    }
  };

  function ask(command, prefix) {
    if (failure) return Promise.reject(failure);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => fail(new Error('Stockfish timed out.')), 15_000);
      const finish = callback => value => {
        clearTimeout(timeout);
        pending = null;
        callback(value);
      };
      pending = { prefix, resolve: finish(resolve), reject: finish(reject) };
      worker.postMessage(command);
    });
  }

  return {
    async ready() {
      await ask('uci', 'uciok');
      worker.postMessage('setoption name Hash value 16');
      await ask('isready', 'readyok');
    },
    async evaluate(fen) {
      score = undefined;
      worker.postMessage('position fen ' + fen);
      const line = await ask('go depth 12', 'bestmove ');
      if (score === undefined) throw new Error('Stockfish returned no evaluation.');
      return { score, best: line.split(/\s+/)[1] };
    },
    stop() {
      fail(new Error('Review closed.'));
      worker.terminate();
    },
  };
}

function offeredMaterial(move, reply) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(reply || '') || reply.slice(2, 4) !== move.to) return false;
  const capturedValue = material[move.captured] || 0;
  return (material[move.piece] || 0) - capturedValue >= 2;
}

export function classifyMove(move, before, after) {
  const played = move.from + move.to + (move.promotion || '');
  const loss = played === before.best ? 0 : Math.max(0, before.score + after.score);
  let label;
  if (loss <= 5 && before.score > 150 && offeredMaterial(move, after.best)) label = 'Brilliant';
  else if (loss <= 20 && before.score > 100) label = 'Great';
  else if (loss <= 10) label = 'Best Move';
  else if (loss <= 40) label = 'Good';
  else if (loss < 90) label = 'Inaccuracy';
  else if (loss < 200) label = 'Mistake';
  else label = 'Blunder';
  return { label, best: before.best, loss };
}

export function gradeGame(moves, grades, onGrade, onError) {
  let active = true;
  let engine;
  async function run() {
    try {
      engine = startEngine();
      await engine.ready();
      const firstMissing = grades.findIndex(grade => !grade);
      let before = await engine.evaluate(moves[firstMissing].before);
      for (let index = firstMissing; index < moves.length && active; index++) {
        const move = moves[index];
        const position = new Chess(move.after);
        const after = position.isCheckmate() ? { score: -10_000 }
          : position.isDraw() ? { score: 0 }
          : await engine.evaluate(move.after);
        if (!active) break;
        grades[index] = classifyMove(move, before, after);
        onGrade();
        before = after;
      }
    } catch (error) {
      if (active) onError(error.message);
    } finally {
      engine?.stop();
    }
  }
  if (grades.some(grade => !grade)) run();
  return () => {
    active = false;
    engine?.stop();
  };
}
