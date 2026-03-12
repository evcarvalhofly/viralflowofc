// ============================================================
// ViralCut – FFmpeg filter_complex Builder
//
// Builds a single filter_complex string that:
//  1. Trims each clip to its exact [mediaStart, mediaEnd] range
//  2. Resets PTS so clips concatenate seamlessly
//  3. Applies speed (setpts/atempo) when playbackRate ≠ 1
//  4. Applies brightness/contrast/saturation filters (threshold 0.05)
//  5. Handles volume per clip
//  6. Handles audio-only clips (music tracks)
//  7. Fills timeline gaps with black+silence
//  8. Concatenates everything in timeline order
//  9. Overlays text items via FFmpeg drawtext filter
// ============================================================
import { Project, TrackItem, MediaFile } from '../types';
import { FFmpegInputEntry } from './buildFFmpegInputs';
import { EXPORT_MIN_CLIP_DURATION } from './validateProjectForFFmpegExport';

const DEBUG = true;
function log(...args: unknown[]) {
  if (DEBUG) console.log('[FFmpeg FilterComplex]', ...args);
}

export interface FilterComplexResult {
  /** Complete filter_complex string */
  filterComplex: string;
  /** Output video label e.g. "[outv]" */
  videoOutLabel: string;
  /** Output audio label e.g. "[outa]" */
  audioOutLabel: string;
  /** Number of segments in the concat */
  segmentCount: number;
}

interface Segment {
  videoLabel: string;
  audioLabel: string;
  duration: number; // seconds
}

/** Escape text for FFmpeg drawtext filter — covers all problematic chars */
function escapeDrawtext(text: string): string {
  return (text || '')
    .replace(/\\/g,  '\\\\')
    .replace(/'/g,   "\\'")
    .replace(/:/g,   '\\:')
    .replace(/\[/g,  '\\[')
    .replace(/\]/g,  '\\]')
    .replace(/,/g,   '\\,')
    .replace(/;/g,   '\\;')
    .replace(/%/g,   '\\%')
    .replace(/\{/g,  '\\{')
    .replace(/\}/g,  '\\}')
    .replace(/\n/g,  ' ')
    .trim();
}

/** Convert #rrggbb / #rrggbbaa to FFmpeg 0xRRGGBB or 0xRRGGBBAA */
function hexToFFmpegColor(hex: string, alpha = 1): string {
  const h = hex.replace('#', '');
  if (h.length === 6) {
    const a = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0');
    return `0x${h}${a}`;
  }
  if (h.length === 8) return `0x${h}`;
  return `0xffffff`;
}

/**
 * Build drawtext filter segments for all text track items.
 * Each text item is applied as a drawtext filter on top of the video.
 * Returns the chain of overlay filters to apply, or empty string if no text.
 */
function buildTextDrawtextChain(
  project: Project,
  outW: number,
  outH: number,
  inputVideoLabel: string,
  nextLabel: (prefix: string) => string
): { parts: string[]; finalLabel: string } {
  const textItems: TrackItem[] = project.tracks
    .filter((t) => t.type === 'text' && !t.muted)
    .flatMap((t) => t.items)
    .filter((i) => (i.endTime - i.startTime) >= EXPORT_MIN_CLIP_DURATION)
    .sort((a, b) => a.startTime - b.startTime);

  if (textItems.length === 0) {
    log('No text items found, skipping drawtext');
    return { parts: [], finalLabel: inputVideoLabel };
  }

  log(`Building drawtext for ${textItems.length} text item(s)`);

  const parts: string[] = [];
  let currentLabel = inputVideoLabel;

  for (const item of textItems) {
    const td = item.textDetails;
    if (!td) continue;

    const start = item.startTime.toFixed(6);
    const end = item.endTime.toFixed(6);

    // Font size: stored as % of canvas height
    const fontSizePx = Math.max(8, Math.round((td.fontSize / 100) * outH));

    // Position: % of canvas → pixels
    // posX/posY are the center point of the text block
    const pxX = Math.round((td.posX / 100) * outW);
    const pxY = Math.round((td.posY / 100) * outH);

    // For centered text, FFmpeg drawtext x/y point to the top-left corner.
    // We approximate center alignment with x=X-w/2 expression.
    let xExpr: string;
    let yExpr: string;

    switch (td.textAlign) {
      case 'center':
        xExpr = `${pxX}-text_w/2`;
        yExpr = `${pxY}-text_h/2`;
        break;
      case 'right':
        xExpr = `${pxX}-text_w`;
        yExpr = `${pxY}-text_h/2`;
        break;
      default: // left
        xExpr = `${pxX}`;
        yExpr = `${pxY}-text_h/2`;
    }

    const escapedText = escapeDrawtext(td.text);
    const fontColor = hexToFFmpegColor(td.color || '#ffffff', td.opacity ?? 1);

    // Build drawtext filter string
    let dtFilter = `drawtext=text='${escapedText}'`;
    dtFilter += `:fontsize=${fontSizePx}`;
    dtFilter += `:fontcolor=${fontColor}`;
    dtFilter += `:x=${xExpr}`;
    dtFilter += `:y=${yExpr}`;
    dtFilter += `:enable='between(t,${start},${end})'`;

    // Background box
    if (td.backgroundColor && td.backgroundColor !== 'transparent') {
      const bgColor = hexToFFmpegColor(td.backgroundColor);
      dtFilter += `:box=1:boxcolor=${bgColor}:boxborderw=6`;
    }

    // Shadow (basic: drawtext supports shadowx/shadowy/shadowcolor)
    if (td.boxShadow && td.boxShadow.blur > 0) {
      const shadowColor = hexToFFmpegColor(td.boxShadow.color || '#000000', 0.7);
      dtFilter += `:shadowx=${td.boxShadow.x}:shadowy=${td.boxShadow.y}:shadowcolor=${shadowColor}`;
    }

    const outLabel = nextLabel('dt');
    parts.push(`${currentLabel}${dtFilter}${outLabel}`);
    currentLabel = outLabel;

    log(`Text "${item.name}": [${start}s → ${end}s] size=${fontSizePx}px pos=(${pxX},${pxY})`);
  }

  return { parts, finalLabel: currentLabel };
}

export function buildFFmpegFilterComplex(
  project: Project,
  inputMap: Map<string, FFmpegInputEntry>,
  outW: number,
  outH: number
): FilterComplexResult {
  const parts: string[] = [];
  const segments: Segment[] = [];
  let labelIdx = 0;

  const nextLabel = (prefix: string) => `[${prefix}${labelIdx++}]`;

  // ── Collect all video items, sorted by startTime ───────────
  const videoItems: TrackItem[] = project.tracks
    .filter((t) => t.type === 'video' && !t.muted)
    .flatMap((t) => t.items)
    .filter((i) => (i.endTime - i.startTime) >= EXPORT_MIN_CLIP_DURATION)
    .sort((a, b) => a.startTime - b.startTime);

  // ── Collect all audio-only items (music/sfx tracks) ────────
  const audioOnlyItems: TrackItem[] = project.tracks
    .filter((t) => t.type === 'audio' && !t.muted)
    .flatMap((t) => t.items)
    .filter((i) => (i.endTime - i.startTime) >= EXPORT_MIN_CLIP_DURATION)
    .sort((a, b) => a.startTime - b.startTime);

  const totalDuration = project.duration;
  if (totalDuration <= 0 || videoItems.length === 0) {
    throw new Error('Timeline vazia ou inválida para exportação.');
  }

  // ── Build one segment per video clip ──────────────────────
  let cursor = 0; // current position in timeline (seconds)

  for (const item of videoItems) {
    const entry = inputMap.get(item.mediaId);
    if (!entry) continue;

    const clipStart = item.startTime;
    const clipEnd = item.endTime;
    const clipDur = clipEnd - clipStart;
    const mediaStart = item.mediaStart;
    const mediaEnd = item.mediaEnd;
    const mediaDur = mediaEnd - mediaStart;

    // ── Fill gap before this clip with black+silence ──────────
    if (clipStart > cursor + 0.01) {
      const gapDur = clipStart - cursor;
      const gv = nextLabel('gv');
      const ga = nextLabel('ga');
      parts.push(
        `color=black:s=${outW}x${outH}:d=${gapDur.toFixed(6)}:r=30${gv}`,
        `aevalsrc=0:d=${gapDur.toFixed(6)}${ga}`
      );
      segments.push({ videoLabel: gv, audioLabel: ga, duration: gapDur });
      log(`Gap: ${cursor.toFixed(3)}s → ${clipStart.toFixed(3)}s (${gapDur.toFixed(3)}s)`);
    }
    cursor = clipEnd;

    const vd = item.videoDetails;
    const playRate = Math.min(Math.max(vd?.playbackRate ?? 1, 0.1), 16);
    const vol = Math.max(0, Math.min(4, vd?.volume ?? 1));
    const iIdx = entry.inputIndex;

    // ── Video chain ───────────────────────────────────────────
    let vChain = `[${iIdx}:v]`;

    // trim to [mediaStart, mediaEnd]
    vChain += `trim=start=${mediaStart.toFixed(6)}:end=${mediaEnd.toFixed(6)},setpts=PTS-STARTPTS`;

    // scale to output resolution (exact, letterboxed)
    vChain += `,scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2`;

    // speed change
    if (Math.abs(playRate - 1) > 0.01) {
      vChain += `,setpts=${(1 / playRate).toFixed(6)}*PTS`;
    }

    // color filters — only add eq filter when there's a real change (threshold 0.05)
    const hasBrightness = vd?.brightness !== undefined && Math.abs(vd.brightness - 1) > 0.05;
    const hasContrast   = vd?.contrast   !== undefined && Math.abs(vd.contrast   - 1) > 0.05;
    const hasSaturation = vd?.saturation !== undefined && Math.abs(vd.saturation - 1) > 0.05;
    const eq: string[] = [];
    if (hasBrightness) eq.push(`brightness=${(vd!.brightness! - 1).toFixed(3)}`);
    if (hasContrast)   eq.push(`contrast=${vd!.contrast!.toFixed(3)}`);
    if (hasSaturation) eq.push(`saturation=${vd!.saturation!.toFixed(3)}`);
    if (eq.length > 0) {
      vChain += `,eq=${eq.join(':')}`;
    }

    // flip
    if (vd?.flipH && vd?.flipV) vChain += ',hflip,vflip';
    else if (vd?.flipH) vChain += ',hflip';
    else if (vd?.flipV) vChain += ',vflip';

    const vLabel = nextLabel('v');
    parts.push(`${vChain}${vLabel}`);

    // ── Audio chain ───────────────────────────────────────────
    let aChain = `[${iIdx}:a]`;
    aChain += `atrim=start=${mediaStart.toFixed(6)}:end=${mediaEnd.toFixed(6)},asetpts=PTS-STARTPTS`;

    if (Math.abs(playRate - 1) > 0.01) {
      // atempo only supports 0.5–2.0; chain multiple for extreme values
      aChain += buildAtempoChain(playRate);
    }

    if (Math.abs(vol - 1) > 0.01) {
      aChain += `,volume=${vol.toFixed(3)}`;
    }

    const aLabel = nextLabel('a');
    parts.push(`${aChain}${aLabel}`);

    const outDur = mediaDur / playRate;
    segments.push({ videoLabel: vLabel, audioLabel: aLabel, duration: outDur });

    log(`Clip "${item.name}": input ${iIdx} trim ${mediaStart.toFixed(3)}–${mediaEnd.toFixed(3)} → ${outDur.toFixed(3)}s`);
  }

  // ── Fill trailing gap ──────────────────────────────────────
  if (cursor < totalDuration - 0.01) {
    const gapDur = totalDuration - cursor;
    const gv = nextLabel('gv');
    const ga = nextLabel('ga');
    parts.push(
      `color=black:s=${outW}x${outH}:d=${gapDur.toFixed(6)}:r=30${gv}`,
      `aevalsrc=0:d=${gapDur.toFixed(6)}${ga}`
    );
    segments.push({ videoLabel: gv, audioLabel: ga, duration: gapDur });
  }

  // ── Build audio-only overlay mix (music tracks) ────────────
  const audioMixParts: string[] = [];
  const audioMixLabels: string[] = [];

  for (const item of audioOnlyItems) {
    const entry = inputMap.get(item.mediaId);
    if (!entry) continue;
    const iIdx = entry.inputIndex;
    const ad = item.audioDetails;
    const vol = Math.max(0, Math.min(4, ad?.volume ?? 1));
    const playRate = Math.min(Math.max(ad?.playbackRate ?? 1, 0.1), 4);
    const delayMs = Math.round(item.startTime * 1000);

    let aChain = `[${iIdx}:a]`;
    aChain += `atrim=start=${item.mediaStart.toFixed(6)}:end=${item.mediaEnd.toFixed(6)},asetpts=PTS-STARTPTS`;
    if (Math.abs(playRate - 1) > 0.01) aChain += buildAtempoChain(playRate);
    if (Math.abs(vol - 1) > 0.01) aChain += `,volume=${vol.toFixed(3)}`;
    if (delayMs > 0) aChain += `,adelay=${delayMs}|${delayMs}`;

    const amLabel = nextLabel('am');
    parts.push(`${aChain}${amLabel}`);
    audioMixLabels.push(amLabel);
  }

  // ── Concat all segments ────────────────────────────────────
  const n = segments.length;
  if (n === 0) throw new Error('Nenhum segmento válido para exportar.');

  const concatInputs = segments.map((s) => `${s.videoLabel}${s.audioLabel}`).join('');
  const outv_base = '[outv_concat]';
  const outa_base = audioMixLabels.length > 0 ? '[outa_base]' : '[outa]';

  parts.push(`${concatInputs}concat=n=${n}:v=1:a=1${outv_base}${outa_base}`);
  log(`Concat: ${n} segments`);

  // ── Mix audio tracks if present ────────────────────────────
  let finalAudioLabel = '[outa]';
  if (audioMixLabels.length > 0) {
    const mixInputs = `[outa_base]${audioMixLabels.join('')}`;
    parts.push(`${mixInputs}amix=inputs=${audioMixLabels.length + 1}:duration=first:normalize=0[outa]`);
    log(`amix: ${audioMixLabels.length + 1} audio inputs`);
  }

  // ── Apply text overlays via drawtext ──────────────────────
  const { parts: textParts, finalLabel: finalVideoLabel } = buildTextDrawtextChain(
    project,
    outW,
    outH,
    outv_base,
    nextLabel
  );
  parts.push(...textParts);

  // The final video label is either [outv_concat] (no text) or the last drawtext label
  const videoOutLabel = finalVideoLabel;

  const filterComplex = parts.join(';');

  return {
    filterComplex,
    videoOutLabel,
    audioOutLabel: finalAudioLabel,
    segmentCount: n,
  };
}

/** Build a chain of atempo filters to handle playback rates outside [0.5, 2.0] */
function buildAtempoChain(rate: number): string {
  const chain: string[] = [];
  let r = rate;
  while (r > 2.0) {
    chain.push('atempo=2.0');
    r /= 2.0;
  }
  while (r < 0.5) {
    chain.push('atempo=0.5');
    r /= 0.5;
  }
  chain.push(`atempo=${r.toFixed(6)}`);
  return ',' + chain.join(',');
}
