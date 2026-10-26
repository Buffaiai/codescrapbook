import { useState } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { genRoomId, uid } from '../utils/id';
import type { User } from '../types';

const PALETTE = [
  '#e85d4a',
  '#2f7d5b',
  '#3b6fb5',
  '#c472e0',
  '#e08a2c',
  '#5f9e6e',
];

export default function Home({ onEnter }: { onEnter: () => void }) {
  const createRoom = useRoomStore((s) => s.createRoom);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [roomInput, setRoomInput] = useState('');
  const [error, setError] = useState('');

  const enter = () => {
    if (!name.trim()) {
      setError('先写个昵称呗');
      return;
    }
    const user: User = { id: uid(), name: name.trim(), color };
    if (mode === 'create') {
      const roomId = genRoomId();
      createRoom(roomId, user);
    } else {
      if (!/^\d{4}$/.test(roomInput)) {
        setError('房号是 4 位数字');
        return;
      }
      createRoom(roomInput, user); // join 复用 createRoom（会加载已有房间）
    }
    onEnter();
  };

  return (
    <div className="paper-bg" style={styles.wrap}>
      {/* 装饰胶带 */}
      <div style={styles.tape1} />
      <div style={styles.tape2} />

      <div style={styles.card} className="paper-cut">
        <div style={styles.titleWrap}>
          <h1 style={styles.title}>代码手账本</h1>
          <p style={styles.subtitle}>Code Scrap · 两个人合写一页「今天写了啥」</p>
        </div>

        {/* 模式切换 */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(mode === 'create' ? styles.tabActive : {}) }}
            onClick={() => setMode('create')}
          >
            新建房间
          </button>
          <button
            style={{ ...styles.tab, ...(mode === 'join' ? styles.tabActive : {}) }}
            onClick={() => setMode('join')}
          >
            加入房间
          </button>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>昵称</label>
          <input
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="比如：阿橘"
            maxLength={10}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>贴纸色</label>
          <div style={styles.colorRow}>
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  ...styles.colorDot,
                  background: c,
                  border: color === c ? '3px solid #3a3226' : '3px solid transparent',
                  transform: color === c ? 'scale(1.15)' : 'scale(1)',
                }}
                aria-label={`颜色 ${c}`}
              />
            ))}
          </div>
        </div>

        {mode === 'join' && (
          <div style={styles.field}>
            <label style={styles.label}>4 位房号</label>
            <input
              style={styles.input}
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              inputMode="numeric"
            />
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <button style={styles.enterBtn} onClick={enter}>
          {mode === 'create' ? '✎ 开始写手账' : '🚪 加入房间'}
        </button>

        <p style={styles.hint}>
          提示：在另一台设备输入同房号即可实时协作 · 数据云端同步
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tape1: {
    position: 'absolute',
    top: '12%',
    left: '8%',
    width: 120,
    height: 28,
    background: 'rgba(232, 93, 74, 0.55)',
    transform: 'rotate(-8deg)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
    zIndex: 1,
  },
  tape2: {
    position: 'absolute',
    bottom: '14%',
    right: '10%',
    width: 140,
    height: 28,
    background: 'rgba(47, 125, 91, 0.5)',
    transform: 'rotate(6deg)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
    zIndex: 1,
  },
  card: {
    width: 420,
    maxWidth: '90vw',
    padding: '36px 34px 30px',
    borderRadius: 6,
    transform: 'rotate(-0.6deg)',
    position: 'relative',
    zIndex: 2,
  },
  titleWrap: { textAlign: 'center', marginBottom: 22 },
  title: {
    fontFamily: "var(--font-hand)",
    fontSize: 44,
    margin: 0,
    color: 'var(--ink)',
    letterSpacing: 1,
  },
  subtitle: {
    margin: '4px 0 0',
    color: 'var(--ink-soft)',
    fontSize: 16,
  },
  tabs: {
    display: 'flex',
    gap: 8,
    marginBottom: 22,
    background: 'rgba(0,0,0,0.04)',
    padding: 4,
    borderRadius: 8,
  },
  tab: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    padding: '10px 0',
    borderRadius: 6,
    fontSize: 18,
    color: 'var(--ink-soft)',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: '#fffdf7',
    color: 'var(--ink)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  },
  field: { marginBottom: 16 },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 17,
    color: 'var(--ink-soft)',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '2px solid rgba(120,100,60,0.25)',
    borderRadius: 8,
    fontSize: 18,
    fontFamily: 'var(--font-hand)',
    background: '#fffdf7',
    color: 'var(--ink)',
    outline: 'none',
  },
  colorRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    transition: 'all 0.18s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
  },
  error: {
    color: '#c0392b',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  enterBtn: {
    width: '100%',
    padding: '14px 0',
    marginTop: 8,
    border: 'none',
    borderRadius: 10,
    background: 'var(--user-a)',
    color: '#fff',
    fontSize: 22,
    fontFamily: 'var(--font-hand)',
    boxShadow: '0 4px 0 #b94a3a, 0 6px 12px rgba(0,0,0,0.15)',
    transition: 'transform 0.1s',
  },
  hint: {
    textAlign: 'center',
    color: 'var(--ink-soft)',
    fontSize: 14,
    marginTop: 16,
    lineHeight: 1.6,
  },
};
