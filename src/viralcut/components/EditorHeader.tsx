import { useState, useMemo } from "react";
import { ChevronLeft, MoreVertical, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjectStore } from "../stores/project-store";
import { ExportModal } from "./ExportModal";

export function EditorHeader() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const renameProject = useProjectStore((s) => s.renameProject);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [showExport, setShowExport] = useState(false);

  const handleTitleClick = () => {
    if (!activeProject) return;
    setTitleValue(activeProject.name);
    setIsEditing(true);
  };

  const handleTitleBlur = () => {
    if (activeProject && titleValue.trim()) {
      renameProject(activeProject.id, titleValue.trim());
    }
    setIsEditing(false);
  };

  return (
    <>
      <header className="flex items-center h-11 px-3 border-b border-border bg-card shrink-0 gap-2">
        <Link to="/viralcut" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
          <span className="text-xs hidden sm:block">Projetos</span>
        </Link>

        <div className="w-px h-5 bg-border" />

        <div className="flex-1 flex justify-center">
          {isEditing ? (
            <input
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === "Enter" && handleTitleBlur()}
              className="text-sm font-semibold bg-transparent border-b border-primary outline-none text-center px-2 py-0.5"
              style={{ minWidth: 120, maxWidth: 300 }}
            />
          ) : (
            <button
              onClick={handleTitleClick}
              className="text-sm font-semibold hover:text-primary transition-colors truncate max-w-xs"
            >
              {activeProject?.name ?? "ViralCut"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={() => setShowExport(true)}
            disabled={!activeProject}
            className="gap-1.5 gradient-viral text-white border-0 h-8"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:block">Exportar</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleTitleClick}>
                Renomear projeto
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/viralcut">Fechar projeto</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {showExport && (
        <ExportModal onClose={() => setShowExport(false)} />
      )}
    </>
  );
}
