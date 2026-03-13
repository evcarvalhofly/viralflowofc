// ============================================================
// ViralCut Export3 – Main entry point
//
// Drop-in replacement for export2/exportProjectWithCanvas.
// Uses MediaBunny for deterministic, frame-by-frame encoding.
// NO MediaRecorder. NO captureStream. NO real-time playback.
// ============================================================

export { exportScene as exportProjectWithMediaBunny } from './sceneExporter';
export type { SceneExportOptions as CanvasExportOptions, ProgressCallback as ExportProgressCallback } from './sceneExporter';
