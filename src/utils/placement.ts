import type { Item, ItemType } from '../types';

/** 各类型元素的近似尺寸（用于避让与居中） */
export const itemSize = (type: ItemType): { w: number; h: number } => {
  // 代码条最大宽度 340，但多数短代码不会撑满这个宽度。
  // 这里用更乐观的 240 宽来计算落点避让，让多张卡能并排排开；
  // refinePlacement 会在 render 后用实际 bbox 精确修正边界 clamp。
  if (type === 'code') return { w: 240, h: 280 };
  if (type === 'sticker') return { w: 130, h: 70 };
  if (type === 'stamp') return { w: 170, h: 80 };
  return { w: 150, h: 38 };
};

/**
 * 画布安全边距：给名签（-18px）和顶部删除/编辑按钮（-14px）留空间，
 * 避免被视口底边或右侧时间线面板裁掉。
 */
export const CANVAS_PAD = 48;

/**
 * 把 item 从当前 bounding rect 位置 clamp 到画布可视范围内，
 * 返回修正后的 item.x / item.y。
 *
 * 用 delta 修正法，支持旋转后的 bounding rect：
 * 无论 transform 怎么改变 bounding rect 的 left/top，
 * 我们只关心"bounding rect 相对于画布偏了多少"，
 * 然后把同样的 delta 加回 item.x/y——这对任何 transform 都成立。
 */
export function clampToCanvas(
  item: { x: number; y: number },
  bbox: {
    /** bounding rect 相对于 canvas 的 left */
    left: number;
    /** bounding rect 相对于 canvas 的 top */
    top: number;
    width: number;
    height: number;
  },
  canvas: { width: number; height: number },
): { x: number; y: number } {
  const pad = CANVAS_PAD;
  const targetLeft = Math.min(
    Math.max(bbox.left, pad),
    Math.max(pad, canvas.width - bbox.width - pad),
  );
  const targetTop = Math.min(
    Math.max(bbox.top, pad),
    Math.max(pad, canvas.height - bbox.height - pad),
  );
  const deltaX = targetLeft - bbox.left;
  const deltaY = targetTop - bbox.top;
  return { x: item.x + deltaX, y: item.y + deltaY };
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const boxOf = (item: Item) => {
  const size = itemSize(item.type);
  return {
    x: item.x,
    y: item.y,
    w: size.w * item.scale,
    h: size.h * item.scale,
  };
};

const overlaps = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) =>
  a.x < b.x + b.w + 10 &&
  a.x + a.w + 10 > b.x &&
  a.y < b.y + b.h + 10 &&
  a.y + a.h + 10 > b.y;

const distSq = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

/**
 * 新元素落点策略：
 *
 * 1. 第一张落在画布中央（给 40~80px 抖动避免绝对居中）
 * 2. 后续新卡不再从"最后一张"附近扩散（会堆到同一方向），
 *    而是直接在画布整个安全区域内随机撒点，
 *    挑选：① 不与任何已有卡片重叠 ② 距离已有卡的距离之和最大 的位置
 * 3. 点不够时增大尝试次数，并允许与最近一张卡拉开 ≥ gap 的降级解
 * 4. 锚定位（拖放）时直接用锚点，同样保证不超出安全边距
 */
export function findPlacement(
  items: Item[],
  canvas: { width: number; height: number },
  type: ItemType,
  anchor?: { x: number; y: number },
): { x: number; y: number } {
  const size = itemSize(type);
  const pad = CANVAS_PAD;
  const usableW = Math.max(0, canvas.width - size.w - pad * 2);
  const usableH = Math.max(0, canvas.height - size.h - pad * 2);

  // 画布完全装不下（超小视口）时退化为左上角安全点
  if (usableW <= 0 || usableH <= 0) {
    return { x: pad, y: pad };
  }

  if (anchor) {
    const x = Math.min(Math.max(anchor.x - size.w / 2, pad), canvas.width - size.w - pad);
    const y = Math.min(Math.max(anchor.y - size.h / 2, pad), canvas.height - size.h - pad);
    return { x, y };
  }

  // 第一张：画布中央带轻微抖动
  if (items.length === 0) {
    return {
      x: Math.min(Math.max(canvas.width / 2 - size.w / 2 + rand(-20, 20), pad), canvas.width - size.w - pad),
      y: Math.min(Math.max(canvas.height / 2 - size.h / 2 + rand(-20, 20), pad), canvas.height - size.h - pad),
    };
  }

  // 多卡：采样候选 → 优先挑"距所有现有卡最远"的空位
  const CANDIDATES = 240;
  const existingBoxes = items.map((it) => boxOf(it));
  let best: { x: number; y: number; score: number } | null = null;
  let fallback: { x: number; y: number; minCenterDist: number } | null = null;

  for (let i = 0; i < CANDIDATES; i += 1) {
    const cx = pad + Math.random() * usableW;
    const cy = pad + Math.random() * usableH;
    const candidate = { x: cx, y: cy, w: size.w, h: size.h };

    let ok = true;
    let nearestCenterDist = Infinity;
    let score = 0;
    for (const ex of existingBoxes) {
      if (overlaps(candidate, ex)) {
        ok = false;
        break;
      }
      const d2 = distSq(
        cx + size.w / 2,
        cy + size.h / 2,
        ex.x + ex.w / 2,
        ex.y + ex.h / 2,
      );
      score += d2;
      if (d2 < nearestCenterDist) nearestCenterDist = d2;
    }

    if (ok) {
      if (!best || score > best.score) best = { x: cx, y: cy, score };
    } else if (!fallback || nearestCenterDist > fallback.minCenterDist) {
      fallback = { x: cx, y: cy, minCenterDist: nearestCenterDist };
    }
  }

  if (best) return { x: best.x, y: best.y };

  // 实在找不到完全空位，退而求其次：挑一个跟最近卡中心距离最大的候选，
  // 保证哪怕有部分重叠，也是"尽可能错开"的位置
  if (fallback) return { x: fallback.x, y: fallback.y };

  return {
    x: pad + usableW * 0.2,
    y: pad + usableH * 0.2,
  };
}
