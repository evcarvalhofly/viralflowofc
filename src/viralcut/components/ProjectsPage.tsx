import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Film, Trash2, Copy, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "../stores/project-store";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.getMetadata());
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  const handleNewProject = () => {
    const p = createProject("Novo Projeto");
    setActiveProject(p.id);
    navigate(`/viralcut/editor/${p.id}`);
  };

  const handleOpen = (id: string) => {
    setActiveProject(id);
    navigate(`/viralcut/editor/${id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-viral flex items-center justify-center">
            <Film className="h-4 w-4 text-white" />
          </div>
          <span className="font-display font-bold text-lg text-gradient-viral">ViralCut</span>
        </div>
        <Button onClick={handleNewProject} className="gap-2 gradient-viral text-white border-0">
          <Plus className="h-4 w-4" />
          Novo Projeto
        </Button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="font-display font-bold text-2xl mb-6">Meus Projetos</h1>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl gradient-viral flex items-center justify-center opacity-50">
              <Film className="h-8 w-8 text-white" />
            </div>
            <h3 className="font-display font-semibold text-lg">Nenhum projeto ainda</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Crie seu primeiro projeto de vídeo e comece a editar.
            </p>
            <Button onClick={handleNewProject} className="gap-2 gradient-viral text-white border-0 mt-2">
              <Plus className="h-4 w-4" />
              Criar primeiro projeto
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {/* New project card */}
            <button
              onClick={handleNewProject}
              className="aspect-video rounded-xl border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs font-medium">Novo projeto</span>
            </button>

            {projects.map((project) => (
              <div key={project.id} className="group relative">
                <button
                  onClick={() => handleOpen(project.id)}
                  className="w-full aspect-video rounded-xl bg-card border border-border hover:border-primary transition-colors overflow-hidden flex items-center justify-center relative"
                >
                  <div className="w-full h-full gradient-viral opacity-10 absolute inset-0" />
                  <Film className="h-8 w-8 text-muted-foreground relative z-10" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                    <span className="text-white text-sm font-medium">Abrir</span>
                  </div>
                </button>

                <div className="mt-1.5 px-0.5">
                  <p className="text-sm font-medium truncate">{project.name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(project.updatedAt)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="absolute top-2 right-2 hidden group-hover:flex gap-1 z-20">
                  <button
                    onClick={(e) => { e.stopPropagation(); duplicateProject(project.id); }}
                    className="p-1 rounded bg-black/60 text-white hover:bg-black/80"
                    title="Duplicar"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                    className="p-1 rounded bg-black/60 text-white hover:bg-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
