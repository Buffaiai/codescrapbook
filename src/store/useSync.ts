import { useEffect, useRef } from 'react';
import { useRoomStore } from './useRoomStore';
import type { SyncMessage, Item } from '../types';
import { uid } from '../utils/id';

// WebSocket 地址：生产走同源 /ws（Nginx 反代），开发直连 8787
const WS_URL =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? `ws://${location.hostname}:8787`
    : `wss://${location.host}/ws`;

// 模块级 WS 实例与 BC 通道，供光标广播复用
let ws: WebSocket | null = null;
let bc: BroadcastChannel | null = null;

/**
 * 双人同步：WebSocket（跨设备）+ BroadcastChannel（同浏览器多标签补充）
 */
export function useSync() {
  const room = useRoomStore((s) => s.room);
  const me = useRoomStore((s) => s.me);
  const remoteFlag = useRef(false); // 本次更新来自远端，避免回环
  const joinedRef = useRef(false);

  // ---- WebSocket 连接 ----
  useEffect(() => {
    if (!room || !me) return;

    const connect = () => {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'join', roomId: room.id, user: me }));
        joinedRef.current = true;
      };

      ws.onmessage = (e) => {
        let msg: any;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        const st = useRoomStore.getState();

        switch (msg.type) {
          case 'snapshot': {
            // 用服务端权威快照覆盖（保留自己）
            const merged = {
              ...msg.room,
              users: { ...msg.room.users, [me.id]: me },
            };
            remoteFlag.current = true;
            st.setRoom(merged);
            break;
          }
          case 'patch': {
            remoteFlag.current = true;
            st.applyPatch(msg.patch);
            break;
          }
          case 'cursor': {
            if (msg.cursor.userId !== me.id) st.setCursor(msg.cursor);
            break;
          }
          case 'user-join': {
            st.addUser(msg.user);
            break;
          }
          case 'user-leave': {
            st.removeUser(msg.userId);
            st.removeCursor(msg.userId);
            break;
          }
        }
      };

      ws.onclose = () => {
        joinedRef.current = false;
        // 5 秒后重连
        setTimeout(connect, 5000);
      };

      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      ws?.close();
      ws = null;
      joinedRef.current = false;
    };
  }, [room?.id, me?.id]);

  // ---- BroadcastChannel（同浏览器多标签补充） ----
  useEffect(() => {
    if (!room || !me) return;
    bc = new BroadcastChannel(`code-scrap-${room.id}`);

    // 同浏览器的其他标签页也能即时看到（不依赖 WS）
    bc.onmessage = (e: MessageEvent<SyncMessage>) => {
      const msg = e.data;
      if (msg.roomId !== room.id) return;
      const st = useRoomStore.getState();
      if (msg.type === 'patch') {
        remoteFlag.current = true;
        st.applyPatch(msg.patch);
      } else if (msg.type === 'cursor' && msg.cursor.userId !== me.id) {
        st.setCursor(msg.cursor);
      } else if (msg.type === 'user-join') {
        st.addUser(msg.user);
      } else if (msg.type === 'user-leave') {
        st.removeUser(msg.userId);
      }
    };

    return () => {
      bc?.close();
      bc = null;
    };
  }, [room?.id, me?.id]);

  // ---- 本地变更 → 同时发给 WS 服务端 + BC ----
  useEffect(() => {
    if (!room) return;
    let lastItems = JSON.stringify(room.items);
    let lastUsers = JSON.stringify(room.users);
    let lastTimeline = JSON.stringify(room.timeline);

    const unsub = useRoomStore.subscribe((state) => {
      if (remoteFlag.current) {
        remoteFlag.current = false;
        return;
      }
      if (!state.room) return;

      const itemsStr = JSON.stringify(state.room.items);
      const usersStr = JSON.stringify(state.room.users);
      const tlStr = JSON.stringify(state.room.timeline);

      const patch: Partial<typeof state.room> = {};
      let changed = false;
      if (itemsStr !== lastItems) {
        patch.items = state.room.items;
        lastItems = itemsStr;
        changed = true;
      }
      if (usersStr !== lastUsers) {
        patch.users = state.room.users;
        lastUsers = usersStr;
        changed = true;
      }
      if (tlStr !== lastTimeline) {
        patch.timeline = state.room.timeline;
        lastTimeline = tlStr;
        changed = true;
      }
      if (!changed) return;

      // 发给 WS 服务端（跨设备）
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'patch', roomId: state.room.id, patch }));
      }
      // 发给 BC（同浏览器）
      bc?.postMessage({ type: 'patch', roomId: state.room.id, patch } as SyncMessage);
    });
    return unsub;
  }, [room?.id]);

  // 清理掉线光标
  useEffect(() => {
    const t = setInterval(() => useRoomStore.getState().pruneCursors(), 3000);
    return () => clearInterval(t);
  }, []);
}

/** 广播光标位置 */
export function broadcastCursor(payload: {
  x: number;
  y: number;
  draggingId: string | null;
}) {
  const { room, me } = useRoomStore.getState();
  if (!room || !me) return;
  const cursor = {
    userId: me.id,
    userName: me.name,
    color: me.color,
    t: Date.now(),
    ...payload,
  };
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'cursor', roomId: room.id, cursor }));
  }
  bc?.postMessage({ type: 'cursor', roomId: room.id, cursor } as SyncMessage);
}

/** 构造新元素（带 z 层级） */
export function makeItem<T extends Item>(
  base: Omit<T, 'id' | 'createdAt' | 'z' | 'authorId'> & { authorId: string },
  maxZ: number,
): T {
  return { ...base, id: uid(), createdAt: Date.now(), z: maxZ + 1 } as T;
}
