// ============================================================
// useEditorHistory – Reliable undo/redo for Track[] state
// Stores deep copies, limit 50 states, never mutates in place.
// ============================================================
import { useRef, useCallback } from 'react';
import { Track } from '../types';

const MAX_HISTORY = 50;

export function useEditorHistory(initialTracks: Track[]) {
  // past[0] = oldest, past[last] = most recent before present
  const historyRef = useRef<Track[][]>([JSON.parse(JSON.stringify(initialTracks))]);
  const indexRef = useRef(0);

  const canUndo = () => indexRef.current > 0;
  const canRedo = () => indexRef.current < historyRef.current.length - 1;

  /** Push a new state (deep-clones to prevent aliasing bugs) */
  const push = useCallback((tracks: Track[]) => {
    const next = JSON.parse(JSON.stringify(tracks)) as Track[];
    // Truncate any redo states
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
    historyRef.current.push(next);
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
      indexRef.current = historyRef.current.length - 1;
    } else {
      indexRef.current = historyRef.current.length - 1;
    }
  }, []);

  /** Returns the previous state, or null if at beginning */
  const undo = useCallback((): Track[] | null => {
    if (!canUndo()) return null;
    indexRef.current--;
    return JSON.parse(JSON.stringify(historyRef.current[indexRef.current]));
  }, []);

  /** Returns the next state, or null if at end */
  const redo = useCallback((): Track[] | null => {
    if (!canRedo()) return null;
    indexRef.current++;
    return JSON.parse(JSON.stringify(historyRef.current[indexRef.current]));
  }, []);

  return { push, undo, redo, canUndo, canRedo };
}
