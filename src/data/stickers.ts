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

// 印章：5 枚，颜色各不相同
export const STAMPS: StickerDef[] = [
  { id: 'st1', text: '搞定', color: '#c0392b', textColor: '#fff' },
  { id: 'st2', text: '联名', color: '#2c3e50', textColor: '#fff' },
  { id: 'st3', text: '打卡', color: '#2f7d5b', textColor: '#fff' },
  { id: 'st4', text: '学到了', color: '#3b6fb5', textColor: '#fff' },
  { id: 'st5', text: '下班', color: '#8e44ad', textColor: '#fff' },
];

// 和纸胶带颜色（带名称，抽屉里悬停可见）
export const TAPE_COLORS: { color: string; name: string }[] = [
  { color: '#ffd66b', name: '奶油黄' },
  { color: '#ff9a8b', name: '珊瑚粉' },
  { color: '#a8e6cf', name: '抹茶绿' },
  { color: '#c5b8ff', name: '雾紫' },
  { color: '#b5ead7', name: '薄荷' },
  { color: '#ffb5a7', name: '蜜桃' },
];
