// 代码手账本 · WebSocket 房间服务器
// 服务端是唯一真相：只接收增量操作（add/update/delete/restore），房间数据持久化。
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.PORT || 8787;
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = process.env.ROOMS_FILE || join(__dirname, 'rooms.json');

/** roomId -> { id, items, timeline, deleted:Set, users:Map<ws, user> } */
const rooms = new Map();

// ---------- 持久化 ----------
function loadRooms() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    for (const r of raw?.rooms ?? []) {
      if (!r || !r.id) continue;
      const deleted = new Set(Array.isArray(r.deleted) ? r.deleted : []);
      const items = r.items && typeof r.items === 'object' ? { ...r.items } : {};
      for (const id of deleted) delete items[id];
      const timeline = Array.isArray(r.timeline) ? r.timeline.slice(-50) : [];
      // 旧数据补全作者名/色：从时间线里找回作者信息，保证名签刷新后不丢
      const authors = new Map();
      for (const t of timeline) {
        if (t && t.userId) {
          authors.set(t.userId, { name: t.userName, color: t.userColor });
        }
      }
      for (const it of Object.values(items)) {
        if (!it || it.authorName) continue;
        const a = authors.get(it.authorId);
        if (a?.name) {
          it.authorName = a.name;
          it.authorColor = a.color;
        }
      }
      rooms.set(String(r.id), {
        id: String(r.id),
        items,
        timeline,
        deleted,
        users: new Map(),
      });
    }
    console.log(`[load] ${rooms.size} rooms from ${DATA_FILE}`);
  } catch (err) {
    console.error('[load] failed:', err.message);
  }
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveRooms();
  }, 400);
}

function saveRooms() {
  try {
    const out = [...rooms.values()].map((r) => ({
      id: r.id,
      items: r.items,
      timeline: r.timeline,
      deleted: [...r.deleted],
    }));
    writeFileSync(DATA_FILE, JSON.stringify({ rooms: out }), 'utf8');
  } catch (err) {
    console.error('[save] failed:', err.message);
  }
}

// ---------- 工具 ----------
let entrySeq = 0;
const entryId = () => `t${Date.now().toString(36)}${(entrySeq++).toString(36)}`;

function onlineUsers(room) {
  const map = new Map();
  for (const u of room.users.values()) map.set(u.id, u);
  return [...map.values()];
}

function snapshot(room) {
  const users = {};
  for (const u of onlineUsers(room)) users[u.id] = u;
  return {
    id: room.id,
    users,
    items: room.items,
    timeline: room.timeline,
    deleted: [...room.deleted],
  };
}

function broadcast(room, msg, exceptWs) {
  for (const ws of room.users.keys()) {
    if (ws !== exceptWs && ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }
}

function sendTo(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcastPresence(room) {
  const msg = { type: 'presence', roomId: room.id, users: onlineUsers(room) };
  for (const ws of room.users.keys()) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }
}

function labelOf(item) {
  if (!item) return '';
  if (item.type === 'code') {
    const firstLine = String(item.text || '').split('\n')[0];
    return item.note ? `${item.note} · ${firstLine}` : firstLine;
  }
  if (item.type === 'tape') return '胶带';
  return String(item.text || '');
}

function makeTimeline(room, user, action, item, forcedId) {
  const entry = {
    id: forcedId || entryId(),
    userId: user.id,
    userName: user.name,
    userColor: user.color,
    action,
    itemType: item?.type,
    itemText: item ? labelOf(item) : '',
    timestamp: Date.now(),
  };
  room.timeline = [...room.timeline, entry].slice(-50);
  return entry;
}

// 进出房间记录防抖：刷新/断线重连时先挂起离开记录，同名用户很快回来就整对抵消
const presenceTimers = new Map();
const presenceKey = (roomId, name) => `${roomId}:${name}`;

function leaveRoom(ws) {
  if (!ws.roomId) return;
  const room = rooms.get(ws.roomId);
  if (room && room.users.has(ws)) {
    const user = room.users.get(ws) || ws.user;
    const roomId = ws.roomId;
    room.users.delete(ws);
    // 延迟 4s 再记“离开”，期间同名用户重新进房（刷新）则取消，不刷屏
    if (user) {
      const key = presenceKey(roomId, user.name);
      const prev = presenceTimers.get(key);
      if (prev) clearTimeout(prev);
      presenceTimers.set(
        key,
        setTimeout(() => {
          presenceTimers.delete(key);
          const r = rooms.get(roomId);
          if (!r) return;
          const back = [...r.users.values()].some((u) => u.name === user.name);
          if (back) return;
          const entry = makeTimeline(r, user, 'leave', null);
          broadcast(r, { type: 'timeline', entry }, null);
          scheduleSave();
        }, 4000),
      );
    }
    broadcastPresence(room);
  }
  ws.roomId = null;
  ws.user = null;
}

function joinRoom(ws, roomId, user, reqId, isCreate) {
  let room = rooms.get(roomId);
  if (!room) {
    if (!isCreate) {
      sendTo(ws, {
        type: 'error',
        reqId,
        code: 'ROOM_NOT_FOUND',
        message: '房间不存在，请核对房号',
      });
      return;
    }
    room = {
      id: roomId,
      items: {},
      timeline: [],
      deleted: new Set(),
      users: new Map(),
    };
    rooms.set(roomId, room);
    scheduleSave();
  } else if (isCreate) {
    sendTo(ws, {
      type: 'error',
      reqId,
      code: 'ROOM_EXISTS',
      message: '房间号已被占用',
    });
    return;
  }

  if (ws.roomId && ws.roomId !== roomId) leaveRoom(ws);
  ws.roomId = roomId;
  ws.user = user;
  room.users.set(ws, user);

  // 加入房间记一条时间线；若是刷新/重连（存在挂起的离开记录），则取消离开并跳过加入，避免刷屏
  const key = presenceKey(roomId, user.name);
  const pendingLeave = presenceTimers.get(key);
  let joinEntry = null;
  if (pendingLeave) {
    clearTimeout(pendingLeave);
    presenceTimers.delete(key);
  } else {
    joinEntry = makeTimeline(room, user, 'join', null);
  }

  // 只由服务端下发快照，客户端绝不回传
  sendTo(ws, { type: 'snapshot', reqId, room: snapshot(room) });
  if (joinEntry) broadcast(room, { type: 'timeline', entry: joinEntry }, null);
  broadcastPresence(room);
  scheduleSave();
  console.log(
    `[join] room=${roomId} user=${user.name} online=${room.users.size}`,
  );
}

function handleOp(ws, roomId, op) {
  if (!ws.roomId || ws.roomId !== roomId) return;
  const room = rooms.get(roomId);
  if (!room || !op) return;
  const user = ws.user || { id: '?', name: '?', color: '#888' };
  let entry = null;

  switch (op.kind) {
    case 'add': {
      let item = op.item;
      if (!item || !item.id) return;
      if (room.deleted.has(item.id)) {
        // 已删元素永不复活：驳回并通知发送方立刻移除
        sendTo(ws, { type: 'op', op: { kind: 'delete', id: item.id } });
        return;
      }
      // 作者名/色随卡片一起落库（兼容未带该字段的旧客户端）
      if (!item.authorName) {
        item = { ...item, authorName: user.name, authorColor: user.color };
        op = { ...op, item };
      }
      room.items[item.id] = item;
      // 与客户端本地先写入的条目共用同一 id，避免重复记一条
      entry = makeTimeline(room, user, 'add', item, `tl-${item.id}`);
      break;
    }
    case 'update': {
      const cur = room.items[op.id];
      if (!cur || room.deleted.has(op.id)) return;
      const patch = op.patch && typeof op.patch === 'object' ? op.patch : {};
      const next = { ...cur, ...patch };
      room.items[op.id] = next;
      if (typeof patch.text === 'string' && patch.text !== cur.text) {
        entry = makeTimeline(room, user, 'edit', next);
      }
      break;
    }
    case 'delete': {
      const cur = room.items[op.id];
      if (cur) {
        delete room.items[op.id];
        entry = makeTimeline(room, user, 'delete', cur);
      }
      room.deleted.add(op.id);
      break;
    }
    case 'restore': {
      const item = op.item;
      if (!item || !item.id) return;
      room.deleted.delete(item.id);
      room.items[item.id] = item;
      break;
    }
    default:
      return;
  }

  broadcast(room, { type: 'op', op }, ws);
  if (entry) {
    broadcast(room, { type: 'timeline', entry }, null);
  }
  scheduleSave();
}

// ---------- HTTP：健康检查 / 房间存在性（兼容旧的 HTTP 探测） ----------
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  const byPath = url.pathname.match(/^\/rooms\/([^/]+)\/exists$/);
  if (byPath || url.pathname === '/exists') {
    let roomId = url.searchParams.get('room') || '';
    if (byPath) {
      try {
        roomId = decodeURIComponent(byPath[1]);
      } catch {
        roomId = '';
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ exists: !!roomId && rooms.has(roomId) }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.roomId = null;
  ws.user = null;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'check-room': {
        sendTo(ws, {
          type: 'room-check',
          reqId: msg.reqId,
          exists: !!msg.roomId && rooms.has(String(msg.roomId)),
        });
        break;
      }
      case 'join': {
        if (!msg.roomId || !msg.user) return;
        joinRoom(ws, String(msg.roomId), msg.user, msg.reqId, false);
        break;
      }
      case 'create': {
        if (!msg.roomId || !msg.user) return;
        joinRoom(ws, String(msg.roomId), msg.user, msg.reqId, true);
        break;
      }
      case 'leave': {
        leaveRoom(ws);
        break;
      }
      case 'op': {
        handleOp(ws, msg.roomId, msg.op);
        break;
      }
      case 'cursor': {
        if (!ws.roomId || !msg.cursor) return;
        const room = rooms.get(ws.roomId);
        if (!room) return;
        broadcast(room, { type: 'cursor', roomId: room.id, cursor: msg.cursor }, ws);
        break;
      }
      case 'ping': {
        sendTo(ws, { type: 'pong' });
        break;
      }
    }
  });

  ws.on('close', () => {
    leaveRoom(ws);
  });
});

// 心跳兜底：清理异常断开的连接，避免幽灵在线
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      /* ignore */
    }
  }
}, 30000);

wss.on('close', () => clearInterval(heartbeat));

function shutdown() {
  saveRooms();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

loadRooms();
server.listen(PORT, () => {
  console.log(`CodeScrap WS server listening on :${PORT}`);
});
