import { useState } from 'react';
import { genRoomId, uid } from '../utils/id';
import {
  loadProfile,
  loadLastRoom,
  saveProfile,
  saveLastRoom,
  setRoomInUrl,
} from '../utils/session';
import { checkRoomRemote, enterRoomRemote } from '../store/useSync';
import type { User } from '../types';

const PALETTE = [
  '#e85d4a',
  '#2f7d5b',
  '#3b6fb5',
  '#c472e0',
  '#e08a2c',
  '#5f9e6e',
];

const NOT_FOUND = '房间不存在，请核对房号';

export default function Home({ onEnter }: { onEnter: () => void }) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState(() => loadProfile()?.name ?? '');
  const [color, setColor] = useState(() => loadProfile()?.color ?? PALETTE[0]);
  const [roomInput, setRoomInput] = useState('');
  const [lastRoom] = useState(() => loadLastRoom());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 进入成功：记住昵称/贴纸色与上次房间，并把房号写进 URL
  const finish = (roomId: string, user: User) => {
    saveProfile({ name: user.name, color: user.color });
    saveLastRoom(roomId);
    setRoomInUrl(roomId);
    onEnter();
  };

  const makeUser = (): User => ({ id: uid(), name: name.trim(), color });

  const enter = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError('先写个昵称呗');
      return;
    }
    setError('');
    const user = makeUser();
    setBusy(true);
    try {
      if (mode === 'create') {
        let created = false;
        let failMessage = '创建房间失败，请重试';
        // 房号可能撞车，重试几次
        for (let i = 0; i < 8 && !created; i += 1) {
          const roomId = genRoomId();
          const res = await enterRoomRemote(roomId, user, 'create');
          if (res.ok) {
            created = true;
            finish(roomId, user);
          } else if (res.code !== 'ROOM_EXISTS') {
            failMessage = res.message;
            break;
          }
        }
        if (!created) setError(failMessage);
      } else {
        if (!/^\d{4}$/.test(roomInput)) {
          setError('房号是 4 位数字');
          return;
        }
        // 先校验房间是否存在，只有“新建房间”才能建房
        const exists = await checkRoomRemote(roomInput);
        if (!exists) {
          setError(NOT_FOUND);
          return;
        }
        const res = await enterRoomRemote(roomInput, user, 'join');
        if (!res.ok) {
          setError(res.code === 'ROOM_NOT_FOUND' ? NOT_FOUND : '加入失败，请重试');
          return;
        }
        finish(roomInput, user);
      }
    } catch {
      setError('连不上服务器，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  // 一键回到上次房间
  const resume = async () => {
    if (busy || !lastRoom) return;
    if (!name.trim()) {
      setError('先写个昵称呗');
      return;
    }
    setError('');
    const user = makeUser();
    setBusy(true);
    try {
      const exists = await checkRoomRemote(lastRoom);
      if (!exists) {
        setError(NOT_FOUND);
        return;
      }
      const res = await enterRoomRemote(lastRoom, user, 'join');
      if (!res.ok) {
        setError(res.code === 'ROOM_NOT_FOUND' ? NOT_FOUND : '加入失败，请重试');
        return;
      }
      finish(lastRoom, user);
    } catch {
      setError('连不上服务器，请稍后重试');
    } finally {
      setBusy(false);
    }
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

        {/* 成品示例图：双人代码 + 贴纸 + 印章 */}
        <div style={styles.previewWrap} aria-label="成品手账示例图">
          <div style={styles.previewImage} aria-hidden>
            {/* 左上代码卡 */}
            <div style={styles.previewCodeA}>
              <div style={styles.previewCodeLabel}>JS</div>
              <pre style={styles.previewPre}>{`const bug = await fetch('/login');
if (!bug.ok) { console.error('闪退'); }`}</pre>
              <div style={styles.previewMeta}>
                <span style={styles.previewNote}>修了登录闪退</span>
                <span style={styles.previewTagRed}>Bug</span>
              </div>
            </div>
            {/* 左下贴纸 */}
            <div style={styles.previewSticker}>今天没写代码</div>
            {/* 右上印章 */}
            <div style={styles.previewStamp}>已合并</div>
            {/* 右下代码卡 */}
            <div style={styles.previewCodeB}>
              <div style={styles.previewCodeLabel}>JS</div>
              <pre style={styles.previewPre}>{`const learn = () => '学会了防抖';
console.log(learn());`}</pre>
              <div style={styles.previewMeta}>
                <span style={styles.previewNote}>面试手写</span>
                <span style={styles.previewTagGreen}>学到了</span>
              </div>
            </div>
            {/* 胶带装饰 */}
            <div style={styles.previewTapeA} />
            <div style={styles.previewTapeB} />
          </div>
        </div>

        {/* 继续上次房间 */}
        {lastRoom && (
          <button style={styles.resume} onClick={resume} disabled={busy}>
            <span>
              继续回到房间 <b style={styles.resumeId}>{lastRoom}</b>
            </span>
            <span style={styles.resumeArrow}>→</span>
          </button>
        )}

        {/* 模式切换 */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(mode === 'create' ? styles.tabActive : {}) }}
            onClick={() => {
              setMode('create');
              setError('');
            }}
          >
            新建房间
          </button>
          <button
            style={{ ...styles.tab, ...(mode === 'join' ? styles.tabActive : {}) }}
            onClick={() => {
              setMode('join');
              setError('');
            }}
          >
            加入房间
          </button>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>昵称</label>
          <input
            style={styles.input}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
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
              onChange={(e) => {
                setRoomInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                if (error) setError('');
              }}
              placeholder="1234"
              inputMode="numeric"
            />
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <button style={styles.enterBtn} onClick={enter} disabled={busy}>
          {mode === 'create' ? '✎ 开始写手账' : busy ? '校验房号…' : '🚪 加入房间'}
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
    overflow: 'hidden',
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
    maxHeight: '92vh',
    overflowY: 'auto',
  },
  titleWrap: { textAlign: 'center', marginBottom: 16 },
  previewWrap: {
    margin: '4px 0 22px',
  },
  previewImage: {
    position: 'relative',
    width: '100%',
    height: 200,
    background: '#fffdf7',
    border: '1px solid rgba(120,100,60,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.8)',
  },
  previewCodeA: {
    position: 'absolute',
    top: 20,
    left: 16,
    width: 170,
    background: '#1e1e2e',
    border: '2px solid #f0c674',
    borderRadius: 4,
    padding: '10px 12px',
    color: '#e0def4',
    transform: 'rotate(-5deg)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.18)',
  },
  previewCodeB: {
    position: 'absolute',
    bottom: 18,
    right: 16,
    width: 170,
    background: '#1e1e2e',
    border: '2px solid #f0c674',
    borderRadius: 4,
    padding: '10px 12px',
    color: '#e0def4',
    transform: 'rotate(3deg)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.18)',
  },
  previewCodeLabel: {
    position: 'absolute',
    top: -8,
    left: 8,
    background: '#f0c674',
    color: '#1e1e2e',
    fontSize: 9,
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    padding: '1px 6px',
    borderRadius: 3,
    letterSpacing: 1,
  },
  previewPre: {
    margin: 0,
    fontFamily: 'var(--font-mono)',
    fontSize: 10.5,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  previewMeta: {
    marginTop: 6,
    paddingTop: 6,
    borderTop: '1px dashed rgba(224,222,244,0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  previewNote: {
    color: '#fff3d1',
    fontFamily: 'var(--font-hand)',
    fontSize: 13,
    flex: 1,
  },
  previewTagRed: {
    background: '#f8e3df',
    color: '#b2382b',
    padding: '1px 6px',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: 'var(--font-hand)',
  },
  previewTagGreen: {
    background: '#e2f1e6',
    color: '#2f7d5b',
    padding: '1px 6px',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: 'var(--font-hand)',
  },
  previewSticker: {
    position: 'absolute',
    top: 120,
    left: 90,
    background: '#ffe1a8',
    color: '#6b4a1a',
    fontFamily: 'var(--font-hand)',
    fontSize: 18,
    fontWeight: 700,
    padding: '10px 16px',
    transform: 'rotate(4deg)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
    borderRadius: 3,
  },
  previewStamp: {
    position: 'absolute',
    top: 50,
    right: 24,
    color: '#2f7d5b',
    border: '3px solid #2f7d5b',
    fontFamily: 'var(--font-hand)',
    fontSize: 22,
    fontWeight: 700,
    padding: '6px 16px',
    borderRadius: 4,
    transform: 'rotate(8deg)',
    opacity: 0.85,
  },
  previewTapeA: {
    position: 'absolute',
    top: 0,
    left: 60,
    width: 70,
    height: 18,
    background: 'rgba(232, 93, 74, 0.65)',
    transform: 'rotate(-10deg)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  },
  previewTapeB: {
    position: 'absolute',
    bottom: 0,
    right: 50,
    width: 80,
    height: 18,
    background: 'rgba(59, 111, 181, 0.55)',
    transform: 'rotate(7deg)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  },
  resume: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
    padding: '10px 14px',
    border: '2px dashed rgba(120,100,60,0.35)',
    borderRadius: 8,
    background: 'rgba(255, 235, 190, 0.55)',
    color: 'var(--ink)',
    fontSize: 17,
    fontFamily: 'var(--font-hand)',
    cursor: 'pointer',
  },
  resumeId: {
    fontFamily: 'var(--font-mono)',
    fontSize: 18,
    letterSpacing: 1,
  },
  resumeArrow: { fontSize: 20, color: 'var(--ink-soft)' },
  title: {
    fontFamily: 'var(--font-hand)',
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
