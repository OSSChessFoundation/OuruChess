import { Chess } from './chess.js';
import { pieceSource } from './pieces.js';
const puzzles = [{"id":"back-rank","title":"Close the back rank","theme":"Mate in one","fen":"6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1","solution":["e1e8"],"goal":"mate","explanation":"The rook controls the eighth rank. Black’s own pawns block the king’s escape.","startTurn":"w"},{"id":"fools-mate","title":"The open diagonal","theme":"Mate in one","pgn":"1. f3 e5 2. g4","solution":["d8h4"],"goal":"mate","explanation":"The queen checks along the diagonal to e1. White has no escape or block.","fen":"rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2","startTurn":"b"},{"id":"scholar","title":"Target f7","theme":"Mate in one","pgn":"1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6","solution":["h5f7"],"goal":"mate","explanation":"The bishop on c4 protects the queen on f7 and seals the mate.","fen":"r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4","startTurn":"w"},{"id":"fork","title":"A royal fork","theme":"Knight fork","fen":"3q1k2/8/8/8/3N4/8/8/6K1 w - - 0 1","solution":["d4e6"],"goal":"fork","explanation":"Ne6+ attacks the king on f8 and the queen on d8 at the same time.","startTurn":"w"},{"id":"ladder","title":"Rooks work together","theme":"Mate in one","fen":"7k/R7/8/8/8/8/8/1R4K1 w - - 0 1","solution":["b1b8"],"goal":"mate","explanation":"One rook takes away the seventh rank while the other checks on the eighth.","startTurn":"w"},{"id":"promotion","title":"Make a new queen","theme":"Promotion","fen":"8/P5k1/8/8/8/8/8/6K1 w - - 0 1","solution":["a7a8q"],"goal":"promotion","explanation":"The pawn reaches the eighth rank and promotes to a queen.","startTurn":"w"}];
const $ = id => document.getElementById(id);
export function initPuzzles() {
  let index = 0;
  let game;
  let selected = null;
  let solved = false;
  let gaveUp = false;
  let solvedIds;
  try { solvedIds = new Set(JSON.parse(localStorage.getItem('ouru-puzzle-progress') || '[]')); }
  catch { solvedIds = new Set(); }
  const board = $('puzzle-board');
  function render() {
    const puzzle = puzzles[index];
    const legal = selected ? new Set(game.moves({square:selected, verbose:true}).map(move=>move.to)) : new Set();
    const cells = game.board().flat();
    if (puzzle.startTurn === 'b') cells.reverse();
    board.replaceChildren(...cells.map((piece,i)=>{
      const offset = puzzle.startTurn === 'b' ? 63-i : i;
      const square = 'abcdefgh'[offset%8] + (8-Math.floor(offset/8));
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.dataset.square = square;
      cell.className = 'square' + ((i+Math.floor(i/8))%2?' dark':'');
      cell.classList.toggle('selected',square===selected);
      cell.classList.toggle('legal',legal.has(square));
      cell.classList.toggle('occupied',Boolean(piece));
      cell.setAttribute('aria-label',square+(piece?', '+(piece.color==='w'?'White ':'Black ')+piece.type:', empty'));
      if(piece) {
        const image = document.createElement('img');
        image.src = pieceSource(piece.color,piece.type);
        image.alt = '';
        image.className = 'piece';
        cell.append(image);
      }
      return cell;
    }));
    $('puzzle-title').textContent=puzzle.title;
    $('puzzle-theme').textContent=puzzle.theme+' · '+(puzzle.startTurn==='w'?'White':'Black')+' to play';
    $('puzzle-count').textContent=(index+1)+' / '+puzzles.length+' · '+solvedIds.size+' solved';
  }
  function load(next) {
    index=next%puzzles.length;
    game=new Chess(puzzles[index].fen);
    selected=null;
    solved=false;
    gaveUp=false;
    $('puzzle-message').textContent='Find the best move.';
    render();
  }
  board.addEventListener('click',event=>{
    const square=event.target.closest('[data-square]')?.dataset.square;
    if(!square||solved)return;
    const candidate=selected&&game.moves({square:selected,verbose:true}).find(move=>move.to===square&&(!move.promotion||move.promotion==='q'));
    if(candidate) {
      const uci=candidate.from+candidate.to+(candidate.promotion||'');
      const trial=new Chess(game.fen());
      trial.move(candidate.san);
      const correct=uci===puzzles[index].solution[0]||(puzzles[index].goal==='mate'&&trial.isCheckmate());
      if(correct) {
        game=trial;
        solved=true;
        selected=null;
        $('puzzle-message').textContent='Correct! '+puzzles[index].explanation;
        if(!gaveUp) {
          solvedIds.add(puzzles[index].id);
          try { localStorage.setItem('ouru-puzzle-progress',JSON.stringify([...solvedIds])); } catch {}
        }
      } else {
        selected=null;
        $('puzzle-message').textContent='Try again. Look for '+puzzles[index].theme.toLowerCase()+'.';
      }
    } else selected=game.get(square)?.color===game.turn()&&selected!==square?square:null;
    render();
  });
  $('puzzle-next').addEventListener('click',()=>load(index+1));
  $('puzzle-retry').addEventListener('click',()=>load(index));
  $('puzzle-solution').addEventListener('click',()=>{
    if(solved)return;
    gaveUp=true;
    const u=puzzles[index].solution[0];
    const move=game.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
    solved=true;
    selected=null;
    $('puzzle-message').textContent=move.san+' · '+puzzles[index].explanation;
    render();
  });
  window.addEventListener('ouru-appearance',()=>{if(game)render();});
  return {open(){load(index);$('puzzles-dialog').showModal();}};
}
