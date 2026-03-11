import { Scissors } from 'lucide-react';

const ViralCut = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <Scissors className="h-12 w-12 text-primary mb-4" />
      <h1 className="text-2xl font-bold text-foreground mb-2">ViralCut</h1>
      <p className="text-muted-foreground">Em breve — editor automático de vídeo.</p>
    </div>
  );
};

export default ViralCut;
