export function attachPieceDragging(board, allowed, choose, selectedSquare) {
  let gesture = null;
  let ghost = null;
  let suppressClick = false;
  const squareAt = (x,y) => {
    const square = document.elementFromPoint(x,y)?.closest('[data-square]');
    return square && board.contains(square) ? square.dataset.square : null;
  };
  function end() {
    if (gesture?.dragging) suppressClick = true;
    if (gesture?.source) gesture.source.classList.remove('drag-source');
    gesture = null;
    ghost?.remove();
    ghost = null;
  }
  board.addEventListener('pointerdown', event => {
    if (event.button === 0) suppressClick = false;
    if (event.button !== 0 || document.getElementById('draw-live')?.getAttribute('aria-pressed') === 'true') return;
    const cell = event.target.closest('[data-square]');
    if (!cell || !allowed(cell.dataset.square)) return;
    gesture = { from:cell.dataset.square, x:event.clientX, y:event.clientY, pointer:event.pointerId, source:cell, dragging:false };
    board.setPointerCapture(event.pointerId);
  });
  board.addEventListener('pointermove', event => {
    if (!gesture || gesture.pointer !== event.pointerId) return;
    if (!gesture.dragging && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 7) return;
    event.preventDefault();
    if (!gesture.dragging) {
      gesture.dragging = true;
      ghost = gesture.source.querySelector('img')?.cloneNode();
      if (ghost) {
        ghost.className = 'drag-piece';
        ghost.style.width = gesture.source.getBoundingClientRect().width + 'px';
        document.body.append(ghost);
      }
      gesture.source.classList.add('drag-source');
    }
    if (ghost) {
      ghost.style.left = event.clientX + 'px';
      ghost.style.top = event.clientY + 'px';
    }
  });
  board.addEventListener('pointerup', event => {
    if (!gesture || gesture.pointer !== event.pointerId) return;
    const {from,dragging} = gesture;
    const to = squareAt(event.clientX,event.clientY);
    end();
    if (!dragging || !to || to === from) return;
    if (selectedSquare() !== from) choose(from);
    choose(to);
  });
  board.addEventListener('pointercancel', end);
  board.addEventListener('lostpointercapture', end);
  board.addEventListener('click', event => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}
