import { shareHeadline, type ShareCard, type ShareMark } from '@tmi/shared';

/**
 * Phase 56: the picture people post -- the card drawn on a canvas, 1200x630,
 * the size every site unfurls. An image, not the page: its colours are the
 * picture's own, fixed so it reads the same wherever it is posted, and it
 * carries no name but the maker's chosen first name.
 */
const COLOURS = { from: '#3b2a7a', to: '#6d4fd6', text: '#ffffff', right: '#22a06b', wrong: '#e5484d', skipped: '#d0d4dc' };

export async function drawShareCard(
  card: ShareCard,
  firstName: string | null,
  brand = 'Aimtrue',
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, COLOURS.from);
  gradient.addColorStop(1, COLOURS.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 630);

  ctx.fillStyle = COLOURS.text;
  ctx.globalAlpha = 0.8;
  ctx.font = '40px Helvetica, Arial, sans-serif';
  ctx.fillText(`${brand} Quest${firstName ? ` · ${firstName}` : ''}`, 100, 130);
  ctx.globalAlpha = 1;
  ctx.font = 'bold 72px Helvetica, Arial, sans-serif';
  wrap(ctx, card.kind === 'challenge' ? 'Can you solve this?' : card.level_label, 100, 240, 1000, 84);
  ctx.globalAlpha = 0.9;
  ctx.font = '44px Helvetica, Arial, sans-serif';
  ctx.fillText(shareHeadline(card).replace(`${card.level_label} · `, ''), 100, 400);
  ctx.globalAlpha = 1;

  if (card.kind === 'game_result') {
    const marks = card.marks.slice(0, 20);
    const size = marks.length > 10 ? 40 : 64;
    marks.forEach((mark: ShareMark, i) => {
      ctx.fillStyle = COLOURS[mark];
      roundRect(ctx, 100 + i * (size + 12), 460, size, size, 10);
    });
  }
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.fill();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, line: number) {
  const words = text.split(' ');
  let row = '';
  let top = y;
  for (const word of words) {
    const next = row ? `${row} ${word}` : word;
    if (ctx.measureText(next).width > max && row) {
      ctx.fillText(row, x, top);
      row = word;
      top += line;
    } else row = next;
  }
  if (row) ctx.fillText(row, x, top);
}
