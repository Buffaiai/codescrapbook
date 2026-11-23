import { useEffect, useRef, useState } from 'react';
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

  // 卡片整体等比缩放，保证任何屏幕高度下都完整落在一屏内，不需要下滑
  const cardRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  // 屏幕够宽才展示两侧装饰，窄屏隐藏，避免挤到表单
  const [wide, setWide] = useState(() => window.innerWidth >= 980);
  // 屏幕太矮时不铺散落的胶带贴纸，免得钻到表单后面
  const [tall, setTall] = useState(() => window.innerHeight >= 700);
  useEffect(() => {
    const fit = () => {
      const el = cardRef.current;
      setWide(window.innerWidth >= 980);
      setTall(window.innerHeight >= 700);
      if (!el) return;
      const scale = Math.min(
        1,
        (window.innerWidth - 24) / el.offsetWidth,
        (window.innerHeight - 24) / el.offsetHeight,
      );
      setFitScale(scale);
    };
    fit();
    window.addEventListener('resize', fit);
    const ro = new ResizeObserver(fit);
    if (cardRef.current) ro.observe(cardRef.current);
    return () => {
      window.removeEventListener('resize', fit);
      ro.disconnect();
    };
  }, [mode]);

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
      {/* 两侧手账装饰：左右各三件，纵向铺开 */}
      {wide && (
        <div style={styles.bgLayer} aria-label="手账装饰">
          <div style={styles.bgColLeft}>
            <div style={styles.bgCard}>
              <div style={styles.bgCardTape} />
              <div style={styles.bgCardLabel}>JS</div>
              <pre style={styles.bgCardPre}>{`const res = await login();
if (!res.ok) throw '闪退';`}</pre>
              <div style={styles.bgCardMeta}>
                <span style={styles.bgCardNote}>修了登录闪退</span>
                <span style={styles.bgCardTag}>Bug</span>
              </div>
            </div>

            <div style={styles.bgSticker}>跑通了</div>

            <div style={styles.bgCardSmall}>
              <div style={styles.bgCardTapeYellow} />
              <div style={styles.bgCardLabel}>PY</div>
              <pre style={styles.bgCardPre}>{`items = list(set(items))`}</pre>
              <div style={styles.bgCardMeta}>
                <span style={styles.bgCardNote}>去重一行搞定</span>
                <span style={styles.bgCardTagGreen}>学到了</span>
              </div>
            </div>
          </div>

          <div style={styles.bgColRight}>
            <div style={styles.bgStamp}>已合并</div>

            <div style={styles.bgCardAlt}>
              <div style={styles.bgCardTapeBlue} />
              <div style={styles.bgCardLabel}>JS</div>
              <pre style={styles.bgCardPre}>{`const learn = () => '防抖';
console.log(learn());`}</pre>
              <div style={styles.bgCardMeta}>
                <span style={styles.bgCardNote}>面试手写</span>
                <span style={styles.bgCardTagGreen}>学到了</span>
              </div>
            </div>

            <div style={styles.bgMiniRow}>
              <div style={styles.bgStampSmall}>LGTM</div>
              <div style={styles.bgStickerAlt}>review 过了</div>
            </div>
          </div>

          {/* 散落的胶带与贴纸点缀 */}
          {tall && (
            <>
              <div style={styles.scatterTapeA} />
              <div style={styles.scatterTapeB} />
              <div style={styles.scatterTapeC} />
              <div style={styles.scatterTapeD} />
              <div style={styles.scatterTapeEdgeL} />
              <div style={styles.scatterTapeEdgeR} />
              <div style={styles.scatterStickerA}>今天 +1 行</div>
              <div style={styles.scatterStickerB}>摸鱼 5 分钟</div>
              <div style={styles.scatterStamp}>已上线</div>
            </>
          )}
        </div>
      )}

      <div style={{ ...styles.cardScale, transform: `scale(${fitScale})` }}>
        <div ref={cardRef} style={styles.card} className="paper-cut">
          <div style={styles.titleWrap}>
            <h1 style={styles.title}>代码手账本</h1>
            <p style={styles.subtitle}>Code Scrap · 两个人合写一页「今天写了啥」</p>
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
  cardScale: {
    position: 'relative',
    zIndex: 2,
    transformOrigin: 'center center',
  },
  card: {
    width: 420,
    maxWidth: '90vw',
    padding: '36px 34px 30px',
    borderRadius: 6,
    transform: 'rotate(-0.6deg)',
    position: 'relative',
  },
  titleWrap: { textAlign: 'center', marginBottom: 16 },
  bgLayer: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    padding: 'clamp(22px, 4vh, 56px) clamp(28px, 5vw, 96px)',
    overflow: 'hidden',
    opacity: 0.78,
    zIndex: 0,
    pointerEvents: 'none',
  },
  bgColLeft: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  bgColRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bgCard: {
    position: 'relative',
    width: 200,
    background: '#1e1e2e',
    border: '2px solid #f0c674',
    borderRadius: 4,
    padding: '12px 12px 10px',
    color: '#e0def4',
    transform: 'rotate(-5deg)',
    boxShadow: '0 6px 16px rgba(0,0,0,0.16)',
  },
  bgCardAlt: {
    position: 'relative',
    width: 200,
    background: '#1e1e2e',
    border: '2px solid #f0c674',
    borderRadius: 4,
    padding: '12px 12px 10px',
    color: '#e0def4',
    transform: 'rotate(4deg)',
    boxShadow: '0 6px 16px rgba(0,0,0,0.16)',
  },
  bgCardSmall: {
    position: 'relative',
    width: 190,
    background: '#1e1e2e',
    border: '2px solid #7aa2f7',
    borderRadius: 4,
    padding: '12px 12px 10px',
    color: '#e0def4',
    transform: 'rotate(3deg)',
    boxShadow: '0 6px 16px rgba(0,0,0,0.16)',
  },
  bgCardTape: {
    position: 'absolute',
    top: -10,
    left: '50%',
    width: 62,
    height: 18,
    marginLeft: -31,
    background: 'rgba(232, 93, 74, 0.6)',
    transform: 'rotate(-4deg)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  bgCardTapeBlue: {
    position: 'absolute',
    top: -10,
    left: '50%',
    width: 62,
    height: 18,
    marginLeft: -31,
    background: 'rgba(59, 111, 181, 0.55)',
    transform: 'rotate(3deg)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  bgCardTapeYellow: {
    position: 'absolute',
    top: -10,
    left: '50%',
    width: 62,
    height: 18,
    marginLeft: -31,
    background: 'rgba(224, 168, 44, 0.55)',
    transform: 'rotate(-3deg)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  bgCardLabel: {
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
  bgCardPre: {
    margin: 0,
    fontFamily: 'var(--font-mono)',
    fontSize: 10.5,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  bgCardMeta: {
    marginTop: 6,
    paddingTop: 6,
    borderTop: '1px dashed rgba(224,222,244,0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  bgCardNote: {
    color: '#fff3d1',
    fontFamily: 'var(--font-hand)',
    fontSize: 13,
    flex: 1,
  },
  bgCardTag: {
    background: '#f8e3df',
    color: '#b2382b',
    padding: '1px 6px',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: 'var(--font-hand)',
  },
  bgCardTagGreen: {
    background: '#e2f1e6',
    color: '#2f7d5b',
    padding: '1px 6px',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: 'var(--font-hand)',
  },
  bgMiniRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  bgStampSmall: {
    color: '#b2382b',
    border: '2px solid rgba(178,56,43,0.6)',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    padding: '4px 9px',
    borderRadius: 4,
    transform: 'rotate(-5deg)',
    opacity: 0.9,
  },
  bgStickerAlt: {
    background: '#e4edf9',
    color: '#3b6fb5',
    fontFamily: 'var(--font-hand)',
    fontSize: 15,
    fontWeight: 700,
    padding: '6px 12px',
    borderRadius: 3,
    transform: 'rotate(3deg)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
  },
  bgStamp: {
    color: '#2f7d5b',
    border: '3px solid #2f7d5b',
    fontFamily: 'var(--font-hand)',
    fontSize: 20,
    fontWeight: 700,
    padding: '5px 14px',
    borderRadius: 4,
    transform: 'rotate(7deg)',
    opacity: 0.9,
  },
  bgSticker: {
    marginLeft: 26,
    background: '#ffe1a8',
    color: '#6b4a1a',
    fontFamily: 'var(--font-hand)',
    fontSize: 16,
    fontWeight: 700,
    padding: '7px 14px',
    transform: 'rotate(4deg)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
    borderRadius: 3,
  },
  scatterTapeA: {
    position: 'absolute',
    top: '5%',
    left: '32%',
    width: 112,
    height: 22,
    background: 'rgba(232, 93, 74, 0.55)',
    transform: 'rotate(-7deg)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  scatterTapeB: {
    position: 'absolute',
    top: '9%',
    left: '60%',
    width: 92,
    height: 20,
    background: 'rgba(59, 111, 181, 0.5)',
    transform: 'rotate(6deg)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  scatterTapeC: {
    position: 'absolute',
    bottom: '9%',
    left: '29%',
    width: 122,
    height: 22,
    background: 'rgba(47, 125, 91, 0.45)',
    transform: 'rotate(4deg)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  scatterTapeD: {
    position: 'absolute',
    bottom: '6%',
    right: '27%',
    width: 100,
    height: 20,
    background: 'rgba(224, 168, 44, 0.5)',
    transform: 'rotate(-5deg)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  scatterTapeEdgeL: {
    position: 'absolute',
    top: '42%',
    left: '1.2%',
    width: 14,
    height: 108,
    background: 'rgba(232, 93, 74, 0.35)',
    transform: 'rotate(3deg)',
  },
  scatterTapeEdgeR: {
    position: 'absolute',
    top: '48%',
    right: '1%',
    width: 14,
    height: 96,
    background: 'rgba(59, 111, 181, 0.35)',
    transform: 'rotate(-4deg)',
  },
  scatterStickerA: {
    position: 'absolute',
    top: '4%',
    left: '50%',
    marginLeft: -56,
    background: '#ffe1a8',
    color: '#6b4a1a',
    fontFamily: 'var(--font-hand)',
    fontSize: 15,
    fontWeight: 700,
    padding: '6px 13px',
    borderRadius: 3,
    transform: 'rotate(-2deg)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
  },
  scatterStickerB: {
    position: 'absolute',
    bottom: '7%',
    left: '37%',
    background: '#f8e3df',
    color: '#b2382b',
    fontFamily: 'var(--font-hand)',
    fontSize: 15,
    fontWeight: 700,
    padding: '6px 13px',
    borderRadius: 3,
    transform: 'rotate(-3deg)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
  },
  scatterStamp: {
    position: 'absolute',
    bottom: '6%',
    right: '37%',
    color: '#2f7d5b',
    border: '2px solid rgba(47,125,91,0.7)',
    fontFamily: 'var(--font-hand)',
    fontSize: 15,
    fontWeight: 700,
    padding: '3px 11px',
    borderRadius: 4,
    transform: 'rotate(5deg)',
    opacity: 0.85,
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
