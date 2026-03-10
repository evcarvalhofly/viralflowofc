import { Progress } from '@/components/ui/progress';

interface ProcessingOverlayProps {
  label: string;
  progress: number;
}

export function ProcessingOverlay({ label, progress }: ProcessingOverlayProps) {
  return (
    <div className="rounded-xl bg-card border border-border p-6 space-y-3 text-center">
      <div className="flex justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="space-y-1">
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground">{progress}%</p>
      </div>
    </div>
  );
}
