import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import ProfileModal from './ProfileModal';
import { cn } from '@/lib/utils';

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
  is_frozen?: boolean;
}

interface CommunityMapProps {
  profiles: Profile[];
  currentUserId?: string | null;
  onShoppingClick?: () => void;
  is_frozen?: boolean;
}

const CELL_SIZE = 140;
const BASE_MAP_LIMIT = 5;

// CSS de tráfego fora do componente para não ser reinjetado a cada render
const TRAFFIC_CSS = `
@keyframes routeE {
  0%   { transform: translate(-4000px, 20px)   rotate(0deg); }
  46%  { transform: translate(-140px,  20px)   rotate(0deg); }
  46.1%{ transform: translate(-140px,  20px)   rotate(-90deg); }
  48%  { transform: translate(-140px, -140px)  rotate(-90deg); }
  48.1%{ transform: translate(-140px, -140px)  rotate(0deg); }
  51.9%{ transform: translate(140px,  -140px)  rotate(0deg); }
  52%  { transform: translate(140px,  -140px)  rotate(90deg); }
  53.9%{ transform: translate(140px,   20px)   rotate(90deg); }
  54%  { transform: translate(140px,   20px)   rotate(0deg); }
  100% { transform: translate(4000px,  20px)   rotate(0deg); }
}
@keyframes routeW {
  0%   { transform: translate(4000px, -20px)  rotate(180deg); }
  46%  { transform: translate(140px,  -20px)  rotate(180deg); }
  46.1%{ transform: translate(140px,  -20px)  rotate(-90deg); }
  48%  { transform: translate(140px,  140px)  rotate(-90deg); }
  48.1%{ transform: translate(140px,  140px)  rotate(180deg); }
  51.9%{ transform: translate(-140px, 140px)  rotate(180deg); }
  52%  { transform: translate(-140px, 140px)  rotate(90deg); }
  53.9%{ transform: translate(-140px, -20px)  rotate(90deg); }
  54%  { transform: translate(-140px, -20px)  rotate(180deg); }
  100% { transform: translate(-4000px,-20px)  rotate(180deg); }
}
@keyframes routeS {
  0%   { transform: translate(-20px,-4000px) rotate(90deg); }
  46%  { transform: translate(-20px, -140px) rotate(90deg); }
  46.1%{ transform: translate(-20px, -140px) rotate(180deg); }
  48%  { transform: translate(-140px,-140px) rotate(180deg); }
  48.1%{ transform: translate(-140px,-140px) rotate(90deg); }
  51.9%{ transform: translate(-140px, 140px) rotate(90deg); }
  52%  { transform: translate(-140px, 140px) rotate(0deg); }
  53.9%{ transform: translate(-20px,  140px) rotate(0deg); }
  54%  { transform: translate(-20px,  140px) rotate(90deg); }
  100% { transform: translate(-20px, 4000px) rotate(90deg); }
}
@keyframes routeN {
  0%   { transform: translate(20px, 4000px)  rotate(-90deg); }
  46%  { transform: translate(20px,  140px)  rotate(-90deg); }
  46.1%{ transform: translate(20px,  140px)  rotate(0deg); }
  48%  { transform: translate(140px, 140px)  rotate(0deg); }
  48.1%{ transform: translate(140px, 140px)  rotate(-90deg); }
  51.9%{ transform: translate(140px,-140px)  rotate(-90deg); }
  52%  { transform: translate(140px,-140px)  rotate(180deg); }
  53.9%{ transform: translate(20px, -140px)  rotate(180deg); }
  54%  { transform: translate(20px, -140px)  rotate(-90deg); }
  100% { transform: translate(20px,-4000px)  rotate(-90deg); }
}`;

// ─── Sub-components memoizados ────────────────────────────────────────────────

const EmptyLot = React.memo(({ x, y }: { x: number; y: number }) => (
  <div
    className="absolute flex flex-col items-center justify-center pointer-events-none"
    style={{
      left: x * CELL_SIZE,
      top: y * CELL_SIZE,
      width: CELL_SIZE,
      height: CELL_SIZE,
      transform: 'translate(-50%, -50%)',
    }}
  >
    <div
      className="rounded-xl border-dashed flex flex-col items-center justify-center shadow-inner opacity-70"
      style={{ width: 110, height: 110, backgroundColor: '#8bc34a', borderWidth: 3, borderColor: '#7cb342' }}
    >
      <div className="relative opacity-60" style={{ width: 12, height: 16, borderLeftWidth: 3, borderLeftColor: 'rgba(120,53,15,0.4)' }}>
        <div className="absolute rounded-[2px] shadow-sm" style={{ top: 0, left: -10, width: 20, height: 12, backgroundColor: 'rgba(254,243,199,0.8)', border: '1px solid rgba(120,53,15,0.3)' }} />
      </div>
    </div>
  </div>
));

const StreetCell = React.memo(({ x, y, isNight }: { x: number; y: number; isNight: boolean }) => (
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
    {x === 0 && Math.abs(y) > 1 && (
      <div className="absolute top-0 bottom-0 left-1/2 w-1 -translate-x-1/2" style={{ borderLeft: '2px dashed #cbd5e1', opacity: isNight ? 0.3 : 1 }} />
    )}
    {y === 0 && Math.abs(x) > 1 && (
      <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2" style={{ borderTop: '2px dashed #cbd5e1', opacity: isNight ? 0.3 : 1 }} />
    )}
  </div>
));

const LightPole = React.memo(({ x, y }: { x: number; y: number }) => (
  <div className="absolute pointer-events-none z-0" style={{ left: x * CELL_SIZE, top: y * CELL_SIZE }}>
    <svg width="24" height="50" viewBox="0 0 24 50" className="absolute -translate-x-1/2 -translate-y-[90%]">
      <rect x="10" y="45" width="4" height="5" fill="#334155" />
      <rect x="11" y="10" width="2" height="35" fill="#64748b" />
      <rect x="12" y="10" width="8" height="3" fill="#334155" />
      <circle cx="20" cy="12" r="4" fill="#fef08a" />
    </svg>
  </div>
));

const Block = React.memo(({ cx, cy, rx, ry, h, top, left, right }: any) => (
  <g>
    <polygon points={`${cx},${cy} ${cx+rx},${cy+ry} ${cx},${cy+ry*2} ${cx-rx},${cy+ry}`} fill={top} />
    <polygon points={`${cx-rx},${cy+ry} ${cx},${cy+ry*2} ${cx},${cy+ry*2+h} ${cx-rx},${cy+ry+h}`} fill={left} />
    <polygon points={`${cx},${cy+ry*2} ${cx+rx},${cy+ry} ${cx+rx},${cy+ry+h} ${cx},${cy+ry*2+h}`} fill={right} />
  </g>
));

const IsometricBuilding = React.memo(({ nivel, isOnline }: { nivel: number; isOnline: boolean }) => {
  let svgContent: React.ReactNode;
  let glow = '';
  let viewBox = '0 0 60 100';
  let dims = { w: 60, h: 100 };

  if (nivel >= 5) {
    glow = 'drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]';
    viewBox = '0 0 70 160'; dims = { w: 70, h: 160 };
    svgContent = (<>
      <Block cx={35} cy={110} rx={30} ry={15} h={20} top="#d8b4fe" left="#9333ea" right="#7e22ce" />
      <Block cx={35} cy={40}  rx={20} ry={10} h={70} top="#e9d5ff" left="#a855f7" right="#9333ea" />
      <Block cx={35} cy={20}  rx={12} ry={6}  h={20} top="#f3e8ff" left="#c084fc" right="#a855f7" />
      <polygon points="35,0 40,8 35,16 30,8" fill="#a855f7" className="animate-pulse" />
    </>);
  } else if (nivel >= 4) {
    viewBox = '0 0 60 140'; dims = { w: 60, h: 140 };
    svgContent = (<>
      <Block cx={30} cy={100} rx={26} ry={13} h={15} top="#94a3b8" left="#475569" right="#334155" />
      <Block cx={30} cy={40}  rx={20} ry={10} h={60} top="#cbd5e1" left="#64748b" right="#475569" />
      <polygon points="29,20 31,20 31,40 29,40" fill="#cbd5e1" />
    </>);
  } else if (nivel >= 3) {
    viewBox = '0 0 60 110'; dims = { w: 60, h: 110 };
    svgContent = (<>
      <Block cx={30} cy={70} rx={26} ry={13} h={15} top="#6ee7b7" left="#10b981" right="#059669" />
      <Block cx={30} cy={40} rx={22} ry={11} h={30} top="#a7f3d0" left="#34d399" right="#10b981" />
      <polygon points="30,42 38,46 30,50 22,46" fill="#065f46" />
    </>);
  } else if (nivel >= 2) {
    viewBox = '0 0 60 90'; dims = { w: 60, h: 90 };
    svgContent = (<>
      <Block cx={30} cy={55} rx={24} ry={12} h={15} top="#93c5fd" left="#3b82f6" right="#2563eb" />
      <Block cx={30} cy={35} rx={20} ry={10} h={20} top="#bfdbfe" left="#60a5fa" right="#3b82f6" />
    </>);
  } else {
    viewBox = '0 0 60 80'; dims = { w: 60, h: 80 };
    svgContent = (<>
      <Block cx={30} cy={40} rx={22} ry={11} h={15} top="#e2e8f0" left="#cbd5e1" right="#94a3b8" />
      <polygon points="14,56 20,59 20,49 14,46" fill="#64748b" />
      <polygon points="8,51 30,62 30,28"  fill="#f43f5e" />
      <polygon points="30,62 52,51 30,28" fill="#e11d48" />
    </>);
  }

  return (
    <div className={`relative flex flex-col items-center justify-end ${glow} hover:scale-110 transition-transform duration-300 origin-bottom`}>
      <svg width={dims.w} height={dims.h} viewBox={viewBox} className="overflow-visible">
        {svgContent}
      </svg>
      {isOnline && <div className="absolute -top-3 w-2 h-2 bg-green-500 rounded-full border border-black animate-bounce" />}
    </div>
  );
});

const ShoppingMall = React.memo(({ onClick }: { onClick: () => void }) => (
  <div onClick={onClick} style={{ width: CELL_SIZE * 3, height: CELL_SIZE * 3, position: 'absolute', left: 0, top: -30, transform: 'translate(-50%, -50%)', pointerEvents: 'auto', cursor: 'pointer', zIndex: 5 }} className="hover:scale-[1.02] transition-transform duration-500">
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, marginTop: '-80px' }}>
      <svg width="340" height="340" viewBox="0 0 160 160" className="overflow-visible">
        <defs>
          <linearGradient id="mallTop"  x1="0" y1="0" x2="1" y2="1"><stop offset="0%"   stopColor="#818cf8"/><stop offset="100%" stopColor="#6366f1"/></linearGradient>
          <linearGradient id="mallLeft" x1="0" y1="0" x2="0" y2="1"><stop offset="0%"   stopColor="#4f46e5"/><stop offset="100%" stopColor="#3730a3"/></linearGradient>
          <linearGradient id="mallRight"x1="0" y1="0" x2="0" y2="1"><stop offset="0%"   stopColor="#4338ca"/><stop offset="100%" stopColor="#312e81"/></linearGradient>
          <linearGradient id="glassL"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%"   stopColor="#67e8f9" stopOpacity="0.7"/><stop offset="100%" stopColor="#22d3ee" stopOpacity="0.3"/></linearGradient>
          <linearGradient id="glassR"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%"   stopColor="#a5f3fc" stopOpacity="0.5"/><stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2"/></linearGradient>
        </defs>
        <Block cx={80} cy={95} rx={65} ry={32} h={30} top="url(#mallTop)"  left="url(#mallLeft)" right="url(#mallRight)" />
        <Block cx={80} cy={60} rx={48} ry={24} h={35} top="#a5b4fc"        left="url(#mallLeft)" right="url(#mallRight)" />
        <polygon points="80,60 115,77 115,105 80,88"  fill="url(#glassL)" />
        <polygon points="32,84 80,108 80,136 32,112"  fill="url(#glassR)" />
        <line x1="80" y1="70" x2="115" y2="87"  stroke="#c7d2fe" strokeWidth="0.5" opacity="0.6" />
        <line x1="80" y1="80" x2="115" y2="97"  stroke="#c7d2fe" strokeWidth="0.5" opacity="0.6" />
        <line x1="32" y1="92" x2="80"  y2="116" stroke="#c7d2fe" strokeWidth="0.5" opacity="0.4" />
        <line x1="32" y1="100"x2="80"  y2="124" stroke="#c7d2fe" strokeWidth="0.5" opacity="0.4" />
        <polygon points="70,120 80,125 80,136 70,131" fill="#fbbf24" opacity="0.9" />
        <polygon points="80,42 88,48 80,54 72,48" fill="#facc15" className="animate-pulse" />
        <polygon points="80,38 85,42 80,46 75,42" fill="#fde68a" className="animate-pulse" opacity="0.6" />
        <rect x="20" y="16" width="120" height="28" fill="#1e1b4b" rx="6" opacity="0.92" />
        <text x="80" y="33" fontSize="18" fill="#fbbf24" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">SHOPPING</text>
        <text x="80" y="42" fontSize="8"  fill="#e0e7ff" textAnchor="middle" fontWeight="bold" letterSpacing="2">DO EDITOR</text>
      </svg>
    </div>
  </div>
));

const Car = React.memo(({ route, color, delay }: { route: string; color: string; delay: string }) => {
  const bgColors: Record<string, string> = { red:'#ef4444', blue:'#3b82f6', slate:'#334155', yellow:'#facc15', neutral:'#17262b', green:'#22c55e', orange:'#f97316' };
  return (
    <div className="absolute pointer-events-none opacity-90" style={{ left: 0, top: 0, animation: `${route} 18s linear infinite`, animationDelay: delay }}>
      <div className="rounded-[3px]" style={{ backgroundColor: bgColors[color] ?? '#1e293b', width: 22, height: 11, transform: 'translate(-50%, -50%)' }} />
    </div>
  );
});

const TrafficStyles = React.memo(() => <style>{TRAFFIC_CSS}</style>);

const TrafficLayer = React.memo(({ onlineCount }: { onlineCount: number }) => {
  const carCount = Math.max(1, Math.min(onlineCount, 10)); // max 10 carros
  const entities = useMemo(() => {
    const routes = ['routeE','routeW','routeS','routeN'];
    const colors = ['red','blue','slate','yellow','neutral','green','orange'];
    return Array.from({ length: carCount }).map((_, i) => ({
      id: i,
      route: routes[i % 4],
      color: colors[i % 7],
      delay: `-${(i * 9) % 90}s`,
    }));
  }, [carCount]);

  return (
    <div style={{ position: 'relative' }}>
      {entities.map(e => <Car key={e.id} route={e.route} color={e.color} delay={e.delay} />)}
    </div>
  );
});

// ─── Componente de prédio de usuário memoizado ────────────────────────────────
interface BuildingProps {
  profile: Profile & { pos_x: number; pos_y: number };
  isMe: boolean;
  onClick: () => void;
}
const Building = React.memo(({ profile: p, isMe, onClick }: BuildingProps) => (
  <div
    className="building absolute group flex flex-col items-center justify-center hover:scale-110 transition-transform cursor-pointer pointer-events-auto"
    style={{
      zIndex: 20 + p.pos_y,
      left: p.pos_x * CELL_SIZE,
      top: p.pos_y * CELL_SIZE,
      width: CELL_SIZE,
      height: CELL_SIZE,
      transform: 'translate(-50%, -50%)',
    }}
    onClick={onClick}
  >
    {isMe && (
      <div className="absolute flex items-center justify-center pointer-events-none z-0" style={{ inset: 0 }}>
        <div className="animate-pulse flex items-center justify-center" style={{ width: CELL_SIZE - 4, height: CELL_SIZE - 4, border: '4px solid #ef4444', borderRadius: 16, boxShadow: '0 0 30px rgba(239,68,68,0.8), inset 0 0 30px rgba(239,68,68,0.8)' }} />
      </div>
    )}
    <div className={`relative transition-transform duration-300 ease-out ${!p.is_frozen ? 'group-hover:-translate-y-2' : ''}`}>
      <div className={p.is_frozen ? 'grayscale brightness-50 opacity-80' : ''}>
        <IsometricBuilding nivel={p.nivel || 1} isOnline={p.is_online && !p.is_frozen} />
      </div>
    </div>
    <div className="mt-2 text-center flex flex-col items-center z-10 pointer-events-none">
      {p.is_frozen && (
        <span className="text-[9px] font-bold text-black uppercase tracking-wider bg-yellow-500 px-1.5 py-0.5 rounded-t shadow-md mb-[-2px] border border-yellow-600 z-20">
          ⚠ Prédio Suspeito
        </span>
      )}
      <p className={`text-[11px] font-extrabold text-white max-w-[90px] truncate bg-[#050508]/80 px-2 py-0.5 rounded-md border shadow-lg ${p.is_frozen ? 'border-yellow-600/50 text-muted-foreground' : 'border-white/10'}`}>
        {p.display_name || p.nome || 'Visitante'}
      </p>
      <p className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 rounded mt-1 shadow-md">
        LVL {p.nivel || 1}
      </p>
    </div>
  </div>
));

// ─── CommunityMap principal ───────────────────────────────────────────────────
const isInvalidLot = (nx: number, ny: number) => {
  if (nx === 0 || ny === 0) return true;
  if (Math.abs(nx) <= 1 && Math.abs(ny) <= 1) return true;
  return false;
};

const CommunityMap: React.FC<CommunityMapProps> = ({ profiles, currentUserId, onShoppingClick }) => {
  const containerRef  = useRef<HTMLDivElement>(null);
  const zoomDivRef    = useRef<HTMLDivElement>(null);
  const mapLayerRef   = useRef<HTMLDivElement>(null);

  // Estado React usado APENAS para culling e cursor (não para o transform)
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDraggingCursor, setIsDraggingCursor] = useState(false);
  const [isNight, setIsNight] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  // Refs para câmera — atualizados sem React re-render durante o drag
  const panRef   = useRef({ x: 0, y: 0 });
  const zoomRef  = useRef(1);
  const draggingRef = useRef(false);
  const lastPos  = useRef({ x: 0, y: 0 });
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const initialZoomParams = useRef({ dist: 0, zoom: 1 });
  const hasAutoCentered = useRef(false);
  const mapLimitRef = useRef(BASE_MAP_LIMIT);

  // Aplica transform direto no DOM sem React re-render
  const applyCamera = useCallback((
    x = panRef.current.x,
    y = panRef.current.y,
    z = zoomRef.current
  ) => {
    panRef.current  = { x, y };
    zoomRef.current = z;
    if (mapLayerRef.current)
      mapLayerRef.current.style.transform = `translate3d(${x}px,${y}px,0)`;
    if (zoomDivRef.current)
      zoomDivRef.current.style.transform = `scale(${z})`;
  }, []);

  // Sincroniza DOM quando pan/zoom STATE muda (auto-center, etc.)
  useEffect(() => {
    applyCamera(pan.x, pan.y, zoom);
  }, [pan.x, pan.y, zoom, applyCamera]);

  // ── Resize ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      if (containerRef.current)
        setViewport({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Limite do mapa ────────────────────────────────────────────────────────────
  const mapLimit = useMemo(() => {
    let limit = BASE_MAP_LIMIT;
    const totalLots = (limit * 2 + 1) ** 2;
    const invalidCount = (limit * 2 + 1) * 2 - 1 + 8;
    if (profiles.length >= (totalLots - invalidCount) * 0.8) limit += 2;
    mapLimitRef.current = limit;
    return limit;
  }, [profiles.length]);

  // ── Collision resolution — só recalcula quando profiles muda ─────────────────
  const { mappedProfiles, occupiedCells } = useMemo(() => {
    const occupied = new Set<string>();
    const mapped = profiles.map(p => {
      let nx = p.pos_x;
      let ny = p.pos_y;
      let attempts = 0;
      while ((isInvalidLot(nx, ny) || occupied.has(`${nx},${ny}`)) && attempts < 200) {
        if (isInvalidLot(nx, ny)) {
          if (nx === 0) nx += nx >= 0 ? 1 : -1;
          if (ny === 0) ny += ny >= 0 ? 1 : -1;
          if (Math.abs(nx) <= 1 && Math.abs(ny) <= 1) { nx += nx >= 0 ? 1 : -1; ny += ny >= 0 ? 1 : -1; }
        } else {
          nx += nx >= 0 ? 1 : -1;
        }
        attempts++;
      }
      occupied.add(`${nx},${ny}`);
      return { ...p, pos_x: nx, pos_y: ny };
    });
    return { mappedProfiles: mapped, occupiedCells: occupied };
  }, [profiles]);

  // ── Auto-center ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId || hasAutoCentered.current) return;
    const me = mappedProfiles.find(p => p.user_id === currentUserId);
    if (!me) return;
    setPan({ x: -me.pos_x * CELL_SIZE, y: -me.pos_y * CELL_SIZE });
    hasAutoCentered.current = true;
  }, [currentUserId, mappedProfiles]);

  // ── Culling — só recalcula no drag end (pan state só muda aí) ─────────────────
  const { startX, endX, startY, endY, visibleCells } = useMemo(() => {
    if (viewport.width === 0) return { startX: -3, endX: 3, startY: -3, endY: 3, visibleCells: [] };
    const margin = 2;
    const sX = Math.floor((-viewport.width / 2 / zoom - pan.x) / CELL_SIZE) - margin;
    const eX = Math.ceil((viewport.width  / 2 / zoom - pan.x) / CELL_SIZE) + margin;
    const sY = Math.floor((-viewport.height / 2 / zoom - pan.y) / CELL_SIZE) - margin;
    const eY = Math.ceil((viewport.height  / 2 / zoom - pan.y) / CELL_SIZE) + margin;
    const cells: { x: number; y: number }[] = [];
    for (let x = sX; x <= eX; x++)
      for (let y = sY; y <= eY; y++)
        cells.push({ x, y });
    return { startX: sX, endX: eX, startY: sY, endY: eY, visibleCells: cells };
  }, [pan.x, pan.y, zoom, viewport.width, viewport.height, mapLimit]);

  const visibleProfiles = useMemo(
    () => mappedProfiles.filter(p => p.pos_x >= startX && p.pos_x <= endX && p.pos_y >= startY && p.pos_y <= endY),
    [mappedProfiles, startX, endX, startY, endY]
  );

  const onlineCount = useMemo(() => {
    const dbOnline = profiles.filter(p => p.is_online).length;
    const meAlreadyCounted = profiles.some(p => p.user_id === currentUserId && p.is_online);
    return meAlreadyCounted ? dbOnline : dbOnline + (currentUserId ? 1 : 0);
  }, [profiles, currentUserId]);

  // ── Pointer handlers (zero setState durante o drag) ───────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.building')) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1) {
      draggingRef.current = true;
      setIsDraggingCursor(true);
      lastPos.current = { x: e.clientX, y: e.clientY };
    } else if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values());
      initialZoomParams.current = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), zoom: zoomRef.current };
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1 && draggingRef.current) {
      const dx = (e.clientX - lastPos.current.x) / zoomRef.current;
      const dy = (e.clientY - lastPos.current.y) / zoomRef.current;
      const maxPan = mapLimitRef.current * CELL_SIZE;
      applyCamera(
        Math.max(-maxPan, Math.min(maxPan, panRef.current.x + dx)),
        Math.max(-maxPan, Math.min(maxPan, panRef.current.y + dy))
      );
      lastPos.current = { x: e.clientX, y: e.clientY };
    } else if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (initialZoomParams.current.dist > 0) {
        const newZoom = Math.max(0.4, Math.min(initialZoomParams.current.zoom * dist / initialZoomParams.current.dist, 2.0));
        applyCamera(panRef.current.x, panRef.current.y, newZoom);
      }
    }
  }, [applyCamera]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }

    if (activePointers.current.size === 0) {
      draggingRef.current = false;
      setIsDraggingCursor(false);
      // Única atualização de state: sincroniza para re-calcular culling
      setPan({ ...panRef.current });
      setZoom(zoomRef.current);
    } else if (activePointers.current.size === 1) {
      const remaining = Array.from(activePointers.current.values())[0];
      lastPos.current = { x: remaining.x, y: remaining.y };
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const newZoom = Math.max(0.4, Math.min(zoomRef.current + (e.deltaY > 0 ? -0.1 : 0.1), 2.0));
    applyCamera(panRef.current.x, panRef.current.y, newZoom);
    setZoom(newZoom);
  }, [applyCamera]);

  const handleBuildingClick = useCallback((p: Profile) => {
    setSelectedProfile(p);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={cn('w-full h-full relative overflow-hidden transition-colors duration-1000 touch-none', isDraggingCursor ? 'cursor-grabbing' : 'cursor-grab')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{ backgroundColor: isNight ? '#0f172a' : '#7cb342' }}
    >
      {/* Controles */}
      <div className="absolute flex items-center gap-1" style={{ right: '0.75rem', bottom: '0.75rem', zIndex: 60 }}>
        <div className="backdrop-blur-md rounded-full shadow-2xl flex items-center gap-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)', padding: '4px 8px', border: '1px solid rgba(255,255,255,0.15)' }}>
          <button onClick={() => {
            const me = mappedProfiles.find(p => p.user_id === currentUserId);
            if (me) setPan({ x: -me.pos_x * CELL_SIZE, y: -me.pos_y * CELL_SIZE });
          }} className="text-white transition-all flex items-center justify-center gap-1 hover:opacity-80 active:scale-90 px-2" style={{ height: 32, fontSize: 11, fontWeight: 600 }}>🏠 <span className="hidden sm:inline">Meu Prédio</span></button>
          <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <button onClick={() => setIsNight(n => !n)} className="text-white transition-all flex items-center justify-center hover:opacity-80 active:scale-90" style={{ width: 32, height: 32, fontSize: 16 }}>{isNight ? '🌙' : '☀️'}</button>
          <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <button onClick={() => { const z = Math.min(zoomRef.current + 0.2, 2.0); applyCamera(panRef.current.x, panRef.current.y, z); setZoom(z); }} className="text-white font-bold text-lg transition-all flex items-center justify-center hover:opacity-80 active:scale-90" style={{ width: 32, height: 32 }}>+</button>
          <button onClick={() => { const z = Math.max(zoomRef.current - 0.2, 0.4); applyCamera(panRef.current.x, panRef.current.y, z); setZoom(z); }} className="text-white font-bold text-lg transition-all flex items-center justify-center hover:opacity-80 active:scale-90" style={{ width: 32, height: 32 }}>−</button>
        </div>
      </div>

      {/* Badge online */}
      <div className="absolute flex items-center gap-1.5" style={{ left: '0.75rem', bottom: '0.75rem', zIndex: 60 }}>
        <div className="backdrop-blur-md rounded-full shadow-lg flex items-center gap-1.5" style={{ backgroundColor: 'rgba(0,0,0,0.55)', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-white text-[11px] font-semibold">{onlineCount} online</span>
        </div>
      </div>

      {/* Container de zoom — transform gerenciado pelo ref, não pelo React */}
      <div ref={zoomDivRef} className="absolute left-1/2 top-1/2 w-0 h-0" style={{ willChange: 'transform' }}>
        {/* Layer do mapa — transform gerenciado pelo ref, não pelo React */}
        <div
          ref={mapLayerRef}
          className="absolute left-0 top-0 pointer-events-none"
          style={{
            willChange: 'transform',
            filter: isNight ? 'brightness(0.6) contrast(1.1) saturate(1.2)' : 'none',
            transition: 'filter 1000ms ease',
          }}
        >
          <TrafficStyles />

          {/* Chão: ruas, lotes vazios, postes */}
          {visibleCells.map(({ x, y }) => {
            if (Math.abs(x) > mapLimit || Math.abs(y) > mapLimit) return null;
            if (isInvalidLot(x, y)) {
              if (x === 0 && y === 0) return null;
              return <StreetCell key={`s-${x}-${y}`} x={x} y={y} isNight={isNight} />;
            }
            return (
              <React.Fragment key={`c-${x}-${y}`}>
                {!occupiedCells.has(`${x},${y}`) && <EmptyLot x={x} y={y} />}
                <LightPole x={x + 0.5} y={y + 0.5} />
              </React.Fragment>
            );
          })}

          {/* Shopping Mall */}
          <ShoppingMall onClick={() => onShoppingClick?.()} />

          {/* Cerca da cidade */}
          <div className="absolute pointer-events-none" style={{
            left: -mapLimit * CELL_SIZE - CELL_SIZE / 2,
            top:  -mapLimit * CELL_SIZE - CELL_SIZE / 2,
            width:  (mapLimit * 2 + 1) * CELL_SIZE,
            height: (mapLimit * 2 + 1) * CELL_SIZE,
            border: '4px dashed #8B6914',
            borderRadius: 12,
            boxShadow: 'inset 0 0 0 2px rgba(139,105,20,0.3)',
            zIndex: 1,
          }} />

          {/* Tráfego (clipping box) */}
          <div className="absolute pointer-events-none overflow-hidden" style={{
            left: -mapLimit * CELL_SIZE - CELL_SIZE / 2,
            top:  -mapLimit * CELL_SIZE - CELL_SIZE / 2,
            width:  (mapLimit * 2 + 1) * CELL_SIZE,
            height: (mapLimit * 2 + 1) * CELL_SIZE,
            zIndex: 3,
          }}>
            <div className="absolute" style={{ left: mapLimit * CELL_SIZE + CELL_SIZE / 2, top: mapLimit * CELL_SIZE + CELL_SIZE / 2 }}>
              <TrafficLayer onlineCount={onlineCount} />
            </div>
          </div>

          {/* Prédios */}
          {visibleProfiles.map(p => (
            <Building
              key={p.id}
              profile={p}
              isMe={p.user_id === currentUserId}
              onClick={() => handleBuildingClick(p)}
            />
          ))}
        </div>
      </div>

      {/* Modal */}
      {selectedProfile && (
        <ProfileModal
          profile={selectedProfile}
          currentUserId={currentUserId || null}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </div>
  );
};

export default CommunityMap;
