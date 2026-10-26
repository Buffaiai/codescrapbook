import type { StampItem } from '../types';

/** 印章：红色/深色油墨盖章效果，带"啪"落下动画 */
export default function Stamp({ item }: { item: StampItem }) {
  const isRed = item.text === '搞定';
  const color = isRed ? '#c0392b' : '#2c3e50';
  return (
    <div
      className="stamp-anim"
      style={
        {
          padding: '10px 24px',
          border: `4px solid ${color}`,
          borderRadius: 8,
          fontFamily: 'var(--font-hand)',
          fontSize: 34,
          fontWeight: 700,
          color,
          background: 'transparent',
          letterSpacing: 4,
          position: 'relative',
          // 油墨不均匀感
          opacity: 0.88,
          mixBlendMode: 'multiply',
          filter: 'url(#torn-edge)',
          '--r': `${item.rotation}deg`,
        } as React.CSSProperties
      }
    >
      {item.text}
      {/* 印章点状纹理 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 4,
          background: `repeating-linear-gradient(45deg, ${color}22 0 2px, transparent 2px 6px)`,
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
}
