import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowPrompt(false);
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[100] animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-card border border-border p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Download className="text-primary-foreground w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Instalar App</p>
            <p className="text-[10px] text-muted-foreground">Melhore a velocidade de exportação</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleInstall} className="h-8 px-4 text-xs">Instalar</Button>
          <button onClick={() => setShowPrompt(false)} className="text-muted-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
