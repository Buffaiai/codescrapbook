import { useMemo, useRef, useState } from 'react';
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
import Toast from './Toast';
import { findPlacement, clampToCanvas } from '../utils/placement';
import {
  loadCustomTemplates,
  saveCustomTemplate,
  type CodeSnippet,
} from '../data/codeSnippets';
import type {
  Item,
  ItemType,
  CodeItem,
  CodeTag,
  StickerItem,
  StampItem,
  TapeItem,
} from '../types';

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CodeSnippet[]>(
    loadCustomTemplates,
  );

  const items = useMemo(() => Object.values(room?.items ?? {}), [room?.items]);
  // 表头条数与面板里实际渲染的行数一致（进出房间也计入）
  const timelineCount = room?.timeline.length ?? 0;
  const maxZ = useMemo(
    () => items.reduce((m, it) => Math.max(m, it.z), 0),
    [items],
  );

  const canvasSize = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { width: rect?.width ?? 960, height: rect?.height ?? 640 };
  };

  const buildItem = (
    type: ItemType,
    payload: Record<string, unknown>,
    x: number,
    y: number,
  ): Item => {
    const common = {
      x,
      y,
      rotation: type === 'tape' ? 0 : Math.round((Math.random() - 0.5) * 6),
      scale: 1,
      authorId: me!.id,
      authorName: me!.name,
      authorColor: me!.color,
    };
    if (type === 'code') {
      return makeItem<CodeItem>(
        {
          ...common,
          type: 'code',
          text: payload.text as string,
          lang: payload.lang as 'js' | 'py',
          note: (payload.note as string | undefined) || undefined,
          tag: payload.tag as CodeTag | undefined,
        },
        maxZ,
      );
    }
    if (type === 'sticker') {
      return makeItem<StickerItem>(
        {
          ...common,
          type: 'sticker',
          text: payload.text as string,
          color: payload.color as string,
        },
        maxZ,
      );
    }
    if (type === 'stamp') {
      return makeItem<StampItem>(
        {
          ...common,
          type: 'stamp',
          text: payload.text as string,
          color: payload.color as string | undefined,
        },
        maxZ,
      );
    }
    return makeItem<TapeItem>(
      { ...common, type: 'tape', color: payload.color as string, width: 140 },
      maxZ,
    );
  };

  /**
   * 代码条等可能超出 itemSize 保守值的元素，
   * 在 addItem 后用 rAF 测量实际渲染尺寸，精确 clamp 到画布内。
   * 如果真实 bbox 与已有卡的真实 bbox 大幅重叠（≥20% 面积），
   * 就沿 X 轴推一个步长，直到没大幅重叠或推了 10 次。
   */
  const refinePlacement = (itemId: string) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const canvasRect = canvas.getBoundingClientRect();
        const canvasW = canvasRect.width;
        const canvasH = canvasRect.height;
        const state = useRoomStore.getState();
        const current = state.room?.items?.[itemId];
        if (!current) return;

        const wrapper = canvas.querySelector<HTMLElement>(
          `[data-item-id="${itemId}"]`,
        );
        if (!wrapper) return;
        const newRect = wrapper.getBoundingClientRect();
        const newBox = {
          left: newRect.left - canvasRect.left,
          top: newRect.top - canvasRect.top,
          w: newRect.width,
          h: newRect.height,
        };

        // 收集所有其他卡的真实 bbox
        const otherBoxes: { x: number; y: number; w: number; h: number }[] = [];
        canvas.querySelectorAll<HTMLElement>('[data-item-id]').forEach((el) => {
          const id = el.getAttribute('data-item-id');
          if (!id || id === itemId) return;
          const r = el.getBoundingClientRect();
          otherBoxes.push({
            x: r.left - canvasRect.left,
            y: r.top - canvasRect.top,
            w: r.width,
            h: r.height,
          });
        });

        const overlapArea = (a: typeof newBox, b: typeof newBox) => {
          const ox = Math.max(0, Math.min(a.left + a.w, b.left + b.w) - Math.max(a.left, b.left));
          const oy = Math.max(0, Math.min(a.top + a.h, b.top + b.h) - Math.max(a.top, b.top));
          return ox * oy;
        };

        const significantOverlap = (box: typeof newBox) => {
          for (const o of otherBoxes) {
            const area = overlapArea(box, { left: o.x, top: o.y, w: o.w, h: o.h });
            const minArea = Math.min(box.w * box.h, o.w * o.h) * 0.2;
            if (area >= minArea) return true;
          }
          return false;
        };

        // 尝试沿 8 个方向偏移，逐步加大步长，找到无大幅重叠的位置
        let bestTarget: typeof newBox | null = null;
        if (otherBoxes.length > 0 && significantOverlap(newBox)) {
          const directions: Array<[number, number]> = [
            [0, 1], [1, 0], [0, -1], [-1, 0],
            [1, 1], [-1, -1], [1, -1], [-1, 1],
          ];
          const MAX_PASSES = 6;
          const BASE_STEP = 28;
          for (let pass = 0; pass < MAX_PASSES; pass += 1) {
            const step = BASE_STEP * (pass + 1);
            for (const [dxDir, dyDir] of directions) {
              const candidate = {
                ...newBox,
                left: newBox.left + dxDir * step,
                top: newBox.top + dyDir * step,
              };
              // 先 clamp 到画布边界内（避免跑到画布外再算 overlap）
              const clamped = clampToCanvas(
                { x: current.x, y: current.y },
                { left: candidate.left, top: candidate.top, width: candidate.w, height: candidate.h },
                { width: canvasW, height: canvasH },
              );
              const dx = clamped.x - current.x;
              const dy = clamped.y - current.y;
              const finalBox = { ...newBox, left: newBox.left + dx, top: newBox.top + dy };
              if (!significantOverlap(finalBox)) {
                bestTarget = finalBox;
                break;
              }
            }
            if (bestTarget) break;
          }
        }

        const finalTarget = bestTarget ?? newBox;
        const finalDeltaX = finalTarget.left - newBox.left;
        const finalDeltaY = finalTarget.top - newBox.top;

        // 再做一次边界 clamp
        const clamped = clampToCanvas(
          { x: current.x + finalDeltaX, y: current.y + finalDeltaY },
          { left: finalTarget.left, top: finalTarget.top, width: finalTarget.w, height: finalTarget.h },
          { width: canvasW, height: canvasH },
        );

        if (clamped.x !== current.x || clamped.y !== current.y) {
          state.updateItem(itemId, clamped);
        }
      });
    });
  };

  // 点击素材：自动贴到画布
  const handleAddFromDrawer = (
    type: ItemType,
    payload: Record<string, unknown>,
  ) => {
    if (!me) return;
    const pos = findPlacement(items, canvasSize(), type);
    const item = buildItem(type, payload, pos.x, pos.y);
    addItem(item);
    selectItem(item.id);
    refinePlacement(item.id);
  };

  // 拖放：从抽屉把素材放到画布上
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!me || !canvasRef.current) return;
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    let parsed: { type: ItemType; payload: Record<string, unknown> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = findPlacement(
      items,
      { width: rect.width, height: rect.height },
      parsed.type,
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
    );
    const item = buildItem(parsed.type, parsed.payload, pos.x, pos.y);
    addItem(item);
    selectItem(item.id);
    refinePlacement(item.id);
  };

  // 自定义代码：代码、备注和标签一起贴到画布
  const handleAddCustomCode = (
    text: string,
    lang: 'js' | 'py',
    note: string,
    tag?: CodeTag,
  ) => {
    if (!me) return;
    const pos = findPlacement(items, canvasSize(), 'code');
    const item = buildItem('code', { text, lang, note, tag }, pos.x, pos.y);
    addItem(item);
    selectItem(item.id);
    refinePlacement(item.id);
  };

  const handleSaveTemplate = (item: CodeItem) => {
    const firstLine = item.text.split('\n')[0].trim();
    const template: CodeSnippet = {
      id: `my-${item.id}`,
      title: item.note || firstLine.slice(0, 24) || '我的代码',
      text: item.text,
      lang: item.lang,
      note: item.note,
      tag: item.tag,
      reason: '我保存的代码模板，点开可看完整代码。',
    };
    setCustomTemplates(saveCustomTemplate(template));
    useRoomStore.getState().showToast('已存为我的模板');
  };

  // 画布上移动鼠标 → 广播自己的光标（节流：每 50ms 一次）
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
        {item.type === 'code' && (
          <CodeStrip
            item={item}
            isSaved={customTemplates.some(
              (t) =>
                t.text === item.text &&
                t.note === item.note &&
                t.tag === item.tag,
            )}
            onSaveTemplate={handleSaveTemplate}
          />
        )}
        {item.type === 'sticker' && <Sticker item={item} />}
        {item.type === 'stamp' && <Stamp item={item} />}
        {item.type === 'tape' && <Tape item={item} />}
      </CanvasItem>
    );
  };

  return (
    <div style={styles.app}>
      <Toolbar canvasRef={canvasRef} onLeave={onLeave} />
      <div className="sb-body" style={styles.body}>
        <Drawer
          open={drawerOpen}
          customTemplates={customTemplates}
          onDragStart={() => {}}
          onAdd={handleAddFromDrawer}
          onAddCustomCode={handleAddCustomCode}
        />

        {/* 画布 */}
        <div
          ref={canvasRef}
          className="paper-bg sb-canvas"
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

          {items.sort((a, b) => a.z - b.z).map(renderItem)}

          {/* 对方光标 */}
          {Object.values(cursors).map((c) => (
            <RemoteCursor key={c.userId} cursor={c} />
          ))}

          {items.length === 0 && (
            <div style={styles.hint}>
              点击左侧素材即可贴上画布，也可以直接拖过来<br />
              开两个窗口输入同房号就能看到对方的操作 ✨
            </div>
          )}
        </div>

        {/* 右侧时间线 */}
        <div className={`sb-side${sideOpen ? ' sb-open' : ''}`} style={styles.side}>
          <div style={styles.sideHeader}>
            时间线 <span style={styles.sideCount}>· {timelineCount} 条</span>
          </div>
          <div style={styles.sideBody}>
            <Timeline />
          </div>
        </div>
      </div>

      {/* 手机端：底部/侧边抽屉开关 */}
      <div className="sb-mobile-tabs" data-ui-hide>
        <button
          style={{ ...styles.mobileBtn, ...(drawerOpen ? styles.mobileBtnActive : {}) }}
          onClick={() => {
            setDrawerOpen((v) => !v);
            setSideOpen(false);
          }}
        >
          🎨 素材
        </button>
        <button
          style={{ ...styles.mobileBtn, ...(sideOpen ? styles.mobileBtnActive : {}) }}
          onClick={() => {
            setSideOpen((v) => !v);
            setDrawerOpen(false);
          }}
        >
          🕒 时间线
        </button>
      </div>

      <Toast />
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
    position: 'relative',
  },
  canvas: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    minWidth: 0,
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
    width: '90%',
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
  sideCount: {
    fontSize: 13,
    fontWeight: 400,
    color: 'var(--ink-soft)',
    fontFamily: 'var(--font-mono)',
  },
  sideBody: {
    flex: 1,
    overflowY: 'auto',
  },
  mobileBtn: {
    flex: 1,
    padding: '10px 0',
    border: 'none',
    borderRadius: 8,
    background: '#fffdf7',
    color: 'var(--ink)',
    fontFamily: 'var(--font-hand)',
    fontSize: 17,
    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
  },
  mobileBtnActive: {
    background: 'var(--user-a)',
    color: '#fff',
  },
};
