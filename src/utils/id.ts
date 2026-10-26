// 轻量唯一 id（时间戳 + 随机）
export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// 生成 4 位房号
export const genRoomId = (): string =>
  Math.floor(1000 + Math.random() * 9000).toString();
