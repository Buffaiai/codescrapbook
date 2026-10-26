// 代码手账本 · WebSocket 房间服务器
// 内存房间 + 状态广播，支持跨设备双人协作
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = process.env.PORT || 8787;

// 房间存储: roomId -> { users: Map<ws, user>, items, timeline }
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      users: new Map(), // ws -> user
      items: {},
      timeline: [],
    });
  }
  return rooms.get(roomId);
}

function snapshot(room) {
  const users = {};
  for (const u of room.users.values()) users[u.id] = u;
  return {
    id: room.id,
    users,
    items: room.items,
    timeline: room.timeline,
  };
}

function broadcast(room, msg, exceptWs) {
  for (const ws of room.users.keys()) {
    if (ws !== exceptWs && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.roomId = null;
  ws.user = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'join': {
        const { roomId, user } = msg;
        if (!roomId || !user) return;
        const room = getRoom(roomId);
        ws.roomId = roomId;
        ws.user = user;
        room.users.set(ws, user);

        // 把当前房间快照发给新加入者
        ws.send(JSON.stringify({ type: 'snapshot', room: snapshot(room) }));
        // 通知其他人有新用户加入
        broadcast(
          room,
          { type: 'user-join', user },
          ws,
        );
        console.log(`[join] room=${roomId} user=${user.name} (total=${room.users.size})`);
        break;
      }

      case 'patch': {
        if (!ws.roomId) return;
        const room = rooms.get(ws.roomId);
        if (!room) return;
        console.log(`[patch] room=${ws.roomId} from=${ws.user?.name} keys=${Object.keys(msg.patch.items || {})} receivers=${room.users.size - 1}`);
        // 应用 patch 到服务端内存（作为权威源）
        if (msg.patch.items) room.items = { ...room.items, ...msg.patch.items };
        if (msg.patch.users) room.users.forEach((u, wsKey) => {
          // users 由 join/leave 管理，这里只合并已存在用户的信息变更（一般不用）
        });
        if (msg.patch.timeline) {
          const seen = new Set(room.timeline.map((t) => t.id));
          room.timeline = [
            ...room.timeline,
            ...msg.patch.timeline.filter((t) => !seen.has(t.id)),
          ].slice(-50);
        }
        broadcast(room, { type: 'patch', patch: msg.patch }, ws);
        break;
      }

      case 'cursor': {
        if (!ws.roomId) return;
        const room = rooms.get(ws.roomId);
        if (!room) return;
        broadcast(room, { type: 'cursor', cursor: msg.cursor }, ws);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (!ws.roomId || !ws.user) return;
    const room = rooms.get(ws.roomId);
    if (!room) return;
    room.users.delete(ws);
    broadcast(room, { type: 'user-leave', userId: ws.user.id });
    console.log(`[leave] room=${ws.roomId} user=${ws.user.name} (remain=${room.users.size})`);
    // 房间无人时清理
    if (room.users.size === 0) {
      // 延迟清理，避免短暂断连丢失数据
      setTimeout(() => {
        const r = rooms.get(ws.roomId);
        if (r && r.users.size === 0) rooms.delete(ws.roomId);
      }, 60000);
    }
  });
});

server.listen(PORT, () => {
  console.log(`CodeScrap WS server listening on :${PORT}`);
});
