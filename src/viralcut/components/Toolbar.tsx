// ============================================================
// Toolbar – Top bar with project name, zoom, export, save
// ============================================================
import { Scissors, Download, Undo2, Redo2, Edit2, Check, Save, FileDown, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ToolbarProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onExport: () => void;
  onSave?: () => void;
  onExportJson?: () => void;
  onImportJson?: () => void;
}

export function Toolbar({
  projectName,
  onProjectNameChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
}: ToolbarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName);

  const commit = () => {
    const name = draft.trim() || 'Projeto sem título';
    onProjectNameChange(name);
    setDraft(name);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/80 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-1.5 mr-2">
        <div className="h-6 w-6 rounded-md gradient-viral flex items-center justify-center shrink-0">
          <Scissors className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-bold text-foreground hidden sm:block">ViralCut</span>
      </div>

      {/* Project name */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 max-w-[220px]">
        {editing ? (
          <>
            <input
              className="text-sm font-medium bg-input border border-border rounded-md px-2 py-0.5 text-foreground outline-none focus:border-primary w-full"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(projectName); setEditing(false); } }}
              autoFocus
            />
            <button className="text-primary p-0.5" onClick={commit}><Check className="h-3.5 w-3.5" /></button>
          </>
        ) : (
          <button
            className="flex items-center gap-1 group text-left min-w-0"
            onClick={() => { setDraft(projectName); setEditing(true); }}
          >
            <span className="text-sm font-medium text-foreground truncate">{projectName}</span>
            <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5">
        <button
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={onUndo}
          disabled={!canUndo}
          title="Desfazer"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={onRedo}
          disabled={!canRedo}
          title="Refazer"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Export */}
      <Button
        size="sm"
        onClick={onExport}
        className="h-7 px-3 text-xs gap-1.5 gradient-viral text-white border-0 shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Exportar</span>
      </Button>
    </div>
  );
}
