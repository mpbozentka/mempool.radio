import React from 'react';
import { Block } from '../types';

interface ControlsProps {
  isAudioStarted: boolean;
  onStartAudio: () => void;
  volume: number;
  onVolumeChange: (val: number) => void;
  mempoolCount: number;
  btcPrice: number;
  lastBlock?: Block;
}

const Controls: React.FC<ControlsProps> = ({
  isAudioStarted,
  onStartAudio,
  volume,
  onVolumeChange,
  btcPrice,
  lastBlock
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 flex items-end justify-between gap-4 z-10 pointer-events-none">
      <div className="pointer-events-auto">
        <div className="flex items-center gap-2 bg-[#081a0e]/60 backdrop-blur-md border border-green-900/40 px-3 py-2 rounded-xl shadow-2xl">
          {!isAudioStarted ? (
            <button
              onClick={onStartAudio}
              className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-yellow-600 hover:from-green-500 hover:to-yellow-500 text-white font-bold rounded-lg transition-all active:scale-95 shadow-[0_0_25px_rgba(34,197,94,0.3)] logo-font tracking-widest text-sm"
            >
              OPEN AUDIO CHANNEL
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-green-400 uppercase font-black tracking-[0.15em] whitespace-nowrap">Volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-20 h-1.5 bg-green-900/50 rounded-lg appearance-none cursor-pointer accent-green-400"
              />
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-auto text-right">
        <div className="bg-black/40 backdrop-blur-md border border-white/5 px-4 py-3 rounded-xl shadow-2xl inline-block">
          <div className="text-[10px] text-yellow-500 uppercase tracking-[0.2em] font-black mb-0.5">BTC</div>
          <div className="text-xl font-bold text-white leading-tight font-mono tracking-tighter">
            ${btcPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-black mt-1.5">Block height</div>
          <div className="text-lg font-bold text-white font-mono tabular-nums">
            {lastBlock ? lastBlock.height.toLocaleString() : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Controls;
