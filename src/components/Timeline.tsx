import { useRoomStore } from '../store/useRoomStore';
import type { TimelineAction, TimelineEntry } from '../types';

const TYPE_LABEL: Record<NonNullable<TimelineEntry['itemType']>, string> = {
  code: '代码条',
  sticker: '贴纸',
  stamp: '印章',
  tape: '胶带',
};

const ACTION_LABEL: Record<TimelineAction, string> = {
  add: '贴了',
  delete: '删了',
  move: '动了',
  edit: '改了',
  join: '加入了房间',
  leave: '离开了房间',
};

/** 操作标签配色：贴上 / 修改一眼区分 */
const ACTION_STYLE: Record<
  TimelineAction,
  { bg: string; color: string }
> = {
  add: { bg: '#e2f1e6', color: '#2f7d5b' },
  edit: { bg: '#e4edf9', color: '#3b6fb5' },
  delete: { bg: '#f8e3df', color: '#b2382b' },
  move: { bg: '#efe9dc', color: '#6b6047' },
  join: { bg: 'transparent', color: '#8a7a5c' },
  leave: { bg: 'transparent', color: '#8a7a5c' },
};

/** 只按完整字符截断，补一个省略号，外层再加「」保证有开有合 */
const truncate = (text: string, max = 12) => {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : text;
};

const pad = (n: number) => String(n).padStart(2, '0');

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
};

const isPresence = (action: TimelineAction) =>
  action === 'join' || action === 'leave';

/** 时间线：谁贴了什么 */
export default function Timeline() {
  const timeline = useRoomStore((s) => s.room?.timeline ?? []);
  // 全部条目都渲染（面板内部滚动），表头条数与可见行数保持一致
  const items = [...timeline].reverse();

  if (items.length === 0) {
    return (
      <div style={styles.empty}>
        还没有操作～<br />贴点东西上来吧！
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {items.map((e) => {
        const action = ACTION_STYLE[e.action];
        const presence = isPresence(e.action);
        return (
          <div key={e.id} style={styles.entry}>
            <span style={{ ...styles.dot, background: e.userColor }} />
            <div style={styles.content}>
              <div style={styles.line}>
                <span style={styles.name}>{e.userName}</span>
                <span
                  style={{
                    ...styles.action,
                    ...(presence
                      ? { padding: 0, background: 'transparent' }
                      : {
                          background: action.bg,
                          color: action.color,
                          padding: '0 5px',
                          borderRadius: 4,
                        }),
                  }}
                >
                  {ACTION_LABEL[e.action]}
                </span>
                {!presence && e.itemType && (
                  <span style={styles.target}>{TYPE_LABEL[e.itemType]}</span>
                )}
              </div>
              {!presence && e.itemText && (
                <div style={styles.itemText} title={e.itemText}>
                  「{truncate(e.itemText)}」
                </div>
              )}
            </div>
            <span style={styles.time}>{formatTime(e.timestamp)}</span>
          </div>
        );
      })}
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
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginTop: 5,
    flexShrink: 0,
  },
  content: {
    fontSize: 14,
    lineHeight: 1.45,
    minWidth: 0,
    flex: 1,
    color: 'var(--ink)',
  },
  line: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 3,
    rowGap: 2,
  },
  name: { fontWeight: 700, color: 'var(--ink)' },
  action: { fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' },
  target: { color: 'var(--ink)' },
  itemText: {
    color: 'var(--ink)',
    opacity: 0.78,
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  time: {
    fontSize: 11,
    color: 'var(--ink-soft)',
    fontFamily: 'var(--font-mono)',
    flexShrink: 0,
    marginTop: 2,
  },
};
