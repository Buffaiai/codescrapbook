import { create } from 'zustand';
import type {
  Room,
  User,
  Item,
  TimelineEntry,
  CursorState,
} from '../types';
import { uid } from '../utils/id';

/** 从任意元素提取展示文案 */
const itemLabel = (it: Item): string => {
  if (it.type === 'code') return it.text.split('\n')[0];
  if (it.type === 'tape') return '胶带';
  return it.text;
};

interface RoomStore {
  room: Room | null;
  me: User | null;
  cursors: Record<string, CursorState>; // 其他人光标
  selectedId: string | null;
  editingId: string | null; // 正在双击编辑的代码条 id

  // 房间
  createRoom: (roomId: string, user: User) => void;
  joinRoom: (roomId: string, user: User) => void;
  leaveRoom: () => void;
  setRoom: (room: Room) => void;
  applyPatch: (patch: Partial<Room>) => void;

  // 元素
  addItem: (item: Item) => void;
  updateItem: (id: string, patch: Partial<Item>, silent?: boolean) => void;
  deleteItem: (id: string) => void;

  // 选择 / 编辑
  selectItem: (id: string | null) => void;
  setEditing: (id: string | null) => void;

  // 光标
  setCursor: (c: CursorState) => void;
  removeCursor: (userId: string) => void;
  pruneCursors: () => void;

  // 时间线
  pushTimeline: (entry: Omit<TimelineEntry, 'id' | 'timestamp'>) => void;

  // 成员
  addUser: (user: User) => void;
  removeUser: (userId: string) => void;
}

const STORAGE_KEY = 'code-scrap-room-';

const loadRoom = (roomId: string): Room | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + roomId);
    return raw ? (JSON.parse(raw) as Room) : null;
  } catch {
    return null;
  }
};

const saveRoom = (room: Room) => {
  try {
    localStorage.setItem(STORAGE_KEY + room.id, JSON.stringify(room));
  } catch {
    /* ignore */
  }
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  room: null,
  me: null,
  cursors: {},
  selectedId: null,
  editingId: null,

  createRoom: (roomId, user) => {
    const existing = loadRoom(roomId);
    const room: Room = existing ?? {
      id: roomId,
      users: { [user.id]: user },
      items: {},
      timeline: [],
    };
    if (!room.users[user.id]) room.users[user.id] = user;
    saveRoom(room);
    set({ room, me: user, selectedId: null, editingId: null });
  },

  joinRoom: (roomId, user) => {
    const existing = loadRoom(roomId);
    const room: Room = existing ?? {
      id: roomId,
      users: { [user.id]: user },
      items: {},
      timeline: [],
    };
    if (!room.users[user.id]) room.users[user.id] = user;
    saveRoom(room);
    set({ room, me: user, selectedId: null, editingId: null });
  },

  leaveRoom: () => set({ room: null, me: null, cursors: {} }),

  setRoom: (room) => {
    saveRoom(room);
    set({ room });
  },

  applyPatch: (patch) => {
    const { room } = get();
    if (!room) return;
    const next: Room = { ...room, ...patch };
    if (patch.items) next.items = { ...room.items, ...patch.items };
    if (patch.users) next.users = { ...room.users, ...patch.users };
    if (patch.timeline) {
      // 按 id 去重，避免快照/补丁重复追加时间线条目
      const seen = new Set(room.timeline.map((t) => t.id));
      next.timeline = [
        ...room.timeline,
        ...patch.timeline.filter((t) => !seen.has(t.id)),
      ].slice(-50);
    }
    saveRoom(next);
    set({ room: next });
  },

  addItem: (item) => {
    const { room, me } = get();
    if (!room || !me) return;
    const items = { ...room.items, [item.id]: item } as Record<string, Item>;
    const timeline = [
      ...room.timeline,
      {
        id: uid(),
        userId: me.id,
        userName: me.name,
        userColor: me.color,
        action: 'add' as const,
        itemType: item.type,
        itemText: itemLabel(item),
        timestamp: Date.now(),
      },
    ].slice(-50);
    const next: Room = { ...room, items, timeline };
    saveRoom(next);
    set({ room: next });
  },

  updateItem: (id, patch, silent) => {
    const { room } = get();
    if (!room || !room.items[id]) return;
    const items = { ...room.items, [id]: { ...room.items[id], ...patch } } as Record<
      string,
      Item
    >;
    let timeline = room.timeline;
    if (!silent && (patch.x !== undefined || patch.y !== undefined)) {
      const it = items[id];
      timeline = [
        ...room.timeline,
        {
          id: uid(),
          userId: it.authorId,
          userName: room.users[it.authorId]?.name ?? '?',
          userColor: room.users[it.authorId]?.color ?? '#888',
          action: 'move' as const,
          itemType: it.type,
          itemText: itemLabel(it),
          timestamp: Date.now(),
        },
      ].slice(-50);
    }
    const next: Room = { ...room, items, timeline };
    saveRoom(next);
    set({ room: next });
  },

  deleteItem: (id) => {
    const { room, me } = get();
    if (!room || !room.items[id] || !me) return;
    const it = room.items[id];
    const items = { ...room.items };
    delete items[id];
    const timeline = [
      ...room.timeline,
      {
        id: uid(),
        userId: me.id,
        userName: me.name,
        userColor: me.color,
        action: 'delete' as const,
        itemType: it.type,
        itemText: itemLabel(it),
        timestamp: Date.now(),
      },
    ].slice(-50);
    const next: Room = { ...room, items, timeline };
    saveRoom(next);
    set({ room: next, selectedId: null });
  },

  selectItem: (id) => set({ selectedId: id }),
  setEditing: (id) => set({ editingId: id }),

  setCursor: (c) =>
    set((s) => ({ cursors: { ...s.cursors, [c.userId]: c } })),
  removeCursor: (userId) =>
    set((s) => {
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

  pushTimeline: (entry) => {
    const { room } = get();
    if (!room) return;
    const timeline = [
      ...room.timeline,
      { ...entry, id: uid(), timestamp: Date.now() },
    ].slice(-50);
    const next = { ...room, timeline };
    saveRoom(next);
    set({ room: next });
  },

  addUser: (user) => {
    const { room } = get();
    if (!room) return;
    if (room.users[user.id]) return;
    const users = { ...room.users, [user.id]: user };
    const next = { ...room, users };
    saveRoom(next);
    set({ room: next });
  },

  removeUser: (userId) => {
    const { room } = get();
    if (!room) return;
    const users = { ...room.users };
    delete users[userId];
    const next = { ...room, users };
    saveRoom(next);
    set({ room: next });
  },
}));
