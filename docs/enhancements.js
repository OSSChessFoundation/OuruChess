import { Chess } from './chess.js';
import { getAppearance, setAppearance, pieceNames, pieceSource, readPieceUpload } from './pieces.js';
import { initPuzzles } from './puzzles.js';

const $ = id => document.getElementById(id);
const value = { p:1, n:3, b:3, r:5, q:9, k:0 };

export function initEnhancements({ game, snapshot, renderBoard }) {
  const puzzles = initPuzzles();
  const home = $('home');
  const play = $('play-area');
  const savedSet = getAppearance();
  document.documentElement.dataset.boardTheme = savedSet.board;
  function showPlay() {
    home.hidden = true;
    play.hidden = false;
    $('home-nav').removeAttribute('aria-current');
    $('play-nav').setAttribute('aria-current','page');
  }
  function showHome() {
    home.hidden = false;
    play.hidden = true;
    $('play-nav').removeAttribute('aria-current');
    $('home-nav').setAttribute('aria-current','page');
  }
  function launch(id) {
    showPlay();
    if (snapshot().online) return;
    $(id).click();
  }
  $('home-nav').addEventListener('click',showHome);
  $('play-nav').addEventListener('click',showPlay);
  $('home-local').addEventListener('click',showPlay);
  $('home-quick').addEventListener('click',()=>launch('quick'));
  $('home-friend').addEventListener('click',()=>launch('friend'));
  $('home-bot').addEventListener('click',()=>launch('bot-open'));
  $('home-analysis').addEventListener('click',()=>$('open-analysis').click());
  $('home-learn').addEventListener('click',()=>$('open-tutorial').click());
  for (const id of ['open-puzzles','home-puzzles']) $(id).addEventListener('click',()=>puzzles.open());
  for (const button of document.querySelectorAll('[data-quick-clock]')) {
    button.addEventListener('click',()=>{
      $('match-clock').value = button.dataset.quickClock;
      launch('quick');
    });
  }

  const settings = $('appearance-dialog');
  function renderPreview() {
    const preview = $('appearance-preview');
    preview.replaceChildren(...pieceNames.slice(0,6).map(name=>{
      const image = document.createElement('img');
      image.src = pieceSource(name[0],name[1]);
      image.alt = name;
      return image;
    }));
  }
  function openSettings() {
    $('piece-set').value = getAppearance().set;
    $('board-theme').value = getAppearance().board;
    $('appearance-message').textContent = '';
    renderPreview();
    settings.showModal();
  }
  $('open-appearance').addEventListener('click',openSettings);
  $('home-appearance').addEventListener('click',openSettings);
  $('piece-set').addEventListener('change',()=>{
    if($('piece-set').value==='custom'&&pieceNames.some(name=>!getAppearance().custom[name])) {
      $('piece-set').value=getAppearance().set;
      $('appearance-message').textContent='Upload all 12 images to use a custom set.';
      return;
    }
    try {
      setAppearance({...getAppearance(),set:$('piece-set').value});
      renderPreview();
    } catch { $('appearance-message').textContent='Your browser could not save the piece set.'; }
  });
  $('board-theme').addEventListener('change',()=>{
    try { setAppearance({...getAppearance(),board:$('board-theme').value}); }
    catch { $('appearance-message').textContent='Your browser could not save the board theme.'; }
  });
  $('piece-upload').addEventListener('change',async event=>{
    const input=event.target;
    input.disabled=true;
    $('appearance-message').textContent='Checking your piece images…';
    try {
      const custom=await readPieceUpload([...input.files]);
      setAppearance({...getAppearance(),set:'custom',custom});
      $('piece-set').value='custom';
      renderPreview();
      $('appearance-message').textContent='Custom piece set saved in this browser.';
    } catch(error) { $('appearance-message').textContent=error.message; }
    finally { input.value='';input.disabled=false; }
  });
  $('piece-reset').addEventListener('click',()=>{
    try {
      setAppearance({...getAppearance(),set:'classic',custom:{}});
      $('piece-set').value='classic';
      renderPreview();
      $('appearance-message').textContent='Custom images removed from this browser.';
    } catch { $('appearance-message').textContent='Could not update your browser storage.'; }
  });

  const featured=new Chess();
  for(const move of ['e4','e5','Nf3','Nc6','Bc4','Bc5'])featured.move(move);
  function renderFeature() {
    $('home-board').replaceChildren(...featured.board().flat().map((piece,i)=>{
      const square=document.createElement('div');
      square.className='square'+((i+Math.floor(i/8))%2?' dark':'');
      if(piece) {
        const image=document.createElement('img');
        image.src=pieceSource(piece.color,piece.type);
        image.alt='';
        image.className='piece';
        square.append(image);
      }
      return square;
    }));
  }
  function materialStrip(color) {
    const row=document.createElement('div');
    row.className='material-content';
    const history=game.history({verbose:true});
    const captures=history.filter(move=>move.color===color&&move.captured).map(move=>move.captured).sort((a,b)=>value[b]-value[a]);
    const enemy=color==='w'?'b':'w';
    const totals={w:0,b:0};
    for(const piece of game.board().flat())if(piece)totals[piece.color]+=value[piece.type];
    for(const type of captures) {
      const image=document.createElement('img');
      image.src=pieceSource(enemy,type);
      image.alt='Captured '+type;
      row.append(image);
    }
    const label=document.createElement('span');
    const advantage=totals[color]-totals[enemy];
    label.textContent=advantage>0?'+'+advantage:'';
    row.setAttribute('aria-label',(color==='w'?'White':'Black')+' captured '+captures.length+' pieces. Material '+totals[color]+' to '+totals[enemy]+'.');
    row.append(label);
    return row;
  }
  function refreshMaterial() {
    const {flipped}=snapshot();
    $('material-top').replaceChildren(materialStrip(flipped?'w':'b'));
    $('material-bottom').replaceChildren(materialStrip(flipped?'b':'w'));
  }
  window.addEventListener('ouru-position',()=>{
    refreshMaterial();
    if(snapshot().online)showPlay();
  });
  window.addEventListener('ouru-appearance',()=>{
    renderBoard();
    renderFeature();
    renderPreview();
    refreshMaterial();
    document.querySelector('.brand img').src=pieceSource('w','r');
  });
  $('copy-pgn').addEventListener('click',async()=>{
    const pgn=game.pgn();
    try {
      await navigator.clipboard.writeText(pgn);
      $('copy-status').textContent='PGN copied.';
    } catch {
      $('export-pgn').value=pgn;
      $('export-dialog').showModal();
      $('export-pgn').select();
    }
  });
  renderFeature();
  refreshMaterial();
  return { showPlay, showHome };
}
