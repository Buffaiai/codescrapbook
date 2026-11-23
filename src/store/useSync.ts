import { useEffect } from 'react';
import { useRoomStore } from './useRoomStore';
import type {
  ClientMessage,
  Item,
  RoomOp,
  ServerMessage,
  ServerSnapshotRoom,
  User,
} from '../types';
import { uid } from '../utils/id';

// WebSocket 地址：生产走同源 /ws（Nginx 反代），开发直连 8787
const WS_URL =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? `ws://${location.hostname}:8787`
    : `wss://${location.host}/ws`;

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
};

let socket: WebSocket | null = null;
let socketPromise: Promise<WebSocket> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastPong = 0;
let reqSeq = 0;
let intentionalClose = false;

const pendingRequests = new Map<string, Pending>();
const pendingOps: RoomOp[] = [];

const errorWithCode = (message: string, code: string): Error => {
  const err = new Error(message) as Error & { code?: string };
  err.code = code;
  return err;
};

function wsOpen(): boolean {
  return !!socket && socket.readyState === WebSocket.OPEN;
}

function send(msg: ClientMessage) {
  if (wsOpen()) socket!.send(JSON.stringify(msg));
}

function connect(): Promise<WebSocket> {
  if (wsOpen()) return Promise.resolve(socket!);
  if (socketPromise) return socketPromise;

  socketPromise = new Promise<WebSocket>((resolve, reject) => {
    let settled = false;
    const s = new WebSocket(WS_URL);
    socket = s;
    intentionalClose = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socketPromise = null;
      try {
        s.close();
      } catch {
        /* ignore */
      }
      reject(new Error('连接服务器超时'));
    }, 8000);

    s.onopen = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      lastPong = Date.now();
      useRoomStore.getState().setConnected(true);
      resolve(s);
    };

    s.onmessage = (ev) => handleIncoming(ev);

    s.onerror = () => {
      /* onclose 统一处理 */
    };

    s.onclose = () => {
      clearTimeout(timer);
      socketPromise = null;
      if (socket === s) socket = null;
      useRoomStore.getState().setConnected(false);
      if (!settled) {
        settled = true;
        reject(new Error('无法连接服务器'));
        return;
      }
      scheduleReconnect();
    };
  });

  return socketPromise;
}

function scheduleReconnect() {
  if (reconnectTimer || intentionalClose) return;
  if (!useRoomStore.getState().room) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    const st = useRoomStore.getState();
    if (!st.room || !st.me || intentionalClose) return;
    try {
      await connect();
      // 重连后用服务端快照校准，再把离线期间的增量补发
      send({ type: 'join', roomId: st.room.id, user: st.me, resume: true });
    } catch {
      scheduleReconnect();
    }
  }, 1500);
}

function flushPending() {
  if (!wsOpen()) return;
  const st = useRoomStore.getState();
  if (!st.room) return;
  const ops = pendingOps.splice(0, pendingOps.length);
  for (const op of ops) {
    // 快照会覆盖离线期间的本地改动，这里按增量重新应用并补发
    st.applyRemoteOp(op);
    socket!.send(JSON.stringify({ type: 'op', roomId: st.room.id, op }));
  }
}

function handleIncoming(ev: MessageEvent) {
  let msg: ServerMessage;
  try {
    msg = JSON.parse(ev.data as string) as ServerMessage;
  } catch {
    return;
  }
  const st = useRoomStore.getState();

  switch (msg.type) {
    case 'snapshot': {
      if (msg.reqId && pendingRequests.has(msg.reqId)) {
        const p = pendingRequests.get(msg.reqId)!;
        pendingRequests.delete(msg.reqId);
        p.resolve(msg.room);
        return;
      }
      if (st.room && msg.room.id === st.room.id) {
        st.applyServerSnapshot(msg.room);
        flushPending();
      }
      break;
    }
    case 'room-check': {
      const p = pendingRequests.get(msg.reqId);
      if (p) {
        pendingRequests.delete(msg.reqId);
        p.resolve(!!msg.exists);
      }
      break;
    }
    case 'error': {
      if (msg.reqId && pendingRequests.has(msg.reqId)) {
        const p = pendingRequests.get(msg.reqId)!;
        pendingRequests.delete(msg.reqId);
        p.reject(errorWithCode(msg.message || msg.code, msg.code));
        return;
      }
      if (msg.code === 'ROOM_NOT_FOUND') {
        st.showToast('房间不存在，请核对房号', { kind: 'error' });
      }
      break;
    }
    case 'op': {
      if (st.room) st.applyRemoteOp(msg.op);
      break;
    }
    case 'timeline': {
      if (st.room) st.appendTimeline(msg.entry);
      break;
    }
    case 'presence': {
      if (st.room && msg.roomId === st.room.id) st.setUsers(msg.users);
      break;
    }
    case 'cursor': {
      if (st.room && msg.cursor.userId !== st.me?.id) st.setCursor(msg.cursor);
      break;
    }
    case 'pong': {
      lastPong = Date.now();
      break;
    }
  }
}

function request<T>(payload: Record<string, unknown>, timeout = 8000): Promise<T> {
  const reqId = `${Date.now().toString(36)}-${(++reqSeq).toString(36)}`;
  return connect().then(
    (s) =>
      new Promise<T>((resolve, reject) => {
        pendingRequests.set(reqId, {
          resolve: resolve as (v: unknown) => void,
          reject,
        });
        setTimeout(() => {
          if (pendingRequests.delete(reqId)) reject(new Error('请求超时'));
        }, timeout);
        s.send(JSON.stringify({ ...payload, reqId }));
      }),
  );
}

/** 校验房间是否存在（仅校验，不建房） */
export async function checkRoomRemote(roomId: string): Promise<boolean> {
  return request<boolean>({ type: 'check-room', roomId });
}

export type EnterResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

/** 加入已有房间 / 新建房间（只有 create 才会建房） */
export async function enterRoomRemote(
  roomId: string,
  user: User,
  mode: 'join' | 'create',
): Promise<EnterResult> {
  try {
    const room = await request<ServerSnapshotRoom>({
      type: mode === 'create' ? 'create' : 'join',
      roomId,
      user,
    });
    pendingOps.length = 0;
    useRoomStore.getState().setSession(room, user);
    return { ok: true };
  } catch (err) {
    const e = err as Error & { code?: string };
    return {
      ok: false,
      code: e.code ?? 'ERROR',
      message: e.message || '加入失败',
    };
  }
}

/** 离开房间：通知服务端清理在线状态并关闭连接 */
export function leaveRoomRemote() {
  intentionalClose = true;
  const { room } = useRoomStore.getState();
  if (room) send({ type: 'leave', roomId: room.id });
  pendingOps.length = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopHeartbeat();
  const s = socket;
  socket = null;
  socketPromise = null;
  if (s) {
    try {
      s.close();
    } catch {
      /* ignore */
    }
  }
  useRoomStore.getState().leaveRoom();
}

function sendOp(op: RoomOp) {
  const { room } = useRoomStore.getState();
  if (!room) return;
  if (wsOpen()) {
    socket!.send(JSON.stringify({ type: 'op', roomId: room.id, op }));
  } else if (pendingOps.length < 200) {
    pendingOps.push(op);
  }
}

/** 广播光标位置（服务端只转发给同房间的人） */
export function broadcastCursor(payload: {
  x: number;
  y: number;
  draggingId: string | null;
}) {
  const { room, me } = useRoomStore.getState();
  if (!room || !me || !wsOpen()) return;
  socket!.send(
    JSON.stringify({
      type: 'cursor',
      roomId: room.id,
      cursor: {
        userId: me.id,
        userName: me.name,
        color: me.color,
        t: Date.now(),
        ...payload,
      },
    }),
  );
}

/** 构造新元素（带 z 层级） */
export function makeItem<T extends Item>(
  base: Omit<T, 'id' | 'createdAt' | 'z' | 'authorId'> & { authorId: string },
  maxZ: number,
): T {
  return { ...base, id: uid(), createdAt: Date.now(), z: maxZ + 1 } as T;
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  lastPong = Date.now();
  heartbeatTimer = setInterval(() => {
    if (!wsOpen()) return;
    // 心跳丢失：主动断开，交给重连逻辑
    if (Date.now() - lastPong > 45000) {
      try {
        socket!.close();
      } catch {
        /* ignore */
      }
      return;
    }
    send({ type: 'ping' });
  }, 20000);
}

/**
 * 本地增量 → 服务端的同步订阅。
 * 只对比自己的上一次状态，逐项发送 add / update / delete / restore，
 * 绝不发送整房快照。
 */
function subscribeDiff(roomId: string): () => void {
  const initial = useRoomStore.getState();
  let lastEpoch = initial.epoch;
  let prevItems: Record<string, Item> = initial.room?.items ?? {};
  let prevDeletedArr: string[] = initial.room?.deleted ?? [];
  let prevDeleted = new Set(prevDeletedArr);
  let prevItemsRef = initial.room?.items;

  return useRoomStore.subscribe((s) => {
    if (!s.room || s.room.id !== roomId) return;
    if (s.epoch !== lastEpoch) {
      lastEpoch = s.epoch;
      prevItems = s.room.items;
      prevDeletedArr = s.room.deleted;
      prevDeleted = new Set(prevDeletedArr);
      prevItemsRef = s.room.items;
      return;
    }
    if (s.room.items === prevItemsRef && s.room.deleted === prevDeletedArr) {
      return;
    }

    const cur = s.room.items;
    for (const [id, it] of Object.entries(cur)) {
      const old = prevItems[id];
      if (!old) {
        if (prevDeleted.has(id)) sendOp({ kind: 'restore', item: it });
        else sendOp({ kind: 'add', item: it });
      } else if (old !== it) {
        const patch: Record<string, unknown> = {};
        for (const key of Object.keys(it)) {
          if (
            (old as unknown as Record<string, unknown>)[key] !==
            (it as unknown as Record<string, unknown>)[key]
          ) {
            patch[key] = (it as unknown as Record<string, unknown>)[key];
          }
        }
        if (Object.keys(patch).length) {
          sendOp({ kind: 'update', id, patch });
        }
      }
    }

    for (const id of Object.keys(prevItems)) {
      if (!cur[id]) sendOp({ kind: 'delete', id });
    }

    prevItems = cur;
    prevDeletedArr = s.room.deleted;
    prevDeleted = new Set(prevDeletedArr);
    prevItemsRef = cur;
  });
}

/** 进入房间后启用：增量同步 + 心跳 */
export function useSync() {
  const roomId = useRoomStore((s) => s.room?.id);

  useEffect(() => {
    if (!roomId) return;
    startHeartbeat();
    const unsub = subscribeDiff(roomId);
    return () => {
      unsub();
      stopHeartbeat();
    };
  }, [roomId]);
}
