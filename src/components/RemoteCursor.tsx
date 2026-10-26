import type { CursorState } from '../types';

/** 对方光标（幽灵手）：带昵称气泡 */
export default function RemoteCursor({ cursor }: { cursor: CursorState }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: cursor.x,
        top: cursor.y,
        pointerEvents: 'none',
        zIndex: 99999,
        transform: 'translate(-2px, -2px)',
      }}
    >
      {/* 手型光标 SVG */}
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path
          d="M4 2 L4 17 L8 13 L11 19 L13 18 L10 12 L15 12 Z"
          fill={cursor.color}
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 18,
          top: 14,
          background: cursor.color,
          color: '#fff',
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 13,
          fontFamily: 'var(--font-hand)',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        {cursor.userName}
      </div>
    </div>
  );
}
