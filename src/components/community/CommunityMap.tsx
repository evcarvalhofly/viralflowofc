import React, { useRef, useState, useEffect, useCallback } from 'react';
import ProfileModal from './ProfileModal';
import { cn } from '@/lib/utils';
// Usando SVGs nativos para visual 2.5D isométrico amigável e MUITO leve

interface Profile {
  id: string;
  user_id: string;
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
  currentUserId?: string | null;
  onShoppingClick?: () => void;
}

const CELL_SIZE = 140; // 140x140 pixels grid cell spacing
const BASE_MAP_LIMIT = 5; // Limite mínimo da cidade

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

const StreetCell = ({ x, y, isNight }: { x: number, y: number, isNight: boolean }) => (
  <div
    className="absolute pointer-events-none z-0 overflow-hidden"
    style={{
      left: x * CELL_SIZE,
      top: y * CELL_SIZE,
      width: CELL_SIZE,
      height: CELL_SIZE,
      backgroundColor: isNight ? '#334155' : '#94a3b8',
      transform: 'translate(-50%, -50%)',
    }}
  >
    {/* Marcação da pista vertical central: x===0 && |y|>1 */}
    {x === 0 && Math.abs(y) > 1 && <div className="absolute top-0 bottom-0 left-1/2 w-1 -translate-x-1/2" style={{ borderLeft: '2px dashed #cbd5e1', opacity: isNight ? 0.3 : 1 }} />}
    {/* Marcação da pista horizontal central: y===0 && |x|>1 */}
    {y === 0 && Math.abs(x) > 1 && <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2" style={{ borderTop: '2px dashed #cbd5e1', opacity: isNight ? 0.3 : 1 }} />}
  </div>
);

const ShoppingMall = ({ onClick }: { onClick: () => void }) => (
  <div onClick={onClick} style={{ width: CELL_SIZE * 3, height: CELL_SIZE * 3, position: 'absolute', left: 0, top: -30, transform: 'translate(-50%, -50%)', pointerEvents: 'auto', cursor: 'pointer', zIndex: 5 }} className="hover:scale-[1.02] transition-transform duration-500">
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, marginTop: '-80px' }}>
      <svg width="340" height="340" viewBox="0 0 160 160" className="overflow-visible">
         <defs>
           <linearGradient id="mallTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#818cf8"/><stop offset="100%" stopColor="#6366f1"/></linearGradient>
           <linearGradient id="mallLeft" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f46e5"/><stop offset="100%" stopColor="#3730a3"/></linearGradient>
           <linearGradient id="mallRight" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4338ca"/><stop offset="100%" stopColor="#312e81"/></linearGradient>
           <linearGradient id="glassL" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#67e8f9" stopOpacity="0.7"/><stop offset="100%" stopColor="#22d3ee" stopOpacity="0.3"/></linearGradient>
           <linearGradient id="glassR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.5"/><stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2"/></linearGradient>
         </defs>
         {/* Base ampla com gradiente */}
         <Block cx={80} cy={95} rx={65} ry={32} h={30} top="url(#mallTop)" left="url(#mallLeft)" right="url(#mallRight)" />
         {/* Torre central */}
         <Block cx={80} cy={60} rx={48} ry={24} h={35} top="#a5b4fc" left="url(#mallLeft)" right="url(#mallRight)" />
         {/* Painéis de vidro refletivos */}
         <polygon points="80,60 115,77 115,105 80,88" fill="url(#glassL)" />
         <polygon points="32,84 80,108 80,136 32,112" fill="url(#glassR)" />
         {/* Linhas de andar (detalhe de pisos) */}
         <line x1="80" y1="70" x2="115" y2="87" stroke="#c7d2fe" strokeWidth="0.5" opacity="0.6" />
         <line x1="80" y1="80" x2="115" y2="97" stroke="#c7d2fe" strokeWidth="0.5" opacity="0.6" />
         <line x1="32" y1="92" x2="80" y2="116" stroke="#c7d2fe" strokeWidth="0.5" opacity="0.4" />
         <line x1="32" y1="100" x2="80" y2="124" stroke="#c7d2fe" strokeWidth="0.5" opacity="0.4" />
         {/* Entrada principal */}
         <polygon points="70,120 80,125 80,136 70,131" fill="#fbbf24" opacity="0.9" />
         {/* Holograma topo com brilho */}
         <polygon points="80,42 88,48 80,54 72,48" fill="#facc15" className="animate-pulse" />
         <polygon points="80,38 85,42 80,46 75,42" fill="#fde68a" className="animate-pulse" opacity="0.6" />
         {/* Letreiro com fundo */}
         <rect x="20" y="16" width="120" height="28" fill="#1e1b4b" rx="6" opacity="0.92" />
         <text x="80" y="33" fontSize="18" fill="#fbbf24" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">SHOPPING</text>
         <text x="80" y="42" fontSize="8" fill="#e0e7ff" textAnchor="middle" fontWeight="bold" letterSpacing="2">DO EDITOR</text>
      </svg>
    </div>
  </div>
);

const Car = ({ route, color, delay }: any) => {
  const bgColors: any = { red: '#ef4444', blue: '#3b82f6', slate: '#334155', yellow: '#facc15', neutral: '#17262b', green: '#22c55e', orange: '#f97316' };
  
  return (
    <div className="absolute pointer-events-none opacity-90" 
         style={{ left: 0, top: 0, animation: `${route} 18s linear infinite`, animationDelay: delay }}>
      <div className="rounded-[3px]" style={{ 
          backgroundColor: bgColors[color] || '#1e293b', 
          width: '22px', 
          height: '11px',
          transform: 'translate(-50%, -50%)'
      }} />
    </div>
  );
};

const TrafficLayer = ({ onlineCount }: { onlineCount: number }) => {
  const carCount = Math.max(1, Math.min(onlineCount, 60));
  const entities = React.useMemo(() => Array.from({length: carCount}).map((_, i) => {
    const routes = ['routeE', 'routeW', 'routeS', 'routeN'];
    const colors: any = { 0: 'red', 1: 'blue', 2: 'slate', 3: 'yellow', 4: 'neutral', 5: 'green', 6: 'orange' };
    return { id: i, route: routes[Math.floor(Math.random()*4)], color: colors[Math.floor(Math.random()*7)], delay: `-${Math.random()*90}s` };
  }), [carCount]);

  return (
    <>
      <div style={{ position: 'relative' }}>
        {entities.map(e => <Car key={e.id} {...e} />)}
      </div>
    </>
  );
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

const CommunityMap: React.FC<CommunityMapProps> = ({ profiles, currentUserId, onShoppingClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // Origem muda para o topo puro pra simplificar pan center
  const [zoom, setZoom] = useState(1);
  const [isNight, setIsNight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const hasAutoCentered = useRef(false);

  // Contagem de usuários online (dirige o trânsito e a badge)
  // Garante que o próprio usuário logado sempre conta como online
  const onlineCount = React.useMemo(() => {
    const dbOnline = profiles.filter(p => p.is_online).length;
    const meAlreadyCounted = profiles.some(p => p.user_id === currentUserId && p.is_online);
    return meAlreadyCounted ? dbOnline : dbOnline + (currentUserId ? 1 : 0);
  }, [profiles, currentUserId]);

  // Limite dinâmico do mapa — expande automaticamente quando 80% dos lotes estão ocupados
  const mapLimit = React.useMemo(() => {
    let limit = BASE_MAP_LIMIT;
    // Calcula lotes válidos: total - rodovias - zona do shopping
    const totalLots = (limit * 2 + 1) ** 2;
    const invalidCount = (limit * 2 + 1) * 2 - 1 + 8; // eixos (x=0,y=0) + mall 3x3 excluindo centro
    const available = totalLots - invalidCount;
    if (profiles.length >= available * 0.8) {
      limit += 2;
    }
    return limit;
  }, [profiles.length]);

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

  const activePointers = useRef(new Map<number, {x: number, y: number}>());
  const initialZoomParams = useRef({ dist: 0, zoom: 1 });

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.building')) return;
    
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1) {
      setIsDragging(true);
      lastPos.current = { x: e.clientX, y: e.clientY };
    } else if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialZoomParams.current = { dist, zoom: zoom };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1 && isDragging) {
      const dx = (e.clientX - lastPos.current.x) / zoom;
      const dy = (e.clientY - lastPos.current.y) / zoom;
      const maxPan = mapLimit * CELL_SIZE;
      setPan(prev => ({ 
        x: Math.max(-maxPan, Math.min(maxPan, prev.x + dx)), 
        y: Math.max(-maxPan, Math.min(maxPan, prev.y + dy)) 
      }));
      lastPos.current = { x: e.clientX, y: e.clientY };
    } else if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (initialZoomParams.current.dist > 0) {
        const scale = dist / initialZoomParams.current.dist;
        let newZoom = initialZoomParams.current.zoom * scale;
        newZoom = Math.max(0.4, Math.min(newZoom, 2.0));
        setZoom(newZoom);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    if (activePointers.current.size === 0) {
      setIsDragging(false);
    } else if (activePointers.current.size === 1) {
      const remaining = Array.from(activePointers.current.values())[0];
      lastPos.current = { x: remaining.x, y: remaining.y };
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.max(0.4, Math.min(z + delta, 2.0)));
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

  // Shift mathematical coordinator (Cria as grandes Rodovias cruzadas separando os quarteirões da cidade)
  const isInvalidLot = (nx: number, ny: number) => {
    // Eixos 0 formam a Rodovia Cruz (sem terrenos)
    if (nx === 0 || ny === 0) return true;
    // O anel de Void em torno do Shopping Mall Matrix (Quadrado de 3x3 reservado)
    if (Math.abs(nx) <= 1 && Math.abs(ny) <= 1) return true;
    return false;
  };

  const occupiedCells = new Set<string>();

  const mappedProfiles = profiles.map(p => {
    let nx = p.pos_x;
    let ny = p.pos_y;

    // Resolve as colisões nas Rodovias deslizando dinamicamente para fora de forma espiral-cartesiana
    let attempts = 0;
    while ((isInvalidLot(nx, ny) || occupiedCells.has(`${nx},${ny}`)) && attempts < 200) {
      if (isInvalidLot(nx, ny)) {
        if (nx === 0) nx += nx >= 0 ? 1 : -1;
        if (ny === 0) ny += ny >= 0 ? 1 : -1;
        if (Math.abs(nx) <= 1 && Math.abs(ny) <= 1) {
          nx += nx >= 0 ? 1 : -1;
          ny += ny >= 0 ? 1 : -1;
        }
      } else {
        // Se apenas ocupado, empurra gentilmente no X
        nx += nx >= 0 ? 1 : -1;
      }
      attempts++;
    }
    
    occupiedCells.add(`${nx},${ny}`);
    return { ...p, pos_x: nx, pos_y: ny };
  });

  // Centraliza a Câmera no prédio do usuário atual ao carregar
  useEffect(() => {
    if (!currentUserId || hasAutoCentered.current) return;

    // Busca pelo user_id (não pelo id do perfil)
    const me = mappedProfiles.find(p => p.user_id === currentUserId);
    if (!me) return;

    setPan({ x: -me.pos_x * CELL_SIZE, y: -me.pos_y * CELL_SIZE });
    hasAutoCentered.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, profiles.length]);

  const visibleProfiles = mappedProfiles.filter(p => {
    return p.pos_x >= startX && p.pos_x <= endX && p.pos_y >= startY && p.pos_y <= endY;
  });

  return (
    <div 
      ref={containerRef}
      className={cn(
        "w-full h-full relative overflow-hidden transition-colors duration-1000 touch-none",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{ backgroundColor: isNight ? '#0f172a' : '#7cb342' }}
    >
      {/* Controles compactos horizontais (Mobile-First) */}
      <div className="absolute flex items-center gap-1" style={{ right: '0.75rem', bottom: '0.75rem', zIndex: 60 }}>
         <div className="backdrop-blur-md rounded-full shadow-2xl flex items-center gap-1"
              style={{ backgroundColor: 'rgba(0,0,0,0.55)', padding: '4px 8px', border: '1px solid rgba(255,255,255,0.15)' }}>
            <button onClick={() => {
              const me = mappedProfiles.find(p => p.user_id === currentUserId);
              if (me) setPan({ x: -me.pos_x * CELL_SIZE, y: -me.pos_y * CELL_SIZE });
            }} className="text-white transition-all flex items-center justify-center gap-1 hover:opacity-80 active:scale-90 px-2" style={{ height: '32px', fontSize: '11px', fontWeight: 600 }}>🏠 <span className="hidden sm:inline">Meu Prédio</span></button>
            <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <button onClick={() => setIsNight(n => !n)} className="text-white transition-all flex items-center justify-center hover:opacity-80 active:scale-90" style={{ width: '32px', height: '32px', fontSize: '16px' }}>{isNight ? '🌙' : '☀️'}</button>
            <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <button onClick={() => setZoom(z => Math.min(z + 0.2, 2.0))} className="text-white font-bold text-lg transition-all flex items-center justify-center hover:opacity-80 active:scale-90" style={{ width: '32px', height: '32px' }}>+</button>
            <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))} className="text-white font-bold text-lg transition-all flex items-center justify-center hover:opacity-80 active:scale-90" style={{ width: '32px', height: '32px' }}>−</button>
         </div>
      </div>

      {/* Badge de Usuários Online */}
      <div className="absolute flex items-center gap-1.5" style={{ left: '0.75rem', bottom: '0.75rem', zIndex: 60 }}>
        <div className="backdrop-blur-md rounded-full shadow-lg flex items-center gap-1.5"
             style={{ backgroundColor: 'rgba(0,0,0,0.55)', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-white text-[11px] font-semibold">{onlineCount} online</span>
        </div>
      </div>

      {/* Origin Center Wrapper for CSS Scale Zoom native projection */}
      <div className="absolute left-1/2 top-1/2 w-0 h-0 will-change-transform" style={{ transform: `scale(${zoom})` }}>
         
         {/* Hardware Accel Map Layer Content - Global Dimming with CSS Filters on Night mode! */}
         <div className="absolute left-0 top-0 will-change-transform pointer-events-none" 
              style={{ 
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
                filter: isNight ? 'brightness(0.6) contrast(1.1) saturate(1.2)' : 'none',
                transition: 'filter 1000ms ease'
              }}>
            <style>{`
              @keyframes routeE {
                0% { transform: translate(-4000px, 20px) rotate(0deg); }
                46% { transform: translate(-140px, 20px) rotate(0deg); }
                46.1% { transform: translate(-140px, 20px) rotate(-90deg); }
                48% { transform: translate(-140px, -140px) rotate(-90deg); }
                48.1% { transform: translate(-140px, -140px) rotate(0deg); }
                51.9% { transform: translate(140px, -140px) rotate(0deg); }
                52% { transform: translate(140px, -140px) rotate(90deg); }
                53.9% { transform: translate(140px, 20px) rotate(90deg); }
                54% { transform: translate(140px, 20px) rotate(0deg); }
                100% { transform: translate(4000px, 20px) rotate(0deg); }
              }
              @keyframes routeW {
                0% { transform: translate(4000px, -20px) rotate(180deg); }
                46% { transform: translate(140px, -20px) rotate(180deg); }
                46.1% { transform: translate(140px, -20px) rotate(-90deg); }
                48% { transform: translate(140px, 140px) rotate(-90deg); }
                48.1% { transform: translate(140px, 140px) rotate(180deg); }
                51.9% { transform: translate(-140px, 140px) rotate(180deg); }
                52% { transform: translate(-140px, 140px) rotate(90deg); }
                53.9% { transform: translate(-140px, -20px) rotate(90deg); }
                54% { transform: translate(-140px, -20px) rotate(180deg); }
                100% { transform: translate(-4000px, -20px) rotate(180deg); }
              }
              @keyframes routeS {
                0% { transform: translate(-20px, -4000px) rotate(90deg); }
                46% { transform: translate(-20px, -140px) rotate(90deg); }
                46.1% { transform: translate(-20px, -140px) rotate(180deg); }
                48% { transform: translate(-140px, -140px) rotate(180deg); }
                48.1% { transform: translate(-140px, -140px) rotate(90deg); }
                51.9% { transform: translate(-140px, 140px) rotate(90deg); }
                52% { transform: translate(-140px, 140px) rotate(0deg); }
                53.9% { transform: translate(-20px, 140px) rotate(0deg); }
                54% { transform: translate(-20px, 140px) rotate(90deg); }
                100% { transform: translate(-20px, 4000px) rotate(90deg); }
              }
              @keyframes routeN {
                0% { transform: translate(20px, 4000px) rotate(-90deg); }
                46% { transform: translate(20px, 140px) rotate(-90deg); }
                46.1% { transform: translate(20px, 140px) rotate(0deg); }
                48% { transform: translate(140px, 140px) rotate(0deg); }
                48.1% { transform: translate(140px, 140px) rotate(-90deg); }
                51.9% { transform: translate(140px, -140px) rotate(-90deg); }
                52% { transform: translate(140px, -140px) rotate(180deg); }
                53.9% { transform: translate(20px, -140px) rotate(180deg); }
                54% { transform: translate(20px, -140px) rotate(-90deg); }
                100% { transform: translate(20px, -4000px) rotate(-90deg); }
              }
            `}</style>
        {/* Renderização do Chão: Lotes, Ruas e Postes PRIMEIRO NA ÁRVORE pra ficar embaixo: */}
        {visibleCells.map(({ x, y }) => {
          // Limita a existência de lotes e rua à margem finita da cidade
          if (Math.abs(x) > mapLimit || Math.abs(y) > mapLimit) return null;

          // Desenho da Rodovia de Asfalto!
          if (isInvalidLot(x, y)) {
            if (x === 0 && y === 0) return null; // Shopping Matrix fica no (0,0), não desenha chão nele!
            return <StreetCell key={`street-${x}-${y}`} x={x} y={y} isNight={isNight} />;
          }

          const isOccupied = occupiedCells.has(`${x},${y}`);
          return (
            <React.Fragment key={`cell-${x}-${y}`}>
              {!isOccupied && <EmptyLot x={x} y={y} />}
              <LightPole x={x + 0.5} y={y + 0.5} />
            </React.Fragment>
          );
        })}
        
        {/* Shopping Mall DEPOIS dos terrenos para ficar cobrindo o gramado embaixo: */}
        <ShoppingMall onClick={() => onShoppingClick?.()} />

        {/* Cerca delimitando a cidade */}
        <div className="absolute pointer-events-none" style={{
            left: -mapLimit * CELL_SIZE - CELL_SIZE / 2,
            top: -mapLimit * CELL_SIZE - CELL_SIZE / 2,
            width: (mapLimit * 2 + 1) * CELL_SIZE,
            height: (mapLimit * 2 + 1) * CELL_SIZE,
            border: '4px dashed #8B6914',
            borderRadius: '12px',
            boxShadow: 'inset 0 0 0 2px rgba(139,105,20,0.3)',
            zIndex: 1,
          }} />
        
        {/* Caixa de Colisão (Clipping Mask) para bater os carros no final da cidade limite! */}
        <div className="absolute pointer-events-none overflow-hidden" style={{
            left: -mapLimit * CELL_SIZE - CELL_SIZE/2,
            top: -mapLimit * CELL_SIZE - CELL_SIZE/2,
            width: (mapLimit * 2 + 1) * CELL_SIZE,
            height: (mapLimit * 2 + 1) * CELL_SIZE,
            zIndex: 3
          }}>
          <div className="absolute" style={{ left: mapLimit * CELL_SIZE + CELL_SIZE/2, top: mapLimit * CELL_SIZE + CELL_SIZE/2 }}>
            <TrafficLayer onlineCount={onlineCount} />
          </div>
        </div>

        {/* Prédios e Vizinhos (Vêm por último no array para sobrepor os terrenos) */}
        {visibleProfiles.map(p => {
          const isMe = p.user_id === currentUserId;
          return (
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
            {/* Terreno Highlight do Usuário Atual (Borda Vibrante Exata do Mapa) */}
            {isMe && (
              <div className="absolute flex items-center justify-center pointer-events-none z-0" style={{ inset: 0 }}>
                 <div className="animate-pulse flex items-center justify-center p-0 m-0" style={{ width: CELL_SIZE - 4, height: CELL_SIZE - 4, border: '4px solid #ef4444', borderRadius: '16px', boxShadow: '0 0 30px rgba(239,68,68,0.8), inset 0 0 30px rgba(239,68,68,0.8)' }} />
              </div>
            )}

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
        )})}
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
