import { useRef, useMemo } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { useSync, makeItem, broadcastCursor } from '../store/useSync';
import Toolbar from './Toolbar';
import Drawer from './Drawer';
import CanvasItem from './CanvasItem';
import CodeStrip from './CodeStrip';
import Sticker from './Sticker';
import Stamp from './Stamp';
import Tape from './Tape';
import RemoteCursor from './RemoteCursor';
import Timeline from './Timeline';
import type { Item, ItemType, CodeItem, StickerItem, StampItem, TapeItem } from '../types';

interface Props {
  onLeave: () => void;
}

export default function Scrapbook({ onLeave }: Props) {
  useSync();
  const room = useRoomStore((s) => s.room);
  const me = useRoomStore((s) => s.me);
  const cursors = useRoomStore((s) => s.cursors);
  const selectItem = useRoomStore((s) => s.selectItem);
  const addItem = useRoomStore((s) => s.addItem);
  const canvasRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => Object.values(room?.items ?? {}), [room?.items]);
  const maxZ = useMemo(
    () => items.reduce((m, it) => Math.max(m, it.z), 0),
    [items],
  );

  // 拖放：从抽屉把素材放到画布上
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw || !me || !canvasRef.current) return;
    const { type, payload } = JSON.parse(raw) as {
      type: ItemType;
      payload: Record<string, unknown>;
    };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const common = {
      x,
      y,
      rotation: type === 'tape' ? 0 : Math.round((Math.random() - 0.5) * 10),
      scale: 1,
      authorId: me.id,
    };

    let item: Item;
    if (type === 'code') {
      item = makeItem<CodeItem>(
        { ...common, type: 'code', text: payload.text as string, lang: payload.lang as 'js' | 'py' },
        maxZ,
      );
    } else if (type === 'sticker') {
      item = makeItem<StickerItem>(
        { ...common, type: 'sticker', text: payload.text as string, color: payload.color as string },
        maxZ,
      );
    } else if (type === 'stamp') {
      item = makeItem<StampItem>({ ...common, type: 'stamp', text: payload.text as string }, maxZ);
    } else {
      item = makeItem<TapeItem>(
        { ...common, type: 'tape', color: payload.color as string, width: 140 },
        maxZ,
      );
    }
    addItem(item);
    selectItem(item.id);
  };

  // 自定义代码：贴到画布中心
  const handleAddCustomCode = (text: string, lang: 'js' | 'py') => {
    if (!me || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const item = makeItem<CodeItem>(
      {
        type: 'code',
        x: rect.width / 2 - 110,
        y: rect.height / 2 - 70,
        rotation: Math.round((Math.random() - 0.5) * 10),
        scale: 1,
        authorId: me.id,
        text,
        lang,
      },
      maxZ,
    );
    addItem(item);
    selectItem(item.id);
  };

  // 画布上移动鼠标 → 广播自己的光标（节流：每 60ms 一次）
  const lastEmit = useRef(0);
  const handleCanvasMove = (e: React.PointerEvent) => {
    const now = performance.now();
    if (now - lastEmit.current < 50) return;
    lastEmit.current = now;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    broadcastCursor({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      draggingId: null,
    });
  };

  if (!room || !me) return null;

  const renderItem = (item: Item) => {
    // 对方正在拖的元素：半透明跟随（由 cursors[].draggingId 标记）
    const remoteDragging = Object.values(cursors).some(
      (c) => c.draggingId === item.id,
    );
    return (
      <CanvasItem
        key={item.id}
        item={item}
        canvasRef={canvasRef}
        isRemoteDragging={remoteDragging}
      >
        {item.type === 'code' && <CodeStrip item={item} />}
        {item.type === 'sticker' && <Sticker item={item} />}
        {item.type === 'stamp' && <Stamp item={item} />}
        {item.type === 'tape' && <Tape item={item} />}
      </CanvasItem>
    );
  };

  return (
    <div style={styles.app}>
      <Toolbar canvasRef={canvasRef} onLeave={onLeave} />
      <div style={styles.body}>
        <Drawer onDragStart={() => {}} onAddCustomCode={handleAddCustomCode} />

        {/* 画布 */}
        <div
          ref={canvasRef}
          className="paper-bg"
          style={styles.canvas}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={handleDrop}
          onPointerDown={() => selectItem(null)}
          onPointerMove={handleCanvasMove}
        >
          {/* 纸张装饰角 */}
          <div style={styles.cornerTL} />
          <div style={styles.cornerBR} />

          {/* 装饰胶带（固定背景，不参与交互） */}
          <div style={{ ...styles.decoTape, top: 30, left: 280, background: 'rgba(232,93,74,0.5)', transform: 'rotate(-6deg)' }} />
          <div style={{ ...styles.decoTape, top: 520, left: 520, background: 'rgba(47,125,91,0.45)', transform: 'rotate(4deg)', width: 130 }} />
          <div style={{ ...styles.decoTape, top: 80, right: 60, background: 'rgba(196,114,224,0.4)', transform: 'rotate(8deg)', width: 100 }} />

          {items.sort((a, b) => a.z - b.z).map(renderItem)}

          {/* 对方光标 */}
          {Object.values(cursors).map((c) => (
            <RemoteCursor key={c.userId} cursor={c} />
          ))}

          {items.length === 0 && (
            <div style={styles.hint}>
              ← 从左边抽屉拖代码条、贴纸、印章到这里<br />
              开两个窗口输入同房号就能看到对方的操作 ✨
            </div>
          )}
        </div>

        {/* 右侧时间线 */}
        <div style={styles.side}>
          <div style={styles.sideHeader}>时间线</div>
          <div style={styles.sideBody}>
            <Timeline />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--paper)',
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  cornerTL: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 60,
    height: 60,
    borderTop: '2px solid rgba(120,100,60,0.25)',
    borderLeft: '2px solid rgba(120,100,60,0.25)',
    pointerEvents: 'none',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 60,
    height: 60,
    borderBottom: '2px solid rgba(120,100,60,0.25)',
    borderRight: '2px solid rgba(120,100,60,0.25)',
    pointerEvents: 'none',
  },
  decoTape: {
    position: 'absolute',
    width: 110,
    height: 26,
    opacity: 0.7,
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  hint: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    color: 'var(--ink-soft)',
    fontSize: 20,
    lineHeight: 1.8,
    fontFamily: 'var(--font-hand)',
    pointerEvents: 'none',
  },
  side: {
    width: 240,
    height: '100%',
    background: 'rgba(255,253,247,0.92)',
    borderLeft: '2px dashed rgba(120,100,60,0.3)',
    display: 'flex',
    flexDirection: 'column',
  },
  sideHeader: {
    padding: '16px',
    fontFamily: 'var(--font-hand)',
    fontSize: 22,
    fontWeight: 700,
    borderBottom: '1px solid rgba(120,100,60,0.15)',
  },
  sideBody: {
    flex: 1,
    overflowY: 'auto',
  },
};
