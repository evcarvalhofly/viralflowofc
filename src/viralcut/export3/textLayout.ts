// ============================================================
// ViralCut Export3 – Text rendering on canvas
// ============================================================
import { TrackItem } from '../types';

export function drawTextItemOnCanvas(
  ctx: CanvasRenderingContext2D,
  item: TrackItem,
  canvasW: number,
  canvasH: number
) {
  const td = item.textDetails;
  if (!td) return;

  const x = (td.posX / 100) * canvasW;
  const y = (td.posY / 100) * canvasH;
  const maxW = (td.width / 100) * canvasW;
  const fontSize = Math.round((td.fontSize / 100) * canvasH);
  if (fontSize < 1) return;

  ctx.save();
  ctx.globalAlpha = td.opacity ?? 1;

  const fontStr = `bold ${fontSize}px ${td.fontFamily || 'Inter, Arial, sans-serif'}`;
  ctx.font = fontStr;
  ctx.textAlign = (td.textAlign as CanvasTextAlign) || 'center';
  ctx.textBaseline = 'middle';

  const words = (td.text || '').split(' ');
  const lineHeight = fontSize * 1.35;
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const totalH = lines.length * lineHeight;
  const topY = y - totalH / 2;

  if (td.backgroundColor && td.backgroundColor !== 'transparent') {
    const padX = fontSize * 0.5;
    const padY = fontSize * 0.25;
    const boxW = maxW + padX * 2;
    const boxH = totalH + padY * 2;
    ctx.fillStyle = td.backgroundColor;
    ctx.beginPath();
    ctx.roundRect?.(x - boxW / 2, topY - padY, boxW, boxH, 6);
    ctx.fill();
  }

  if (td.boxShadow?.blur > 0) {
    ctx.shadowColor = td.boxShadow.color ?? '#000';
    ctx.shadowOffsetX = td.boxShadow.x ?? 2;
    ctx.shadowOffsetY = td.boxShadow.y ?? 2;
    ctx.shadowBlur = td.boxShadow.blur;
  }

  ctx.fillStyle = td.color || '#ffffff';
  lines.forEach((l, li) => {
    const lineY = topY + li * lineHeight + lineHeight / 2;
    ctx.fillText(l, x, lineY, maxW);
  });

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.restore();
}
