import { useRoomStore } from '../store/useRoomStore';

/** 时间线：谁贴了什么 */
export default function Timeline() {
  const timeline = useRoomStore((s) => s.room?.timeline ?? []);
  const items = [...timeline].reverse().slice(0, 20);

  if (items.length === 0) {
    return (
      <div style={styles.empty}>
        还没有操作～<br />拖点东西上来吧！
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {items.map((e) => (
        <div key={e.id} style={styles.entry}>
          <span
            style={{
              ...styles.dot,
              background: e.userColor,
            }}
          />
          <div style={styles.content}>
            <span style={styles.name}>{e.userName}</span>
            <span style={styles.action}>
              {e.action === 'add' ? '贴了' : e.action === 'delete' ? '删了' : '动了'}
            </span>
            <span style={styles.target}>
              {e.itemType === 'code' ? '代码条' : e.itemType === 'sticker' ? '贴纸' : e.itemType === 'stamp' ? '印章' : '胶带'}
              {e.itemText ? `「${e.itemText.slice(0, 16)}」` : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: '8px 4px' },
  empty: {
    padding: 16,
    textAlign: 'center',
    color: 'var(--ink-soft)',
    fontSize: 15,
    lineHeight: 1.6,
  },
  entry: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '6px 8px',
    borderBottom: '1px dashed rgba(120,100,60,0.15)',
    animation: 'float-in 0.3s ease-out',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginTop: 5,
    flexShrink: 0,
  },
  content: { fontSize: 14, lineHeight: 1.4 },
  name: { fontWeight: 700, marginRight: 4 },
  action: { color: 'var(--ink-soft)', marginRight: 4 },
  target: {},
};
