// 本地会话记忆：昵称 / 贴纸色 / 上次房间 / URL 房号

export interface Profile {
  name: string;
  color: string;
}

const PROFILE_KEY = 'code-scrap-profile';
const LAST_ROOM_KEY = 'code-scrap-last-room';

export const loadProfile = (): Profile | null => {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    return p && p.name ? p : null;
  } catch {
    return null;
  }
};

export const saveProfile = (profile: Profile) => {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
};

export const loadLastRoom = (): string => {
  try {
    const id = localStorage.getItem(LAST_ROOM_KEY) || '';
    return /^\d{4}$/.test(id) ? id : '';
  } catch {
    return '';
  }
};

export const saveLastRoom = (roomId: string) => {
  try {
    localStorage.setItem(LAST_ROOM_KEY, roomId);
  } catch {
    /* ignore */
  }
};

/** 当前 URL 中的房号 */
export const getRoomFromUrl = (): string => {
  const id = new URLSearchParams(location.search).get('room') || '';
  return /^\d{4}$/.test(id) ? id : '';
};

/** 进房后把房号写进 URL，刷新可直接回到该房间 */
export const setRoomInUrl = (roomId: string) => {
  history.replaceState(null, '', `${location.pathname}?room=${roomId}`);
};

export const clearRoomInUrl = () => {
  history.replaceState(null, '', location.pathname);
};
