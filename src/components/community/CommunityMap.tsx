import React, { useRef, useState, useEffect, useCallback } from 'react';
import ProfileModal from './ProfileModal';
import { cn } from '@/lib/utils';
// Usando SVGs nativos para visual 2.5D isométrico amigável e MUITO leve

interface Profile {
  id: string;
  display_name?: string;
  nome?: string;
  avatar_url?: string;
  foto_url?: string;
  bio: string;
  nivel: number;
  pos_x: number;
  pos_y: number;
  is_online: boolean;
  habilidades: any;
  servicos: any;
  link1: string;
  link2: string;
}

interface CommunityMapProps {
  profiles: Profile[];
}

const CELL_SIZE = 140; // 140x140 pixels grid cell spacing

const EmptyLot = ({ x, y }: { x: number, y: number }) => (
  <div 
    className="absolute flex flex-col items-center justify-center pointer-events-none group"
    style={{
      left: x * CELL_SIZE,
      top: y * CELL_SIZE,
      width: CELL_SIZE,
      height: CELL_SIZE,
      transform: 'translate(-50%, -50%)'
    }}
  >
    <div className="rounded-xl border-dashed flex flex-col items-center justify-center shadow-inner opacity-70 group-hover:opacity-100 transition-opacity"
         style={{ width: '110px', height: '110px', backgroundColor: '#8bc34a', borderWidth: '3px', borderColor: '#7cb342' }}>
      {/* Placa silenciosa indicando espaço à venda */}
      <div className="relative opacity-60" style={{ width: '12px', height: '16px', borderLeftWidth: '3px', borderLeftColor: 'rgba(120, 53, 15, 0.4)' }}>
        <div className="absolute rounded-[2px] shadow-sm" style={{ top: '0', left: '-10px', width: '20px', height: '12px', backgroundColor: 'rgba(254, 243, 199, 0.8)', border: '1px solid rgba(120, 53, 15, 0.3)' }} />
      </div>
    </div>
  </div>
);

const ShoppingMall = () => (
  <div style={{ width: CELL_SIZE * 3, height: CELL_SIZE * 3, position: 'absolute', left: 0, top: 0, transform: 'translate(-50%, -50%)', pointerEvents: 'auto', cursor: 'pointer', zIndex: 5 }} className="hover:scale-[1.02] transition-transform duration-500">
    {/* Shopping por cima (somente ele sem rotatoria, escalado pra 240px) */}
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
      <svg width="240" height="240" viewBox="0 0 160 160" className="overflow-visible">
         {/* Base do shopping */}
         <Block cx={80} cy={95} rx={65} ry={32} h={30} top="#f1f5f9" left="#cbd5e1" right="#94a3b8" />
         <Block cx={80} cy={60} rx={48} ry={24} h={35} top="#e2e8f0" left="#94a3b8" right="#64748b" />
         {/* Vidros */}
         <polygon points="80,60 115,77 115,105 80,88" fill="#38bdf8" opacity="0.6" />
         <polygon points="32,84 80,108 80,136 32,112" fill="#38bdf8" opacity="0.4" />
         {/* Holograma */}
         <polygon points="80,45 88,50 80,55 72,50" fill="#facc15" className="animate-pulse" />
         <text x="80" y="38" fontSize="14" fill="#fbbf24" textAnchor="middle" fontWeight="bold" style={{ textShadow: '0px 0px 5px #fef08a' }}>SHOPPING</text>
         <text x="80" y="46" fontSize="6" fill="#fff" textAnchor="middle" fontWeight="bold" opacity="0.9">DO CRIADOR</text>
      </svg>
    </div>
  </div>
);

const Car = ({ x, y, dx, color, delay }: any) => {
  const bgColors: any = { red: '#ef4444', blue: '#3b82f6', slate: '#334155', yellow: '#facc15', neutral: '#17262b', green: '#22c55e', orange: '#f97316' };
  
  return (
    <div className="absolute pointer-events-none opacity-90" 
         style={{ zIndex: 1, left: x, top: y, animation: `${dx ? 'driveX' : 'driveY'} 18s linear infinite`, animationDelay: delay }}>
      <div className="rounded-[3px]" style={{ 
          backgroundColor: bgColors[color] || '#1e293b', 
          width: dx ? '22px' : '11px', 
          height: dx ? '11px' : '22px' 
      }} />
    </div>
  );
};

const TrafficLayer = () => {
  const entities = React.useMemo(() => Array.from({length: 30}).map((_, i) => {
    const isX = Math.random() > 0.5;
    const cellLine = (Math.floor(Math.random() * 40 - 20)) * CELL_SIZE - CELL_SIZE/2;
    const start = -6000 + Math.random() * 4000;
    
    // Carros rodam no centro da rua (apenas offset de carro)
    const offset = Math.random() > 0.5 ? 5 : -5;
    
    // Impedir que carros cruzem exatamente por dentro do raio do shopping center
    if (Math.abs(cellLine) < CELL_SIZE * 3) return { id: i, x: -10000, y: -10000, color: 'neutral', dx: false }; // kill

    const cx = isX ? start : cellLine + offset;
    const cy = isX ? cellLine + offset : start;
    const colors = ['red', 'blue', 'slate', 'yellow', 'neutral', 'green', 'orange'];
    return { id: i, x: cx, y: cy, dx: isX, color: colors[Math.floor(Math.random()*7)], delay: `-${Math.random()*90}s` };
  }), []);
  return <>{entities.map(e => <Car key={e.id} {...e} />)}</>;
};

const LightPole = ({ x, y }: { x: number, y: number }) => (
  <div 
    className="absolute pointer-events-none z-0"
    style={{
      left: x * CELL_SIZE,
      top: y * CELL_SIZE,
    }}
  >
    <svg width="24" height="50" viewBox="0 0 24 50" className="absolute -translate-x-1/2 -translate-y-[90%]">
      <rect x="10" y="45" width="4" height="5" fill="#334155" />
      <rect x="11" y="10" width="2" height="35" fill="#64748b" />
      <rect x="12" y="10" width="8" height="3" fill="#334155" />
      <circle cx="20" cy="12" r="4" fill="#fef08a" />
    </svg>
  </div>
);

const Block = ({ cx, cy, rx, ry, h, top, left, right }: any) => (
  <g>
    <polygon points={`${cx},${cy} ${cx+rx},${cy+ry} ${cx},${cy+ry*2} ${cx-rx},${cy+ry}`} fill={top} />
    <polygon points={`${cx-rx},${cy+ry} ${cx},${cy+ry*2} ${cx},${cy+ry*2+h} ${cx-rx},${cy+ry+h}`} fill={left} />
    <polygon points={`${cx},${cy+ry*2} ${cx+rx},${cy+ry} ${cx+rx},${cy+ry+h} ${cx},${cy+ry*2+h}`} fill={right} />
  </g>
);

const IsometricBuilding = ({ nivel, isOnline }: { nivel: number, isOnline: boolean }) => {
  let svgContent;
  let glow = '';
  let viewBox = '0 0 60 100';
  let dims = { w: 60, h: 100 };

  if (nivel >= 5) {
    glow = 'drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]';
    viewBox = '0 0 70 160';
    dims = { w: 70, h: 160 };
    svgContent = (
      <>
        <Block cx={35} cy={110} rx={30} ry={15} h={20} top="#d8b4fe" left="#9333ea" right="#7e22ce" />
        <Block cx={35} cy={40} rx={20} ry={10} h={70} top="#e9d5ff" left="#a855f7" right="#9333ea" />
        <Block cx={35} cy={20} rx={12} ry={6} h={20} top="#f3e8ff" left="#c084fc" right="#a855f7" />
        <polygon points="35,0 40,8 35,16 30,8" fill="#a855f7" className="animate-pulse" />
      </>
    );
  } else if (nivel >= 4) {
    viewBox = '0 0 60 140';
    dims = { w: 60, h: 140 };
    svgContent = (
      <>
        <Block cx={30} cy={100} rx={26} ry={13} h={15} top="#94a3b8" left="#475569" right="#334155" />
        <Block cx={30} cy={40} rx={20} ry={10} h={60} top="#cbd5e1" left="#64748b" right="#475569" />
        <polygon points="29,20 31,20 31,40 29,40" fill="#cbd5e1" />
      </>
    );
  } else if (nivel >= 3) {
    viewBox = '0 0 60 110';
    dims = { w: 60, h: 110 };
    svgContent = (
      <>
        <Block cx={30} cy={70} rx={26} ry={13} h={15} top="#6ee7b7" left="#10b981" right="#059669" />
        <Block cx={30} cy={40} rx={22} ry={11} h={30} top="#a7f3d0" left="#34d399" right="#10b981" />
        <polygon points="30,42 38,46 30,50 22,46" fill="#065f46" />
      </>
    );
  } else if (nivel >= 2) {
    viewBox = '0 0 60 90';
    dims = { w: 60, h: 90 };
    svgContent = (
      <>
        <Block cx={30} cy={55} rx={24} ry={12} h={15} top="#93c5fd" left="#3b82f6" right="#2563eb" />
        <Block cx={30} cy={35} rx={20} ry={10} h={20} top="#bfdbfe" left="#60a5fa" right="#3b82f6" />
      </>
    );
  } else {
    viewBox = '0 0 60 80';
    dims = { w: 60, h: 80 };
    svgContent = (
      <>
        <Block cx={30} cy={40} rx={22} ry={11} h={15} top="#e2e8f0" left="#cbd5e1" right="#94a3b8" />
        {/* Porta ISO */}
        <polygon points="14,56 20,59 20,49 14,46" fill="#64748b" />
        {/* Telhado Piramidal ISO */}
        <polygon points="8,51 30,62 30,28" fill="#f43f5e" />
        <polygon points="30,62 52,51 30,28" fill="#e11d48" />
      </>
    );
  }

  return (
    <div className={`relative flex flex-col items-center justify-end ${glow} hover:scale-110 transition-transform duration-300 origin-bottom`}>
      <svg width={dims.w} height={dims.h} viewBox={viewBox} className="overflow-visible">
        {svgContent}
      </svg>
      {isOnline && (
        <div className="absolute -top-3 w-2 h-2 bg-green-500 rounded-full border border-black animate-bounce" />
      )}
    </div>
  );
};

const CommunityMap: React.FC<CommunityMapProps> = ({ profiles }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // Origem muda para o topo puro pra simplificar pan center
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  // Viewport culling (only render visible buildings)
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (containerRef.current) {
      setViewport({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      // Origem real é (0,0) já garantida pelo css left-1/2 top-1/2
      setPan({ x: 0, y: 0 });
    }
    const handleResize = () => {
      if (containerRef.current) {
        setViewport({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.building')) return;
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    // Usar requestAnimationFrame aqui otimizaria ainda mais, mas o React bate no 60fps sozinho em trees baixas.
    const dx = (e.clientX - lastPos.current.x) / zoom;
    const dy = (e.clientY - lastPos.current.y) / zoom;
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // CULLING & VIRTUALIZATION ALGORITHM - Corrigido para Zoom Pan!
  const leftEdgeX = - (viewport.width / 2) / zoom - pan.x;
  const rightEdgeX = (viewport.width / 2) / zoom - pan.x;
  const topEdgeY = - (viewport.height / 2) / zoom - pan.y;
  const bottomEdgeY = (viewport.height / 2) / zoom - pan.y;

  const marginCells = 2; 
  const startX = Math.floor(leftEdgeX / CELL_SIZE) - marginCells;
  const endX = Math.ceil(rightEdgeX / CELL_SIZE) + marginCells;
  const startY = Math.floor(topEdgeY / CELL_SIZE) - marginCells;
  const endY = Math.ceil(bottomEdgeY / CELL_SIZE) + marginCells;

  const visibleCells = [];
  if (viewport.width > 0) {
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        visibleCells.push({ x, y });
      }
    }
  }

  // Shift profiles coordinate natively outward to leave a 3x3 hole centered at (0, 0) for the perfectly sized Epic Shopping Mall.
  const mappedProfiles = profiles.map(p => {
    let nx = p.pos_x;
    let ny = p.pos_y;
    // Empurra pro lado de fora do centro absoluto 0,0 com buffer de segurança (empurrar >= 2) garantindo zona vazia
    if (nx >= 0) nx += 2; else nx -= 2;
    if (ny >= 0) ny += 2; else ny -= 2;
    return { ...p, pos_x: nx, pos_y: ny };
  });

  const occupiedCells = new Set(mappedProfiles.map(p => `${p.pos_x},${p.pos_y}`));
  // Visually block the entire 3x3 core area (-1 to 1) so lots don't spawn inside the roundabout and mall
  for(let mx = -1; mx <= 1; mx++) {
    for(let my = -1; my <= 1; my++) occupiedCells.add(`${mx},${my}`);
  }

  const visibleProfiles = mappedProfiles.filter(p => {
    return p.pos_x >= startX && p.pos_x <= endX && p.pos_y >= startY && p.pos_y <= endY;
  });

  return (
    <div 
      ref={containerRef}
      className={cn(
        "w-full h-full relative overflow-hidden transition-colors",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ backgroundColor: '#7cb342' }}
    >
      {/* Zoom UI Header Layer puramente inline para escapar do Cache */}
      <div className="absolute flex flex-col gap-4 py-2" style={{ right: '2rem', bottom: '2.5rem', zIndex: 60 }}>
         <div className="backdrop-blur-md rounded-[32px] shadow-2xl flex flex-col gap-2 items-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: '0.5rem', border: '2px solid rgba(255,255,255,0.2)' }}>
            <button onClick={() => setZoom(z => Math.min(z + 0.2, 2.0))} className="text-white font-black text-3xl transition-all flex items-center justify-center hover:opacity-80" style={{ width: '48px', height: '48px' }}>+</button>
            <div style={{ width: '32px', height: '2px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '99px' }} />
            <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))} className="text-white font-black text-3xl transition-all flex items-center justify-center hover:opacity-80" style={{ width: '48px', height: '48px' }}>-</button>
         </div>
      </div>

      {/* Origin Center Wrapper for CSS Scale Zoom native projection */}
      <div className="absolute left-1/2 top-1/2 w-0 h-0 transition-transform duration-300" style={{ transform: `scale(${zoom})` }}>
         {/* Infinite Background Street Mesh Container (Scaled natively with map contents) */}
         <div className="absolute w-[8000px] h-[8000px] left-[-4000px] top-[-4000px] pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #94a3b8 16px, transparent 16px),
                  linear-gradient(to bottom, #94a3b8 16px, transparent 16px)
                `,
                backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
                // Shift background strictly by pan natively aligned to road path
                backgroundPosition: `${pan.x - (CELL_SIZE/2) - 8}px ${pan.y - (CELL_SIZE/2) - 8}px`
              }} 
         />
         
         {/* Hardware Accel Map Layer Content */}
         <div className="absolute left-0 top-0 will-change-transform pointer-events-none" 
              style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0)` }}>
            <style>{`
              @keyframes driveX { 0% { transform: translateX(0); } 100% { transform: translateX(8000px); } }
              @keyframes driveY { 0% { transform: translateY(0); } 100% { transform: translateY(8000px); } }
            `}</style>
        {/* Renderização do Chão: Lotes e Postes PRIMEIRO NA ÁRVORE pra ficar embaixo: */}
        {visibleCells.map(({ x, y }) => {
          // Hide grid elements completely intersecting the giant shopping center [-1 to 1]
          const isMallVoid = x >= -1 && x <= 1 && y >= -1 && y <= 1;
          if (isMallVoid) return null;

          const isOccupied = occupiedCells.has(`${x},${y}`);
          return (
            <React.Fragment key={`cell-${x}-${y}`}>
              {!isOccupied && <EmptyLot x={x} y={y} />}
              <LightPole x={x + 0.5} y={y + 0.5} />
            </React.Fragment>
          );
        })}
        
        {/* Shopping Mall DEPOIS dos terrenos para ficar cobrindo o gramado embaixo: */}
        <ShoppingMall />
        
        {/* Transito também em cima: */}
        <TrafficLayer />

        {/* Prédios e Vizinhos (Vêm por último no array para sobrepor os terrenos) */}
        {visibleProfiles.map(p => (
          <div
            key={p.id}
            className="building absolute group flex flex-col items-center justify-center hover:scale-110 transition-transform cursor-pointer pointer-events-auto"
            style={{
              zIndex: 20 + p.pos_y,
              left: p.pos_x * CELL_SIZE,
              top: p.pos_y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
              transform: 'translate(-50%, -50%)'
            }}
            onClick={(e) => { e.stopPropagation(); setSelectedProfile(p); }}
          >
            {/* Building 2.5D Component */}
            <div className="relative group-hover:-translate-y-2 transition-transform duration-300 ease-out">
              <IsometricBuilding nivel={p.nivel || 1} isOnline={p.is_online} />
            </div>

            {/* User Label Stand */}
            <div className="mt-2 text-center flex flex-col items-center z-10 pointer-events-none">
              <p className="text-[11px] font-extrabold text-white max-w-[90px] truncate bg-[#050508]/80 px-2 py-0.5 rounded-md border border-white/10 shadow-lg">
                {p.display_name || p.nome || 'Visitante'}
              </p>
              <p className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 rounded mt-1 shadow-md">
                LVL {p.nivel || 1}
              </p>
            </div>
          </div>
        ))}
      </div>
      </div>

      {selectedProfile && (
        <ProfileModal 
          profile={selectedProfile} 
          onClose={() => setSelectedProfile(null)} 
        />
      )}
    </div>
  );
};

export default CommunityMap;
