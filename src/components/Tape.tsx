import type { TapeItem } from '../types';

/** 和纸胶带：半透明长条，带斜纹 */
export default function Tape({ item }: { item: TapeItem }) {
  return (
    <div
      style={{
        width: item.width,
        height: 38,
        background: item.color,
        opacity: 0.6,
        position: 'relative',
        boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        backgroundImage: `repeating-linear-gradient(
          -45deg,
          ${item.color} 0 8px,
          rgba(255,255,255,0.25) 8px 16px
        )`,
      }}
    >
      {/* 胶带两端锯齿 */}
      <div
        style={{
          position: 'absolute',
          left: -6,
          top: 0,
          bottom: 0,
          width: 6,
          background: item.color,
          clipPath:
            'polygon(0 0, 100% 0, 100% 20%, 0 30%, 100% 40%, 0 50%, 100% 60%, 0 70%, 100% 80%, 0 90%, 100% 100%, 0 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -6,
          top: 0,
          bottom: 0,
          width: 6,
          background: item.color,
          clipPath:
            'polygon(0 0, 100% 0, 100% 100%, 0 100%, 100% 90%, 0 80%, 100% 70%, 0 60%, 100% 50%, 0 40%, 100% 30%, 0 20%, 100% 10%)',
        }}
      />
    </div>
  );
}
