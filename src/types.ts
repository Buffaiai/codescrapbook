// ===== 代码手账本 数据模型 =====

export type ItemType = 'code' | 'sticker' | 'stamp' | 'tape';

export interface User {
  id: string;
  name: string;
  color: string; // 用户代表色（贴纸底色/光标色）
}

export interface BaseItem {
  id: string;
  type: ItemType;
  x: number; // 画布坐标 px
  y: number;
  rotation: number; // 度数 -20 ~ 20
  scale: number; // 0.5 ~ 2.5
  z: number; // 层级
  authorId: string;
  createdAt: number;
}

export interface CodeItem extends BaseItem {
  type: 'code';
  text: string;
  lang: 'js' | 'py';
}

export interface StickerItem extends BaseItem {
  type: 'sticker';
  text: string;
  color: string;
}

export interface StampItem extends BaseItem {
  type: 'stamp';
  text: string; // 搞定 / 联名
}

export interface TapeItem extends BaseItem {
  type: 'tape';
  color: string;
  width: number; // 胶带宽度
}

export type Item = CodeItem | StickerItem | StampItem | TapeItem;

export interface TimelineEntry {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  action: 'add' | 'delete' | 'move';
  itemType: ItemType;
  itemText: string;
  timestamp: number;
}

export interface Room {
  id: string; // 4 位房号
  users: Record<string, User>;
  items: Record<string, Item>;
  timeline: TimelineEntry[];
}

export interface CursorState {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
  draggingId: string | null;
  t: number; // 时间戳，用于清理掉线光标
}

export type SyncMessage =
  | { type: 'hello'; user: User; roomId: string }
  | { type: 'bye'; userId: string; roomId: string }
  | { type: 'snapshot'; room: Room; roomId: string; fromId?: string }
  | { type: 'patch'; roomId: string; patch: Partial<Room> }
  | { type: 'cursor'; cursor: CursorState; roomId: string }
  | { type: 'request-snapshot'; roomId: string; fromId: string }
  | { type: 'user-join'; user: User; roomId?: string }
  | { type: 'user-leave'; userId: string; roomId?: string };
