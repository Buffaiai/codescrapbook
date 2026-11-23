import { create } from 'zustand';
import type {
  Room,
  User,
  Item,
  TimelineEntry,
  CursorState,
  RoomOp,
  ServerSnapshotRoom,
} from '../types';
import { uid } from '../utils/id';

export interface ToastState {
  id: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  kind: 'info' | 'error';
}

interface RoomStore {
  room: Room | null;
  me: User | null;
  cursors: Record<string, CursorState>;
  selectedId: string | null;
  editingId: string | null;
  connected: boolean;
  toast: ToastState | null;
  /** 远端状态版本：每次应用服务端数据自增，用来避免把远端更新回推 */
  epoch: number;

  // 会话（快照只由服务端下发）
  setSession: (room: ServerSnapshotRoom, me: User) => void;
  applyServerSnapshot: (room: ServerSnapshotRoom) => void;
  applyRemoteOp: (op: RoomOp) => void;
  appendTimeline: (entry: TimelineEntry) => void;
  setUsers: (users: User[]) => void;
  setConnected: (v: boolean) => void;
  leaveRoom: () => void;

  // 元素（本地增量操作）
  addItem: (item: Item) => void;
  updateItem: (id: string, patch: Partial<Item>) => void;
  deleteItem: (id: string, withUndo?: boolean) => void;
  restoreItem: (item: Item) => void;
  removeItems: (ids: string[]) => void;

  // 选择 / 编辑
  selectItem: (id: string | null) => void;
  setEditing: (id: string | null) => void;

  // 光标
  setCursor: (c: CursorState) => void;
  removeCursor: (userId: string) => void;
  pruneCursors: () => void;

  // 提示 / 撤销
  showToast: (
    text: string,
    opts?: {
      actionLabel?: string;
      onAction?: () => void;
      duration?: number;
      kind?: 'info' | 'error';
      id?: string;
    },
  ) => void;
  dismissToast: () => void;
  undoDelete: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let lastDeleted: { item: Item; toastId: string } | null = null;

const toRecord = (users: User[]): Record<string, User> => {
  const map: Record<string, User> = {};
  for (const u of users) map[u.id] = u;
  return map;
};

/** 本地与服务端元素合并：服务端已删的一律不保留 */
const withoutDeleted = (items: Record<string, Item>, deleted: string[]) => {
  const tomb = new Set(deleted);
  const out: Record<string, Item> = {};
  for (const [id, it] of Object.entries(items)) {
    if (!tomb.has(id)) out[id] = it;
  }
  return out;
};

/** 时间线条目里的引用文本（与服务端 labelOf 保持一致） */
const labelOf = (item: Item): string => {
  if (item.type === 'code') {
    const firstLine = String(item.text || '').split('\n')[0];
    return item.note ? `${item.note} · ${firstLine}` : firstLine;
  }
  if (item.type === 'tape') return '胶带';
  return String(item.text || '');
};

/** 贴上条目的固定 id：本地先写、服务端回执用同一 id，保证 1 次操作只记 1 条 */
export const addEntryId = (itemId: string) => `tl-${itemId}`;

export const useRoomStore = create<RoomStore>((set, get) => ({
  room: null,
  me: null,
  cursors: {},
  selectedId: null,
  editingId: null,
  connected: false,
  toast: null,
  epoch: 0,

  setSession: (incoming, me) => {
    set((s) => ({
      room: {
        id: incoming.id,
        users: { ...incoming.users, [me.id]: me },
        items: withoutDeleted(incoming.items, incoming.deleted ?? []),
        timeline: incoming.timeline ?? [],
        deleted: [...(incoming.deleted ?? [])],
      },
      me,
      cursors: {},
      selectedId: null,
      editingId: null,
      epoch: s.epoch + 1,
    }));
  },

  applyServerSnapshot: (incoming) => {
    const st = get();
    if (!st.room || st.room.id !== incoming.id) return;
    set((s) => ({
      room: {
        id: incoming.id,
        users: incoming.users,
        items: withoutDeleted(incoming.items, incoming.deleted ?? []),
        timeline: incoming.timeline ?? [],
        deleted: [...(incoming.deleted ?? [])],
      },
      cursors: {},
      selectedId: null,
      editingId: null,
      epoch: s.epoch + 1,
    }));
  },

  applyRemoteOp: (op) => {
    const { room, selectedId, editingId } = get();
    if (!room) return;

    if (op.kind === 'update') {
      const cur = room.items[op.id];
      if (!cur || room.deleted.includes(op.id)) return;
      const items = {
        ...room.items,
        [op.id]: { ...cur, ...(op.patch as Partial<Item>) } as Item,
      };
      set((s) => ({ room: { ...room, items }, epoch: s.epoch + 1 }));
      return;
    }

    if (op.kind === 'add' || op.kind === 'restore') {
      if (room.deleted.includes(op.item.id) && op.kind === 'add') return;
      const deleted =
        op.kind === 'restore'
          ? room.deleted.filter((x) => x !== op.item.id)
          : room.deleted;
      const items = { ...room.items, [op.item.id]: op.item };
      set((s) => ({
        room: { ...room, items, deleted },
        epoch: s.epoch + 1,
      }));
      return;
    }

    // delete
    const items = { ...room.items };
    delete items[op.id];
    const deleted = room.deleted.includes(op.id)
      ? room.deleted
      : [...room.deleted, op.id];
    set((s) => ({
      room: { ...room, items, deleted },
      epoch: s.epoch + 1,
      selectedId: selectedId === op.id ? null : selectedId,
      editingId: editingId === op.id ? null : editingId,
    }));
  },

  appendTimeline: (entry) => {
    const { room } = get();
    if (!room) return;
    if (room.timeline.some((t) => t.id === entry.id)) return;
    set({ room: { ...room, timeline: [...room.timeline, entry].slice(-50) } });
  },

  setUsers: (users) => {
    const { room } = get();
    if (!room) return;
    const next = toRecord(users);
    const cursors = { ...get().cursors };
    let changed = false;
    for (const id of Object.keys(cursors)) {
      if (!next[id]) {
        delete cursors[id];
        changed = true;
      }
    }
    set((s) => ({
      room: { ...room, users: next },
      cursors: changed ? cursors : s.cursors,
      epoch: s.epoch + 1,
    }));
  },

  setConnected: (v) => set({ connected: v }),

  leaveRoom: () => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    lastDeleted = null;
    set({
      room: null,
      me: null,
      cursors: {},
      selectedId: null,
      editingId: null,
      toast: null,
      connected: false,
    });
  },

  addItem: (item) => {
    const { room, me } = get();
    if (!room) return;
    if (room.deleted.includes(item.id)) return;
    // 贴上动作先本地落一条时间线，再增量同步给服务端（服务端回执用同一 id，不重复）
    const entry: TimelineEntry | null = me
      ? {
          id: addEntryId(item.id),
          userId: me.id,
          userName: me.name,
          userColor: me.color,
          action: 'add',
          itemType: item.type,
          itemText: labelOf(item),
          timestamp: Date.now(),
        }
      : null;
    set({
      room: {
        ...room,
        items: { ...room.items, [item.id]: item },
        timeline: entry
          ? [...room.timeline, entry].slice(-50)
          : room.timeline,
      },
    });
  },

  updateItem: (id, patch) => {
    const { room } = get();
    if (!room || !room.items[id] || room.deleted.includes(id)) return;
    set({
      room: {
        ...room,
        items: {
          ...room.items,
          [id]: { ...room.items[id], ...patch } as Item,
        },
      },
    });
  },

  deleteItem: (id, withUndo = true) => {
    const { room } = get();
    if (!room || !room.items[id]) return;
    const it = room.items[id];
    const items = { ...room.items };
    delete items[id];
    const deleted = room.deleted.includes(id)
      ? room.deleted
      : [...room.deleted, id];
    set({
      room: { ...room, items, deleted },
      selectedId: get().selectedId === id ? null : get().selectedId,
      editingId: get().editingId === id ? null : get().editingId,
    });

    if (!withUndo) return;
    if (toastTimer) clearTimeout(toastTimer);
    const toastId = uid();
    lastDeleted = { item: it, toastId };
    get().showToast('已删除 1 张卡片', {
      actionLabel: '撤销删除',
      onAction: () => get().undoDelete(),
      duration: 5000,
      id: toastId,
    });
  },

  restoreItem: (item) => {
    const { room } = get();
    if (!room) return;
    set({
      room: {
        ...room,
        items: { ...room.items, [item.id]: item },
        deleted: room.deleted.filter((x) => x !== item.id),
      },
    });
  },

  removeItems: (ids) => {
    const { room, selectedId, editingId } = get();
    if (!room || !ids.length) return;
    const items = { ...room.items };
    const deleted = [...room.deleted];
    for (const id of ids) {
      delete items[id];
      if (!deleted.includes(id)) deleted.push(id);
    }
    set({
      room: { ...room, items, deleted },
      selectedId: selectedId && ids.includes(selectedId) ? null : selectedId,
      editingId: editingId && ids.includes(editingId) ? null : editingId,
    });
  },

  selectItem: (id) => set({ selectedId: id }),
  setEditing: (id) => set({ editingId: id }),

  setCursor: (c) =>
    set((s) => ({ cursors: { ...s.cursors, [c.userId]: c } })),
  removeCursor: (userId) =>
    set((s) => {
      if (!s.cursors[userId]) return s;
      const cursors = { ...s.cursors };
      delete cursors[userId];
      return { cursors };
    }),
  pruneCursors: () =>
    set((s) => {
      const now = Date.now();
      const cursors = { ...s.cursors };
      let changed = false;
      for (const k of Object.keys(cursors)) {
        if (now - cursors[k].t > 8000) {
          delete cursors[k];
          changed = true;
        }
      }
      return changed ? { cursors } : s;
    }),

  showToast: (text, opts) => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    const id = opts?.id ?? uid();
    const duration = opts?.duration ?? 2600;
    set({
      toast: {
        id,
        text,
        actionLabel: opts?.actionLabel,
        onAction: opts?.onAction,
        kind: opts?.kind ?? 'info',
      },
    });
    toastTimer = setTimeout(() => {
      toastTimer = null;
      const t = get().toast;
      if (t?.id !== id) return;
      if (lastDeleted?.toastId === id) lastDeleted = null;
      set({ toast: null });
    }, duration);
  },

  dismissToast: () => {
    const t = get().toast;
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (t && lastDeleted?.toastId === t.id) lastDeleted = null;
    set({ toast: null });
  },

  undoDelete: () => {
    if (!lastDeleted) return;
    const item = lastDeleted.item;
    lastDeleted = null;
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    get().restoreItem(item);
    get().showToast('已撤销删除');
  },
}));
