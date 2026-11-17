const storageKey = 'ouru-appearance-v1';
export const pieceNames = ['wK','wQ','wR','wB','wN','wP','bK','bQ','bR','bB','bN','bP'];
export function readAppearance() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return {
      set: ['classic','chessnut','custom'].includes(data.set) ? data.set : 'classic',
      board: ['sage','walnut','slate'].includes(data.board) ? data.board : 'sage',
      custom: Object.fromEntries(pieceNames.filter(name => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data.custom?.[name] || '')).map(name => [name, data.custom[name]])),
    };
  } catch { return { set:'classic', board:'sage', custom:{} }; }
}
let appearance = readAppearance();
export function pieceSource(color, type) {
  const name = color + type.toUpperCase();
  if (appearance.set === 'custom' && appearance.custom[name]) return appearance.custom[name];
  return (appearance.set === 'chessnut' ? 'pieces/chessnut/' : 'pieces/') + name + '.svg';
}
export function getAppearance() { return appearance; }
export function setAppearance(next) {
  localStorage.setItem(storageKey, JSON.stringify(next));
  appearance = next;
  document.documentElement.dataset.boardTheme = next.board;
  window.dispatchEvent(new Event('ouru-appearance'));
}
export async function readPieceUpload(files) {
  const images = {};
  let bytes = 0;
  for (const file of files) {
    const match = /^([wb])([kqrbnp])\.(png|jpe?g|webp)$/i.exec(file.name);
    if (!match || file.size > 256 * 1024) throw new Error('Use PNG, JPG, or WebP files named wK, wQ, wR, wB, wN, wP, bK, bQ, bR, bB, bN, bP. Each file must be under 256 KB.');
    const name = match[1].toLowerCase() + match[2].toUpperCase();
    if (images[name]) throw new Error('Each piece needs one image. Remove the duplicate ' + name + '.');
    bytes += file.size;
    if (bytes > 2 * 1024 * 1024) throw new Error('The complete piece set must be under 2 MB.');
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read ' + file.name));
      reader.readAsDataURL(file);
    });
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(data)) throw new Error('Unsupported image type for ' + file.name);
    const image = await createImageBitmap(file);
    const invalid = image.width > 2048 || image.height > 2048 || !image.width || !image.height;
    image.close();
    if (invalid) throw new Error('Piece images must be 2048 × 2048 pixels or smaller.');
    images[name] = data;
  }
  if (pieceNames.some(name => !images[name])) throw new Error('Select all 12 piece images to upload a complete set.');
  return images;
}
