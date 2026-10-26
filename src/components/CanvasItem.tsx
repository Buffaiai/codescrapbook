import { useRef, useState, useEffect } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { broadcastCursor } from '../store/useSync';
import type { Item } from '../types';

interface Props {
  item: Item;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  isRemoteDragging?: boolean;
}

/**
 * 画布元素外壳：移动 / 旋转 / 缩放 / 删除
 * 操作通过 pointer 事件实现，坐标转换为画布坐标系。
 */
export default function CanvasItem({ item, canvasRef, children, isRemoteDragging }: Props) {
  const { updateItem, deleteItem, selectedId, selectItem, me } = useRoomStore();
  const selected = selectedId === item.id;
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{
    mode: 'move' | 'rotate' | 'scale';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origRot: number;
    origScale: number;
    cx: number; // 元素中心（画布坐标）
    cy: number;
  } | null>(null);

  const isMine = me?.id === item.authorId;

  // 让元素显示在所有元素上层（被选中/拖拽时）
  const z = selected || dragging ? 9999 : item.z;

  const toCanvas = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent, mode: 'move' | 'rotate' | 'scale') => {
    if (isRemoteDragging) return; // 对方正在拖，不抢
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    selectItem(item.id);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    // 元素中心 = 元素左上角 + 半宽半高（未旋转的 bounding 近似，足够用）
    const el = (e.currentTarget as HTMLElement).closest('[data-item]') as HTMLElement;
    const elRect = el.getBoundingClientRect();
    const cx = elRect.left + elRect.width / 2 - rect.left;
    const cy = elRect.top + elRect.height / 2 - rect.top;

    dragState.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: item.x,
      origY: item.y,
      origRot: item.rotation,
      origScale: item.scale,
      cx,
      cy,
    };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const st = dragState.current;
      if (!st) return;
      if (st.mode === 'move') {
        const dx = e.clientX - st.startX;
        const dy = e.clientY - st.startY;
        updateItem(item.id, { x: st.origX + dx, y: st.origY + dy });
        const p = toCanvas(e.clientX, e.clientY);
        broadcastCursor({ x: p.x, y: p.y, draggingId: item.id });
      } else if (st.mode === 'rotate') {
        const rect = canvasRef.current?.getBoundingClientRect();
        const px = rect ? e.clientX - rect.left : e.clientX;
        const py = rect ? e.clientY - rect.top : e.clientY;
        const angle = Math.atan2(py - st.cy, px - st.cx);
        const deg = (angle * 180) / Math.PI + 90; // 手柄在顶部，+90 让 0°=正上
        updateItem(item.id, { rotation: Math.round(deg) });
      } else if (st.mode === 'scale') {
        const dx = e.clientX - st.startX;
        const dy = e.clientY - st.startY;
        const delta = (dx + dy) / 200;
        const s = Math.max(0.4, Math.min(2.8, st.origScale + delta));
        updateItem(item.id, { scale: Number(s.toFixed(2)) });
      }
    };
    const onUp = () => {
      dragState.current = null;
      setDragging(false);
      broadcastCursor({ x: 0, y: 0, draggingId: null });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, item.id, updateItem, canvasRef]);

  return (
    <div
      data-item
      onPointerDown={(e) => onPointerDown(e, 'move')}
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        transform: `rotate(${item.rotation}deg) scale(${item.scale})`,
        transformOrigin: 'center center',
        zIndex: z,
        cursor: dragging ? 'grabbing' : 'grab',
        opacity: isRemoteDragging ? 0.55 : 1,
        transition: dragging ? 'none' : 'opacity 0.2s',
        touchAction: 'none',
        userSelect: 'none',
      }}
      className={selected ? 'item-selected' : ''}
    >
      {children}

      {/* 操作手柄：仅选中且自己的元素时显示 */}
      {selected && !isRemoteDragging && (
        <div data-ui-hide style={{ position: 'absolute', inset: 0 }}>
          {/* 旋转手柄 */}
          <div
            onPointerDown={(e) => onPointerDown(e, 'rotate')}
            style={handleStyle(-44, '50%', '#3b6fb5')}
            title="旋转"
          >
            ↻
          </div>
          {/* 缩放手柄（右下角） */}
          <div
            onPointerDown={(e) => onPointerDown(e, 'scale')}
            style={{
              position: 'absolute',
              right: -10,
              bottom: -10,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#2f7d5b',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              cursor: 'grab',
              boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
              touchAction: 'none',
            }}
            title="缩放"
          >
            ⤢
          </div>
          {/* 删除按钮 */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              deleteItem(item.id);
            }}
            style={{
              position: 'absolute',
              top: -14,
              right: -14,
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: 'none',
              background: '#c0392b',
              color: '#fff',
              fontSize: 16,
              lineHeight: '22px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
              cursor: 'pointer',
            }}
            title="删除"
          >
            ×
          </button>
        </div>
      )}

      {/* 作者小标签 */}
      {isMine && (
        <div
          style={{
            position: 'absolute',
            bottom: -10,
            left: 8,
            fontSize: 11,
            background: me?.color,
            color: '#fff',
            padding: '1px 6px',
            borderRadius: 4,
            opacity: 0.85,
            fontFamily: 'var(--font-hand)',
          }}
        >
          {me?.name}
        </div>
      )}
    </div>
  );
}

function handleStyle(
  top: number | string,
  left: number | string,
  color: string,
): React.CSSProperties {
  return {
    position: 'absolute',
    top,
    left,
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: color,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    cursor: 'grab',
    boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
    transform: 'translate(-50%, -50%)',
    touchAction: 'none',
  };
}
