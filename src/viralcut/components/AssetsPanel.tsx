import { useState, useRef } from "react";
import { useProjectStore } from "../stores/project-store";
import { Upload, Film, Music, Type, Image, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMediaStore } from "../stores/media-store";
import { useAssetsPanelStore, type AssetTab } from "../stores/assets-panel-store";
import { useTimelineActions } from "../hooks/useTimelineActions";
import type { MediaAsset } from "../types/media";

const TABS: { id: AssetTab; label: string; icon: React.ReactNode }[] = [
  { id: "media", label: "Mídia", icon: <Film className="h-4 w-4" /> },
  { id: "audio", label: "Áudio", icon: <Music className="h-4 w-4" /> },
  { id: "text", label: "Texto", icon: <Type className="h-4 w-4" /> },
  { id: "settings", label: "Config", icon: <Image className="h-4 w-4" /> },
];

export function AssetsPanel() {
  const { activeTab, setActiveTab } = useAssetsPanelStore();
  const assets = useMediaStore((s) => s.assets);
  const isLoading = useMediaStore((s) => s.isLoading);
  const addFiles = useMediaStore((s) => s.addFiles);
  const removeAsset = useMediaStore((s) => s.removeAsset);
  const { addMediaToTimeline, addTextToTimeline } = useTimelineActions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      await addFiles(files);
    }
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await addFiles(files);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-2 text-xs flex-1 transition-colors",
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.icon}
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "media" && (
          <MediaView
            assets={assets.filter((a) => a.type === "video" || a.type === "image")}
            isLoading={isLoading}
            onFileSelect={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onAddToTimeline={addMediaToTimeline}
            onRemove={removeAsset}
          />
        )}
        {activeTab === "audio" && (
          <AudioView
            assets={assets.filter((a) => a.type === "audio")}
            isLoading={isLoading}
            onFileSelect={() => fileInputRef.current?.click()}
            onAddToTimeline={addMediaToTimeline}
            onRemove={removeAsset}
          />
        )}
        {activeTab === "text" && (
          <TextView onAddText={addTextToTimeline} />
        )}
        {activeTab === "settings" && (
          <SettingsView />
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}

function MediaView({
  assets, isLoading, onFileSelect, onDrop, onAddToTimeline, onRemove,
}: {
  assets: MediaAsset[];
  isLoading: boolean;
  onFileSelect: () => void;
  onDrop: (e: React.DragEvent) => void;
  onAddToTimeline: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex flex-col h-full p-2 gap-2">
      <Button
        onClick={onFileSelect}
        size="sm"
        className="w-full gap-2 gradient-viral text-white border-0"
      >
        <Upload className="h-4 w-4" />
        Importar Mídia
      </Button>

      <div
        className={cn(
          "flex-1 rounded-lg border-2 border-dashed transition-colors overflow-y-auto",
          dragging ? "border-primary bg-primary/5" : "border-border",
          assets.length === 0 ? "flex items-center justify-center" : "p-1"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { setDragging(false); onDrop(e); }}
      >
        {isLoading && (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">Carregando...</span>
          </div>
        )}
        {!isLoading && assets.length === 0 && (
          <div className="flex flex-col items-center gap-2 text-muted-foreground text-center px-4">
            <Film className="h-8 w-8 opacity-40" />
            <span className="text-xs">Arraste vídeos ou imagens aqui</span>
          </div>
        )}
        {assets.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onAdd={() => onAddToTimeline(asset.id)}
                onRemove={() => onRemove(asset.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetCard({ asset, onAdd, onRemove }: { asset: MediaAsset; onAdd: () => void; onRemove: () => void }) {
  return (
    <div className="group relative rounded-md overflow-hidden bg-muted border border-border cursor-pointer hover:border-primary transition-colors"
      onClick={onAdd}
    >
      {asset.thumbnail ? (
        <img
          src={asset.thumbnail}
          alt={asset.name}
          className="w-full aspect-video object-cover"
        />
      ) : (
        <div className="w-full aspect-video flex items-center justify-center bg-secondary">
          <Film className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="p-1.5">
        <p className="text-xs font-medium truncate leading-tight">{asset.name}</p>
        {asset.duration && (
          <p className="text-xs text-muted-foreground">
            {Math.floor(asset.duration / 60)}:{String(Math.floor(asset.duration % 60)).padStart(2, "0")}
          </p>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded p-0.5"
      >
        <Trash2 className="h-3 w-3" />
      </button>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
        <Plus className="h-6 w-6 text-white" />
      </div>
    </div>
  );
}

function AudioView({
  assets, isLoading, onFileSelect, onAddToTimeline, onRemove,
}: {
  assets: MediaAsset[];
  isLoading: boolean;
  onFileSelect: () => void;
  onAddToTimeline: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full p-2 gap-2">
      <Button onClick={onFileSelect} size="sm" className="w-full gap-2 gradient-viral text-white border-0">
        <Upload className="h-4 w-4" />
        Importar Áudio
      </Button>
      <div className="flex-1 overflow-y-auto space-y-1">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-xs gap-2">
            <Music className="h-6 w-6 opacity-40" />
            Nenhum áudio importado
          </div>
        ) : (
          assets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center gap-2 p-2 rounded-md bg-muted border border-border hover:border-primary cursor-pointer transition-colors"
              onClick={() => onAddToTimeline(asset.id)}
            >
              <Music className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{asset.name}</p>
                {asset.duration && (
                  <p className="text-xs text-muted-foreground">
                    {Math.floor(asset.duration / 60)}:{String(Math.floor(asset.duration % 60)).padStart(2, "0")}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(asset.id); }}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const TEXT_PRESETS = [
  { label: "Título", content: "Título", fontSize: 72, fontWeight: "bold" as const },
  { label: "Subtítulo", content: "Subtítulo", fontSize: 48, fontWeight: "normal" as const },
  { label: "Legenda", content: "Legenda do vídeo", fontSize: 36, fontWeight: "normal" as const },
];

function TextView({ onAddText }: { onAddText: (content?: string) => void }) {
  return (
    <div className="flex flex-col gap-2 p-2">
      <Button onClick={() => onAddText("Clique para editar")} size="sm" className="w-full gap-2 gradient-viral text-white border-0">
        <Plus className="h-4 w-4" />
        Adicionar Texto
      </Button>
      <div className="space-y-1.5">
        {TEXT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => onAddText(preset.content)}
            className="w-full text-left p-3 rounded-md bg-muted border border-border hover:border-primary transition-colors"
          >
            <span
              className="block truncate"
              style={{ fontSize: `${Math.min(preset.fontSize * 0.25, 18)}px`, fontWeight: preset.fontWeight }}
            >
              {preset.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsView() {
  const activeProject = useProjectStore((s) => s.getActiveOrNull());
  const setAspectRatio = useProjectStore((s) => s.setAspectRatio);
  const updateSettings = useProjectStore((s) => s.updateSettings);

  if (!activeProject) return <div className="p-4 text-sm text-muted-foreground">Nenhum projeto ativo</div>;

  return (
    <div className="p-3 space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Proporção</label>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {(["16:9", "9:16", "1:1", "4:3"] as const).map((ratio) => (
            <button
              key={ratio}
              onClick={() => setAspectRatio(ratio)}
              className={cn(
                "py-2 text-xs rounded border transition-colors",
                activeProject.settings.aspectRatio === ratio
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
              )}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">FPS</label>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {[24, 30, 60].map((fps) => (
            <button
              key={fps}
              onClick={() => updateSettings({ fps })}
              className={cn(
                "py-2 text-xs rounded border transition-colors",
                activeProject.settings.fps === fps
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
              )}
            >
              {fps}fps
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useProjectStore } from "../stores/project-store";
