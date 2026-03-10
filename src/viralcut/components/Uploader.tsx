import { useCallback, useRef, useState } from 'react';
import { Upload, Film } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploaderProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
const MAX_SIZE_MB = 500;

export function Uploader({ onFile, disabled }: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (file: File): string | null => {
    if (!ACCEPTED.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|mkv)$/i)) {
      return 'Formato não suportado. Use MP4, MOV, WebM ou MKV.';
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Arquivo muito grande. Máximo ${MAX_SIZE_MB} MB.`;
    }
    return null;
  };

  const handle = useCallback(
    (file: File) => {
      const err = validate(file);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handle(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handle(file);
  };

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer select-none',
        dragging
          ? 'border-primary bg-primary/10'
          : 'border-border hover:border-primary/60 hover:bg-muted/40',
        disabled && 'opacity-50 pointer-events-none'
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
        className="hidden"
        onChange={onInputChange}
        disabled={disabled}
      />
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {dragging ? <Film className="h-8 w-8" /> : <Upload className="h-8 w-8" />}
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">
          {dragging ? 'Solte o vídeo aqui' : 'Arraste ou clique para enviar'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          MP4, MOV, WebM, MKV · máx. {MAX_SIZE_MB} MB
        </p>
      </div>
      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}
    </div>
  );
}
