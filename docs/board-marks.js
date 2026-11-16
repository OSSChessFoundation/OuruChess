const files = 'abcdefgh';

export function squareAtIndex(index, flipped) {
  const offset = flipped ? 63 - index : index;
  return files[offset % 8] + (8 - Math.floor(offset / 8));
}

function squareCenter(square, flipped) {
  const x = files.indexOf(square[0]);
  const y = 8 - Number(square[1]);
  return flipped ? [7.5 - x, 7.5 - y] : [x + .5, y + .5];
}

export function positionArrow(element, from, to, flipped) {
  const [x, y] = squareCenter(from, flipped);
  const [toX, toY] = squareCenter(to, flipped);
  const dx = toX - x;
  const dy = toY - y;
  element.style.left = x * 12.5 + '%';
  element.style.top = y * 12.5 + '%';
  element.style.width = Math.hypot(dx, dy) * 12.5 + '%';
  element.style.transform = 'translateY(-50%) rotate(' + Math.atan2(dy, dx) + 'rad)';
}

export function attachBoardMarks({ board, layer, toggle, clearButton, flipped }) {
  const marks = new Map();
  let drawing = false;
  let start = null;
  let gesture = null;

  function render() {
    const nodes = [];
    for (const [from, to] of marks.values()) {
      const mark = document.createElement('div');
      if (from === to) {
        const [x, y] = squareCenter(from, flipped());
        mark.className = 'square-mark';
        mark.style.left = x * 12.5 + '%';
        mark.style.top = y * 12.5 + '%';
      } else {
        mark.className = 'move-arrow drawn-arrow';
        positionArrow(mark, from, to, flipped());
      }
      nodes.push(mark);
    }
    if (start) {
      const [x, y] = squareCenter(start, flipped());
      const mark = document.createElement('div');
      mark.className = 'square-mark mark-start';
      mark.style.left = x * 12.5 + '%';
      mark.style.top = y * 12.5 + '%';
      nodes.push(mark);
    }
    layer.replaceChildren(...nodes);
    clearButton.disabled = !marks.size && !start;
  }

  function clear() {
    marks.clear();
    start = null;
    gesture = null;
    render();
  }

  function mark(from, to) {
    const key = from + to;
    if (marks.has(key)) marks.delete(key);
    else marks.set(key, [from, to]);
    render();
  }

  function square(target) {
    const cell = target?.closest('[data-square]');
    return cell && board.contains(cell) ? cell.dataset.square : null;
  }

  board.addEventListener('contextmenu', event => event.preventDefault());
  board.addEventListener('pointerdown', event => {
    const from = square(event.target);
    if (event.button !== 2 || !from) return;
    event.preventDefault();
    gesture = { pointer: event.pointerId, from };
    board.setPointerCapture(event.pointerId);
  });
  board.addEventListener('pointerup', event => {
    if (gesture?.pointer !== event.pointerId) return;
    const from = gesture.from;
    gesture = null;
    const to = square(document.elementFromPoint(event.clientX, event.clientY));
    if (to) mark(from, to);
  });
  board.addEventListener('pointercancel', () => { gesture = null; });
  board.addEventListener('lostpointercapture', () => { gesture = null; });
  board.addEventListener('click', event => {
    const cell = square(event.target);
    if (!drawing || !cell) return;
    event.preventDefault();
    event.stopPropagation();
    if (!start) {
      start = cell;
      render();
      return;
    }
    const from = start;
    start = null;
    mark(from, cell);
  }, true);

  toggle.addEventListener('click', () => {
    drawing = !drawing;
    start = null;
    toggle.setAttribute('aria-pressed', String(drawing));
    toggle.textContent = drawing ? 'Stop drawing' : 'Draw arrows';
    render();
  });
  clearButton.addEventListener('click', clear);
  return { clear, render };
}
