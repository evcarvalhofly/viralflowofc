// ============================================================
// ViralCut Export2 – WebM duration metadata fixer (robust)
//
// MediaRecorder-generated WebM blobs often have Duration=0 in
// their Matroska/EBML header, causing mobile galleries to show
// "0s" even though the video plays fine.
//
// This module patches (or inserts) the Duration element directly
// in the binary blob, respecting the TimecodeScale value found
// in the Info segment.
//
// Matroska spec references:
//   Segment      0x18538067
//   Info         0x1549A966
//   TimecodeScale 0x2AD7B1   (default 1,000,000 ns/tick = 1ms/tick)
//   Duration     0x4489      (float64 big-endian, in ticks)
//   MuxingApp    0x4D80      (used to detect end of Info if needed)
// ============================================================

/**
 * Attempts to fix the Duration field in a WebM blob.
 * Falls back to the original blob if patching fails.
 */
export async function fixWebmDuration(
  blob: Blob,
  durationSec: number
): Promise<Blob> {
  if (!blob.type.includes('webm') || durationSec <= 0) return blob;

  try {
    const buffer = await blob.arrayBuffer();
    const data = new Uint8Array(buffer);
    const result = patchOrInsertDuration(data, durationSec * 1000); // ms → ticks
    return new Blob([result.buffer as ArrayBuffer], { type: blob.type });
  } catch (e) {
    console.warn('[ViralCut] fixWebmDuration failed — using original blob', e);
    return blob;
  }
}

// ── EBML element IDs (big-endian byte arrays) ─────────────────

const EBML_ID        = [0x1A, 0x45, 0xDF, 0xA3]; // EBML header
const SEGMENT_ID     = [0x18, 0x53, 0x80, 0x67];
const INFO_ID        = [0x15, 0x49, 0xA9, 0x66];
const TIMESCALE_ID   = [0x2A, 0xD7, 0xB1];
const DURATION_ID    = [0x44, 0x89];

// ── EBML variable-length integer ─────────────────────────────

interface Vint {
  value: number;   // decoded integer value
  length: number;  // bytes consumed (including the width byte)
}

function readVint(data: Uint8Array, pos: number): Vint {
  if (pos >= data.length) return { value: 0, length: 1 };
  const first = data[pos];
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && !(first & mask)) { length++; mask >>= 1; }
  // Mask off the width bit
  let value = first & (mask - 1);
  for (let i = 1; i < length; i++) {
    value = value * 256 + (data[pos + i] ?? 0);
  }
  return { value, length };
}

// All-ones vint values indicate "unknown size" in EBML
function isUnknownSize(vint: Vint): boolean {
  // For widths 1-8, unknown size is 0x7F, 0x3FFF, 0x1FFFFF, etc.
  const maxForWidth = [0x7F, 0x3FFF, 0x1FFFFF, 0x0FFFFFFF, 0x07FFFFFFFF, 0x03FFFFFFFFFF, 0x01FFFFFFFFFFFF, 0x00FFFFFFFFFFFFFF];
  return vint.value === maxForWidth[vint.length - 1];
}

function matchBytes(data: Uint8Array, pos: number, pattern: number[]): boolean {
  if (pos + pattern.length > data.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (data[pos + i] !== pattern[i]) return false;
  }
  return true;
}

// ── Float64 big-endian writer ─────────────────────────────────

function writeFloat64BE(out: Uint8Array, pos: number, value: number) {
  const view = new DataView(out.buffer, out.byteOffset + pos, 8);
  view.setFloat64(0, value, false); // big-endian
}

function writeFloat32BE(out: Uint8Array, pos: number, value: number) {
  const view = new DataView(out.buffer, out.byteOffset + pos, 4);
  view.setFloat32(0, value, false);
}

// ── Core patcher ─────────────────────────────────────────────

function patchOrInsertDuration(data: Uint8Array, durationMs: number): Uint8Array {
  const out = new Uint8Array(data);

  // Skip EBML header — find Segment
  let pos = 0;

  // Walk past EBML header element if present
  if (matchBytes(data, 0, EBML_ID)) {
    pos += EBML_ID.length;
    const ebmlSz = readVint(data, pos);
    pos += ebmlSz.length + (isUnknownSize(ebmlSz) ? 0 : ebmlSz.value);
  }

  // Find Segment
  while (pos < data.length - 8) {
    if (matchBytes(data, pos, SEGMENT_ID)) break;
    pos++;
  }

  if (pos >= data.length - 8) return out; // no segment found

  pos += SEGMENT_ID.length;
  const segSz = readVint(data, pos);
  pos += segSz.length;

  const segEnd = isUnknownSize(segSz)
    ? data.length
    : Math.min(pos + segSz.value, data.length);

  // Walk Segment children looking for Info
  let infoFound = false;
  while (pos < segEnd - 8) {
    if (matchBytes(data, pos, INFO_ID)) {
      infoFound = true;
      break;
    }
    // Skip any other element (read its ID + size and jump past it)
    const elemIdLen = getEbmlIdLength(data[pos]);
    pos += elemIdLen;
    const elemSz = readVint(data, pos);
    pos += elemSz.length;
    if (!isUnknownSize(elemSz)) {
      pos += elemSz.value;
    } else {
      // Unknown-size element: we can't skip safely, stop here
      break;
    }
  }

  if (!infoFound) return out; // no Info block

  pos += INFO_ID.length;
  const infoSz = readVint(data, pos);
  pos += infoSz.length;
  const infoStart = pos;
  const infoEnd = isUnknownSize(infoSz) ? segEnd : Math.min(pos + infoSz.value, segEnd);

  // ── Pass 1: read TimecodeScale ────────────────────────────
  let timecodeScale = 1_000_000; // default: 1ms per tick (1,000,000 ns)
  let scanPos = infoStart;
  while (scanPos < infoEnd - 4) {
    if (matchBytes(data, scanPos, TIMESCALE_ID)) {
      scanPos += TIMESCALE_ID.length;
      const tsz = readVint(data, scanPos);
      scanPos += tsz.length;
      let val = 0;
      for (let i = 0; i < tsz.value && scanPos + i < data.length; i++) {
        val = val * 256 + data[scanPos + i];
      }
      if (val > 0) timecodeScale = val;
      break;
    }
    scanPos++;
  }
  log(`TimecodeScale: ${timecodeScale}ns/tick`);

  // Duration in ticks: durationMs * 1_000_000ns / timecodeScale
  const durationTicks = (durationMs * 1_000_000) / timecodeScale;
  log(`Duration: ${durationMs}ms → ${durationTicks.toFixed(1)} ticks`);

  // ── Pass 2: find and patch Duration ──────────────────────
  scanPos = infoStart;
  while (scanPos < infoEnd - 4) {
    if (matchBytes(data, scanPos, DURATION_ID)) {
      scanPos += DURATION_ID.length;
      const dsz = readVint(data, scanPos);
      scanPos += dsz.length;

      if (dsz.value === 8) {
        writeFloat64BE(out, scanPos, durationTicks);
        log(`Patched Duration (float64) at byte ${scanPos}`);
        return out;
      } else if (dsz.value === 4) {
        writeFloat32BE(out, scanPos, durationTicks);
        log(`Patched Duration (float32) at byte ${scanPos}`);
        return out;
      }
      // Unexpected size — skip
      break;
    }
    scanPos++;
  }

  // ── Duration element not found → try to INSERT it ────────
  // We'll insert a float64 Duration element right at infoStart.
  // Duration ID = 0x44, 0x89 (2 bytes)
  // Size vint for 8-byte float = 0x88 (1 byte, value=8)
  // Float64 value = 8 bytes
  // Total insertion = 11 bytes
  log('Duration element not found — inserting it');

  const INSERT_SIZE = 11; // 2 (ID) + 1 (size vint) + 8 (float64)
  const newData = new Uint8Array(data.length + INSERT_SIZE);

  // Copy everything up to infoStart
  newData.set(data.subarray(0, infoStart));

  // Write Duration element
  newData[infoStart + 0] = DURATION_ID[0]; // 0x44
  newData[infoStart + 1] = DURATION_ID[1]; // 0x89
  newData[infoStart + 2] = 0x88;           // vint for size=8 (0x80 | 8)
  writeFloat64BE(newData, infoStart + 3, durationTicks);

  // Copy the rest
  newData.set(data.subarray(infoStart), infoStart + INSERT_SIZE);

  // Patch Info element size if it's not unknown-size
  // (adjust the vint that encodes infoSz.value)
  // We stored it right before infoStart; its vint starts at infoStart - infoSz.length
  // For simplicity, only patch if Info size was encoded with exactly 4 bytes (common in Chrome)
  const infoSzPos = infoStart - infoSz.length;
  if (!isUnknownSize(infoSz) && infoSz.length === 4) {
    const newInfoSize = infoSz.value + INSERT_SIZE;
    // 4-byte vint: 0x2X XX XX XX where 0x20000000 is the width bit
    newData[infoSzPos + 0] = 0x20 | ((newInfoSize >> 21) & 0x1F);
    newData[infoSzPos + 1] = (newInfoSize >> 14) & 0xFF;
    newData[infoSzPos + 2] = (newInfoSize >> 7) & 0xFF;
    newData[infoSzPos + 3] = newInfoSize & 0x7F;
  }
  // If Info used unknown-size, no adjustment needed.

  log(`Inserted Duration at byte ${infoStart}, new blob size: ${newData.length}`);
  return newData;
}

// ── EBML ID width detector ────────────────────────────────────

function getEbmlIdLength(firstByte: number): number {
  if (firstByte === undefined) return 1;
  if ((firstByte & 0x80) !== 0) return 1;
  if ((firstByte & 0x40) !== 0) return 2;
  if ((firstByte & 0x20) !== 0) return 3;
  if ((firstByte & 0x10) !== 0) return 4;
  return 4; // fallback
}

function log(...args: unknown[]) {
  if (typeof console !== 'undefined') console.log('[fixWebmDuration]', ...args);
}
