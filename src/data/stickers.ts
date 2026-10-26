export interface StickerDef {
  id: string;
  text: string;
  color: string; // 底色
  textColor?: string;
}

// 至少 10 张文案贴纸
export const STICKERS: StickerDef[] = [
  { id: 's1', text: '今天写了', color: '#ffd66b' },
  { id: 's2', text: '卡关', color: '#ff9a8b' },
  { id: 's3', text: '顿悟', color: '#a8e6cf' },
  { id: 's4', text: '求讲解', color: '#c5b8ff' },
  { id: 's5', text: '已看过', color: '#b5ead7' },
  { id: 's6', text: '明天继续', color: '#ffb5a7' },
  { id: 's7', text: '踩坑', color: '#ffc8dd' },
  { id: 's8', text: '可复用', color: '#cdb4db' },
  { id: 's9', text: '别删', color: '#ffadad' },
  { id: 's10', text: '爱了', color: '#fdffb6' },
  { id: 's11', text: 'TODO', color: '#caffbf' },
  { id: 's12', text: 'Bug', color: '#ffc6ff' },
];

// 印章
export const STAMPS: StickerDef[] = [
  { id: 'st1', text: '搞定', color: '#c0392b', textColor: '#fff' },
  { id: 'st2', text: '联名', color: '#2c3e50', textColor: '#fff' },
];

// 和纸胶带颜色
export const TAPE_COLORS = [
  '#ffd66b',
  '#ff9a8b',
  '#a8e6cf',
  '#c5b8ff',
  '#b5ead7',
  '#ffb5a7',
];
