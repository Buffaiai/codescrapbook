import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { broadcastCursor } from '../store/useSync';
import { clampToCanvas } from '../utils/placement';
import type { Item } from '../types';

interface Props {
  item: Item;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  isRemoteDragging?: boolean;
}

/** 角度归一到 -180 ~ 180，并按 15 度吸附 */
const snapAngle = (deg: number) => {
  let v = Math.round(deg / 15) * 15;
  v = ((v % 360) + 360) % 360;
  if (v > 180) v -= 360;
  return v;
};

/**
 * 画布元素外壳：移动 / 旋转 / 缩放 / 编辑 / 删除
 * 操作通过 pointer 事件实现，坐标转换为画布坐标系。
 */
export default function CanvasItem({
  item,
  canvasRef,
  children,
  isRemoteDragging,
}: Props) {
  const updateItem = useRoomStore((s) => s.updateItem);
  const deleteItem = useRoomStore((s) => s.deleteItem);
  const selectedId = useRoomStore((s) => s.selectedId);
  const editingId = useRoomStore((s) => s.editingId);
  const selectItem = useRoomStore((s) => s.selectItem);
  const setEditing = useRoomStore((s) => s.setEditing);
  const showToast = useRoomStore((s) => s.showToast);
  const me = useRoomStore((s) => s.me);
  const users = useRoomStore((s) => s.room?.users);

  const selected = selectedId === item.id;
  const editing = editingId === item.id;
  const [dragging, setDragging] = useState(false);
  const [rotating, setRotating] = useState(false);
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
  const onlineAuthor = users?.[item.authorId] ?? (isMine ? me : null);
  // 优先用卡片里持久化的作者名/色，保证刷新重进后名签仍与贴上时一致
  const author = item.authorName
    ? { name: item.authorName, color: item.authorColor ?? onlineAuthor?.color ?? '#8a7a5c' }
    : onlineAuthor;

  // 让元素显示在所有元素上层（被选中/拖拽时）
  const z = selected || dragging ? 9999 : item.z;

  const toCanvas = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onPointerDown = (
    e: React.PointerEvent,
    mode: 'move' | 'rotate' | 'scale',
  ) => {
    if (isRemoteDragging) return; // 对方正在拖，不抢
    if (editing) return; // 编辑中不拖动
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    selectItem(item.id);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    // 元素中心 = 元素左上角 + 半宽半高（未旋转的 bounding 近似，足够用）
    const el = (e.currentTarget as HTMLElement).closest(
      '[data-item]',
    ) as HTMLElement;
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
    if (mode === 'rotate') setRotating(true);
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
        updateItem(item.id, { rotation: snapAngle(deg) });
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
      setRotating(false);
      broadcastCursor({ x: 0, y: 0, draggingId: null });
      // 结束移动 / 缩放 / 旋转后，若卡片因 transform 超出画布，自动收回到边界内
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const canvasRect = canvas.getBoundingClientRect();
          const wrapper = canvas.querySelector<HTMLElement>(
            `[data-item-id="${item.id}"]`,
          );
          if (!wrapper) return;
          const wrapperRect = wrapper.getBoundingClientRect();
          const state = useRoomStore.getState();
          const current = state.room?.items?.[item.id];
          if (!current) return;
          const refined = clampToCanvas(
            { x: current.x, y: current.y },
            {
              left: wrapperRect.left - canvasRect.left,
              top: wrapperRect.top - canvasRect.top,
              width: wrapperRect.width,
              height: wrapperRect.height,
            },
            { width: canvasRect.width, height: canvasRect.height },
          );
          if (refined.x !== current.x || refined.y !== current.y) {
            state.updateItem(item.id, refined);
          }
        });
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, item.id, updateItem, canvasRef]);

  const handleDelete = () => {
    if (!isMine) {
      showToast('只能删除自己的卡片', { kind: 'error' });
      return;
    }
    deleteItem(item.id, true);
  };

  return (
    <div
      data-item
      data-item-id={item.id}
      onPointerDown={(e) => onPointerDown(e, 'move')}
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        transform: `rotate(${item.rotation}deg) scale(${item.scale})`,
        transformOrigin: 'center center',
        zIndex: z,
        cursor: editing ? 'text' : dragging ? 'grabbing' : 'grab',
        opacity: isRemoteDragging ? 0.55 : 1,
        transition: dragging ? 'none' : 'opacity 0.2s',
        touchAction: 'none',
        userSelect: 'none',
      }}
      className={selected ? 'item-selected' : ''}
    >
      {children}

      {/* 操作手柄：仅选中时显示 */}
      {selected && !isRemoteDragging && (
        <div
          data-ui-hide
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {/* 旋转手柄：按 15° 吸附，双击回正 */}
          <div
            onPointerDown={(e) => onPointerDown(e, 'rotate')}
            onDoubleClick={(e) => {
              e.stopPropagation();
              updateItem(item.id, { rotation: 0 });
            }}
            style={handleStyle(-44, '50%', '#3b6fb5')}
            title="旋转（按 15° 吸附，双击回正）"
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
              pointerEvents: 'auto',
            }}
            title="缩放"
          >
            ⤢
          </div>
          {/* 编辑按钮（代码条） */}
          {item.type === 'code' && !editing && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setEditing(item.id);
              }}
              style={{
                position: 'absolute',
                top: -14,
                left: -14,
                height: 26,
                padding: '0 9px',
                borderRadius: 13,
                border: 'none',
                background: '#3b6fb5',
                color: '#fff',
                fontSize: 12,
                fontFamily: 'var(--font-hand)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                cursor: 'pointer',
                pointerEvents: 'auto',
              }}
              title="编辑文字（也可双击卡片）"
            >
              ✎ 编辑
            </button>
          )}
          {/* 删除按钮 */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
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
              pointerEvents: 'auto',
            }}
            title="删除"
          >
            ×
          </button>

          {/* 旋转角度提示 */}
          {rotating && (
            <div
              style={{
                position: 'absolute',
                top: -74,
                left: '50%',
                transform: `translateX(-50%) rotate(${-item.rotation}deg)`,
                background: '#3b6fb5',
                color: '#fff',
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 10,
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {item.rotation}°
            </div>
          )}
        </div>
      )}

      {/* 作者名签：反向旋转，始终保持水平 */}
      {author && (
        <div
          style={{
            position: 'absolute',
            bottom: -18,
            left: 6,
            fontSize: 11,
            background: author.color,
            color: '#fff',
            padding: '1px 7px',
            borderRadius: 4,
            opacity: 0.9,
            fontFamily: 'var(--font-hand)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            transform: `rotate(${-item.rotation}deg) scale(${1 / item.scale})`,
            transformOrigin: 'left top',
          }}
        >
          {author.name}
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
    pointerEvents: 'auto',
  };
}
