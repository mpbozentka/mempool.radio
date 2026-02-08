
import React, { useState, useEffect } from 'react';
import { Block } from '../types';

interface HeaderProps {
  lastBlock?: Block;
  mempoolCount: number;
}

const Header: React.FC<HeaderProps> = ({ lastBlock, mempoolCount }) => {
  const [secondsSinceBlock, setSecondsSinceBlock] = useState<number>(0);

  useEffect(() => {
    if (!lastBlock) return;
    
    const updateClock = () => {
      const now = Math.floor(Date.now() / 1000);
      setSecondsSinceBlock(now - lastBlock.timestamp);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [lastBlock]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine congestion color based on mempool count
  const getStatusColor = () => {
    if (mempoolCount < 20000) return 'bg-green-400 text-green-400';
    if (mempoolCount < 80000) return 'bg-yellow-400 text-yellow-400';
    return 'bg-red-500 text-red-500';
  };

  return (
    <header className="fixed top-0 left-0 right-0 p-8 flex justify-between items-start z-10 pointer-events-none">
      {/* Top bar: optional minimal status (e.g. last block ago) */}
      {lastBlock && (
        <div className="pointer-events-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-status-glow ${getStatusColor()}`}></div>
          <span className="text-[10px] text-gray-500 font-mono">
            Last block {formatTime(secondsSinceBlock)} ago
          </span>
        </div>
      )}
    </header>
  );
};

export default Header;
