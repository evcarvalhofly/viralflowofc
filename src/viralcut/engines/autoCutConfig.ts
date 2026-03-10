import { AutoCutConfig, AutoCutMode } from '../types';

export function getAutoCutConfig(mode: AutoCutMode): AutoCutConfig {
  switch (mode) {
    case 'suave':
      return {
        threshold: 0.018,
        minSilenceMs: 320,
        frameMs: 20,
        paddingMs: 170,
        mergeGap: 0.12,
      };
    case 'medio':
      return {
        threshold: 0.022,
        minSilenceMs: 220,
        frameMs: 20,
        paddingMs: 120,
        mergeGap: 0.08,
      };
    case 'agressivo':
      return {
        threshold: 0.028,
        minSilenceMs: 140,
        frameMs: 15,
        paddingMs: 70,
        mergeGap: 0.05,
      };
  }
}
