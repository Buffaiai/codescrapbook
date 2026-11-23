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
  rotation: number; // 度数
  scale: number;
  z: number; // 层级
  authorId: string;
  /** 作者名/色随卡片一起持久化，刷新重进后名签仍能显示 */
  authorName?: string;
  authorColor?: string;
  createdAt: number;
}

export type CodeTag = 'Bug' | '学到了' | '面试';

export interface CodeItem extends BaseItem {
  type: 'code';
  text: string;
  lang: 'js' | 'py';
  note?: string;
  tag?: CodeTag;
}

export interface StickerItem extends BaseItem {
  type: 'sticker';
  text: string;
  color: string;
}

export interface StampItem extends BaseItem {
  type: 'stamp';
  text: string;
  color?: string;
}

export interface TapeItem extends BaseItem {
  type: 'tape';
  color: string;
  width: number;
}

export type Item = CodeItem | StickerItem | StampItem | TapeItem;

export type TimelineAction =
  | 'add'
  | 'delete'
  | 'move'
  | 'edit'
  | 'join'
  | 'leave';

export interface TimelineEntry {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  action: TimelineAction;
  itemType?: ItemType;
  itemText: string;
  timestamp: number;
}

export interface Room {
  id: string; // 4 位房号
  users: Record<string, User>; // 当前在线用户（服务端下发）
  items: Record<string, Item>;
  timeline: TimelineEntry[];
  deleted: string[]; // 已删除元素 id（服务端权威墓碑）
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

/** 客户端 → 服务端：只发增量操作，绝不上传整房快照 */
export type RoomOp =
  | { kind: 'add'; item: Item }
  | { kind: 'update'; id: string; patch: Record<string, unknown> }
  | { kind: 'delete'; id: string }
  | { kind: 'restore'; item: Item };

export interface ServerSnapshotRoom {
  id: string;
  users: Record<string, User>;
  items: Record<string, Item>;
  timeline: TimelineEntry[];
  deleted: string[];
}

export type ClientMessage =
  | { type: 'check-room'; roomId: string; reqId: string }
  | { type: 'join'; roomId: string; user: User; reqId?: string; resume?: boolean }
  | { type: 'create'; roomId: string; user: User; reqId: string }
  | { type: 'leave'; roomId: string }
  | { type: 'op'; roomId: string; op: RoomOp }
  | { type: 'cursor'; roomId: string; cursor: CursorState }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'snapshot'; reqId?: string; room: ServerSnapshotRoom }
  | { type: 'room-check'; reqId: string; exists: boolean }
  | { type: 'error'; reqId?: string; code: string; message?: string }
  | { type: 'op'; op: RoomOp }
  | { type: 'timeline'; entry: TimelineEntry }
  | { type: 'presence'; roomId: string; users: User[] }
  | { type: 'cursor'; roomId: string; cursor: CursorState }
  | { type: 'pong' };
