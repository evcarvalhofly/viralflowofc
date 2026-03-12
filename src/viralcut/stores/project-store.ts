import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TProject, TProjectMetadata, ProjectSettings, AspectRatio, CanvasSize } from "../types/project";
import type { TimelineTrack, VideoTrack } from "../types/timeline";
import { DEFAULT_PROJECT_SETTINGS, ASPECT_RATIO_MAP } from "../types/project";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createDefaultProject(name: string): TProject {
  const mainTrack: VideoTrack = {
    id: generateId(),
    type: "video",
    name: "Faixa Principal",
    elements: [],
    isMain: true,
    muted: false,
    hidden: false,
  };

  return {
    id: generateId(),
    name,
    tracks: [mainTrack],
    settings: { ...DEFAULT_PROJECT_SETTINGS },
    duration: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

interface ProjectStore {
  projects: TProject[];
  activeProjectId: string | null;

  // Project CRUD
  createProject: (name?: string) => TProject;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => TProject | null;
  renameProject: (id: string, name: string) => void;

  // Active project
  setActiveProject: (id: string) => void;
  closeProject: () => void;
  getActive: () => TProject;
  getActiveOrNull: () => TProject | null;
  getMetadata: () => TProjectMetadata[];

  // Project settings
  updateSettings: (settings: Partial<ProjectSettings>) => void;
  setAspectRatio: (ratio: AspectRatio) => void;

  // Track management
  addTrack: (track: TimelineTrack) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, data: Partial<TimelineTrack>) => void;
  getTracks: () => TimelineTrack[];
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,

      createProject: (name = "Novo Projeto") => {
        const project = createDefaultProject(name);
        set((state) => ({ projects: [...state.projects, project] }));
        return project;
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        }));
      },

      duplicateProject: (id) => {
        const project = get().projects.find((p) => p.id === id);
        if (!project) return null;
        const copy: TProject = {
          ...project,
          id: generateId(),
          name: `${project.name} (cópia)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tracks: JSON.parse(JSON.stringify(project.tracks)),
        };
        set((state) => ({ projects: [...state.projects, copy] }));
        return copy;
      },

      renameProject: (id, name) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      setActiveProject: (id) => {
        set({ activeProjectId: id });
      },

      closeProject: () => {
        set({ activeProjectId: null });
      },

      getActive: () => {
        const { projects, activeProjectId } = get();
        const p = projects.find((p) => p.id === activeProjectId);
        if (!p) throw new Error("No active project");
        return p;
      },

      getActiveOrNull: () => {
        const { projects, activeProjectId } = get();
        return projects.find((p) => p.id === activeProjectId) ?? null;
      },

      getMetadata: () => {
        return get().projects.map((p) => ({
          id: p.id,
          name: p.name,
          duration: p.duration,
          aspectRatio: p.settings.aspectRatio,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }));
      },

      updateSettings: (settings) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === state.activeProjectId
              ? { ...p, settings: { ...p.settings, ...settings }, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      setAspectRatio: (ratio) => {
        const canvasSize = ASPECT_RATIO_MAP[ratio];
        get().updateSettings({ aspectRatio: ratio, canvasSize });
      },

      addTrack: (track) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === state.activeProjectId
              ? { ...p, tracks: [...p.tracks, track], updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      removeTrack: (trackId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === state.activeProjectId
              ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId), updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      updateTrack: (trackId, data) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === state.activeProjectId
              ? {
                  ...p,
                  updatedAt: new Date().toISOString(),
                  tracks: p.tracks.map((t) =>
                    t.id === trackId ? ({ ...t, ...data } as TimelineTrack) : t
                  ),
                }
              : p
          ),
        }));
      },

      getTracks: () => {
        const project = get().getActiveOrNull();
        return project?.tracks ?? [];
      },
    }),
    {
      name: "viralcut-projects",
      partialize: (state) => ({
        projects: state.projects.map((p) => ({
          ...p,
          // Don't persist large binary data - media assets are re-loaded
          tracks: p.tracks,
        })),
        activeProjectId: state.activeProjectId,
      }),
    }
  )
);
