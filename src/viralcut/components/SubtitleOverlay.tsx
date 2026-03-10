import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { SubtitleItem, SubtitleOptions } from '../types';

interface SubtitleOverlayProps {
  currentTime: number;
  subtitles: SubtitleItem[];
  options: SubtitleOptions;
}

export function SubtitleOverlay({ currentTime, subtitles, options }: SubtitleOverlayProps) {
  const active = subtitles.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  if (!active) return null;

  const text =
    options.style === 'caixa-alta' ? active.text.toUpperCase() : active.text;

  const positionStyle: React.CSSProperties =
    options.position === 'top'
      ? { top: '8%', bottom: 'auto' }
      : options.position === 'middle'
      ? { top: '50%', transform: 'translate(-50%, -50%)' }
      : { bottom: '8%' };

  const baseTransform =
    options.position === 'middle'
      ? 'translate(-50%, -50%)'
      : 'translateX(-50%)';

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        transform: baseTransform,
        color: options.color,
        fontSize: options.fontSize,
        fontWeight: 700,
        background:
          options.background || options.style === 'destaque'
            ? 'rgba(0,0,0,0.55)'
            : 'transparent',
        padding: '6px 14px',
        borderRadius: 8,
        textAlign: 'center',
        maxWidth: '88%',
        pointerEvents: 'none',
        letterSpacing: options.style === 'caixa-alta' ? '0.05em' : 'normal',
        textShadow:
          options.style !== 'destaque'
            ? '0 1px 4px rgba(0,0,0,0.7)'
            : 'none',
        lineHeight: 1.3,
        zIndex: 10,
        ...positionStyle,
      }}
    >
      {text}
    </div>
  );
}
