import type { StickerItem } from '../types';

/** 贴纸：撕边便签，手写字体，带阴影 */
export default function Sticker({ item }: { item: StickerItem }) {
  return (
    <div
      style={{
        background: item.color,
        padding: '14px 22px',
        minWidth: 90,
        textAlign: 'center',
        fontFamily: 'var(--font-hand)',
        fontSize: 26,
        fontWeight: 700,
        color: '#3a3226',
        boxShadow: 'var(--shadow-sticker)',
        position: 'relative',
        lineHeight: 1.1,
        filter: 'url(#torn-edge)',
      }}
    >
      {item.text}
      {/* 高光 */}
      <div
        style={{
          position: 'absolute',
          top: 4,
          left: 8,
          right: 8,
          height: 10,
          background: 'rgba(255,255,255,0.35)',
          borderRadius: '50%',
          filter: 'blur(4px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
