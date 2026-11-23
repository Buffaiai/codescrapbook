import { useRoomStore } from '../store/useRoomStore';
import { exportPng } from '../utils/exportPng';

interface Props {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onLeave: () => void;
}

export default function Toolbar({ canvasRef, onLeave }: Props) {
  const room = useRoomStore((s) => s.room);
  const me = useRoomStore((s) => s.me);
  const selectItem = useRoomStore((s) => s.selectItem);
  const showToast = useRoomStore((s) => s.showToast);
  const userCount = Object.keys(room?.users ?? {}).length;

  const handleExport = async () => {
    if (!canvasRef.current) return;
    // 先取消选中，避免把手柄/选中框导出进去
    selectItem(null);
    await new Promise((r) => setTimeout(r, 60));
    const ok = await exportPng(
      canvasRef.current,
      `手账-${room?.id ?? ''}.png`,
    );
    showToast(ok ? '已导出 PNG' : '导出失败，请重试', {
      kind: ok ? 'info' : 'error',
    });
  };

  const copyRoom = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.id);
      showToast('房号已复制');
    } catch {
      showToast(`房号：${room.id}`, { duration: 3000 });
    }
  };

  return (
    <div className="sb-toolbar" style={styles.bar} data-ui-hide>
      <div style={styles.left}>
        <span className="sb-logo" style={styles.logo}>✎ 代码手账本</span>
        <div style={styles.roomBadge} onClick={copyRoom} title="点击复制房号">
          房间 <b>{room?.id}</b>
        </div>
        <div style={styles.users}>
          {Object.values(room?.users ?? {}).map((u) => (
            <span
              key={u.id}
              style={{
                ...styles.userChip,
                background: u.color,
                outline: u.id === me?.id ? '2px solid #3a3226' : 'none',
              }}
              title={u.name}
            >
              {u.name}
            </span>
          ))}
          <span style={styles.userCount}>{userCount} 人在线</span>
        </div>
      </div>

      <div style={styles.right}>
        <button style={styles.btn} onClick={handleExport}>
          ⬇ 导出 PNG
        </button>
        <button style={{ ...styles.btn, ...styles.leaveBtn }} onClick={onLeave}>
          离开
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    minHeight: 54,
    background: 'rgba(255,253,247,0.95)',
    borderBottom: '2px solid rgba(120,100,60,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 18px',
    backdropFilter: 'blur(6px)',
    gap: 10,
    flexShrink: 0,
  },
  left: { display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 },
  logo: {
    fontFamily: 'var(--font-hand)',
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--ink)',
    whiteSpace: 'nowrap',
  },
  roomBadge: {
    background: 'var(--paper-2)',
    padding: '5px 14px',
    borderRadius: 6,
    fontSize: 16,
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
  },
  users: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  userChip: {
    minWidth: 26,
    height: 26,
    padding: '0 10px',
    borderRadius: 13,
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userCount: {
    fontSize: 14,
    color: 'var(--ink-soft)',
    marginLeft: 6,
    whiteSpace: 'nowrap',
  },
  right: { display: 'flex', gap: 10, flexShrink: 0 },
  btn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 8,
    background: 'var(--user-b)',
    color: '#fff',
    fontSize: 17,
    fontFamily: 'var(--font-hand)',
    boxShadow: '0 2px 0 #246048',
    whiteSpace: 'nowrap',
  },
  leaveBtn: {
    background: '#888',
    boxShadow: '0 2px 0 #666',
  },
};
