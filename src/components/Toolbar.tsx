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
  const userCount = Object.keys(room?.users ?? {}).length;

  const handleExport = () => {
    if (!canvasRef.current) return;
    // 先取消选中，避免把手柄/选中框导出进去
    selectItem(null);
    setTimeout(() => exportPng(canvasRef.current!, `手账-${room?.id}.png`), 50);
  };

  const copyRoom = () => {
    if (room) {
      navigator.clipboard.writeText(room.id);
      alert(`房号 ${room.id} 已复制`);
    }
  };

  return (
    <div style={styles.bar} data-ui-hide>
      <div style={styles.left}>
        <span style={styles.logo}>✎ 代码手账本</span>
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
              {u.name.slice(0, 2)}
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
    height: 54,
    background: 'rgba(255,253,247,0.95)',
    borderBottom: '2px solid rgba(120,100,60,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 18px',
    backdropFilter: 'blur(6px)',
  },
  left: { display: 'flex', alignItems: 'center', gap: 16 },
  logo: {
    fontFamily: 'var(--font-hand)',
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  roomBadge: {
    background: 'var(--paper-2)',
    padding: '5px 14px',
    borderRadius: 6,
    fontSize: 16,
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
  },
  users: { display: 'flex', alignItems: 'center', gap: 6 },
  userChip: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
  },
  userCount: { fontSize: 14, color: 'var(--ink-soft)', marginLeft: 6 },
  right: { display: 'flex', gap: 10 },
  btn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 8,
    background: 'var(--user-b)',
    color: '#fff',
    fontSize: 17,
    fontFamily: 'var(--font-hand)',
    boxShadow: '0 2px 0 #246048',
  },
  leaveBtn: {
    background: '#888',
    boxShadow: '0 2px 0 #666',
  },
};
