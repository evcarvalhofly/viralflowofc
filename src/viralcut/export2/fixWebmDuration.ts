// ============================================================
// ViralCut Export2 – WebM duration metadata fixer
//
// MediaRecorder-generated WebM blobs often have duration=0 in their
// Matroska header, which causes mobile gallery apps to show "0s".
// We patch the Duration element directly in the binary blob.
// ============================================================

/**
 * Attempts to fix the Duration field in a WebM blob so that
 * mobile galleries recognise the correct length.
 *
 * @param blob - Raw blob from MediaRecorder
 * @param durationSec - Actual project duration in seconds
 */
export async function fixWebmDuration(
  blob: Blob,
  durationSec: number
): Promise<Blob> {
  if (!blob.type.includes('webm') || durationSec <= 0) return blob;

  try {
    const buffer = await blob.arrayBuffer();
    const data = new Uint8Array(buffer);
    const fixed = patchWebmDuration(data, durationSec * 1000); // ms
    return new Blob([fixed.buffer as ArrayBuffer], { type: blob.type });
  } catch (e) {
    console.warn('[ViralCut] fixWebmDuration failed, using original blob', e);
    return blob;
  }
}

// ── Matroska EBML IDs ────────────────────────────────────────
const SEGMENT_ID = [0x18, 0x53, 0x80, 0x67];
const INFO_ID    = [0x15, 0x49, 0xa9, 0x66];
const DURATION_ID = [0x44, 0x89];
const TIMECODE_SCALE_ID = [0x2a, 0xd7, 0xb1];

function readVint(data: Uint8Array, pos: number): { value: number; length: number } {
  const first = data[pos];
  if (first === undefined) return { value: 0, length: 1 };
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && !(first & mask)) { length++; mask >>= 1; }
  let value = first & (mask - 1);
  for (let i = 1; i < length; i++) value = (value << 8) | data[pos + i];
  return { value, length };
}

function matchBytes(data: Uint8Array, pos: number, pattern: number[]): boolean {
  for (let i = 0; i < pattern.length; i++) {
    if (data[pos + i] !== pattern[i]) return false;
  }
  return true;
}

function patchWebmDuration(data: Uint8Array, durationMs: number): Uint8Array {
  const out = new Uint8Array(data);

  // Find Segment
  let pos = 4; // skip EBML header (simplistic)
  while (pos < data.length - 8) {
    if (matchBytes(data, pos, SEGMENT_ID)) {
      pos += SEGMENT_ID.length;
      const sz = readVint(data, pos);
      pos += sz.length;

      // Walk inside Segment looking for Info
      const segEnd = Math.min(pos + sz.value, data.length);
      while (pos < segEnd - 8) {
        if (matchBytes(data, pos, INFO_ID)) {
          pos += INFO_ID.length;
          const infoSz = readVint(data, pos);
          pos += infoSz.length;

          const infoEnd = pos + infoSz.value;
          let timecodeScale = 1_000_000; // default: 1ms per tick

          // First pass: find TimecodeScale
          let scanPos = pos;
          while (scanPos < infoEnd - 4) {
            if (matchBytes(data, scanPos, TIMECODE_SCALE_ID)) {
              scanPos += TIMECODE_SCALE_ID.length;
              const tsz = readVint(data, scanPos);
              scanPos += tsz.length;
              let val = 0;
              for (let i = 0; i < tsz.value; i++) val = (val * 256) + data[scanPos + i];
              timecodeScale = val;
              break;
            }
            scanPos++;
          }

          // Second pass: find Duration and patch it
          scanPos = pos;
          while (scanPos < infoEnd - 4) {
            if (matchBytes(data, scanPos, DURATION_ID)) {
              scanPos += DURATION_ID.length;
              const dsz = readVint(data, scanPos);
              scanPos += dsz.length;

              if (dsz.value === 4 || dsz.value === 8) {
                // Duration stored as float (32 or 64 bit)
                // value = durationMs / (timecodeScale / 1_000_000)
                const ticks = (durationMs / (timecodeScale / 1_000_000));

                if (dsz.value === 8) {
                  const view = new DataView(out.buffer, scanPos, 8);
                  view.setFloat64(0, ticks, false); // big-endian
                } else {
                  const view = new DataView(out.buffer, scanPos, 4);
                  view.setFloat32(0, ticks, false);
                }
                return out;
              }
              break;
            }
            scanPos++;
          }
          return out; // Info found but no Duration element to patch
        }
        pos++;
      }
      return out;
    }
    pos++;
  }

  return out;
}
