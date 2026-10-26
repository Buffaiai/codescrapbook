import { useState } from 'react';
import Home from './components/Home';
import Scrapbook from './components/Scrapbook';

export default function App() {
  const [view, setView] = useState<'home' | 'scrapbook'>('home');

  return view === 'home' ? (
    <Home onEnter={() => setView('scrapbook')} />
  ) : (
    <Scrapbook onLeave={() => setView('home')} />
  );
}
