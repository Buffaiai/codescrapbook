import { useEffect, useRef, useState } from 'react';
import Home from './components/Home';
import Scrapbook from './components/Scrapbook';
import { enterRoomRemote, leaveRoomRemote } from './store/useSync';
import { uid } from './utils/id';
import { clearRoomInUrl, getRoomFromUrl, loadProfile } from './utils/session';

export default function App() {
  const [view, setView] = useState<'home' | 'scrapbook'>('home');
  const [restoring, setRestoring] = useState(() => !!getRoomFromUrl());
  const started = useRef(false);

  // 刷新恢复：URL 带 ?room= 且有昵称记忆时直接回到该房间
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const roomId = getRoomFromUrl();
    if (!roomId) {
      setRestoring(false);
      return;
    }
    const profile = loadProfile();
    if (!profile) {
      clearRoomInUrl();
      setRestoring(false);
      return;
    }
    const user = { id: uid(), name: profile.name, color: profile.color };
    enterRoomRemote(roomId, user, 'join').then((res) => {
      if (res.ok) {
        setView('scrapbook');
      } else {
        clearRoomInUrl();
        setView('home');
      }
      setRestoring(false);
    });
  }, []);

  const handleLeave = () => {
    leaveRoomRemote();
    clearRoomInUrl();
    setView('home');
  };

  if (restoring) {
    return <div className="paper-bg" style={{ width: '100vw', height: '100vh' }} />;
  }

  return view === 'home' ? (
    <Home onEnter={() => setView('scrapbook')} />
  ) : (
    <Scrapbook onLeave={handleLeave} />
  );
}
