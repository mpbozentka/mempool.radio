
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import Controls from './components/Controls';
import Visualizer, { VisualizerHandle } from './components/Visualizer';
import { MempoolSocket, ConnectionStatus } from './services/mempoolSocket';
import { audioEngine } from './services/audioEngine';
import { AppState, Transaction, Block, MempoolStats } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    btcPrice: 0,
    isAudioStarted: false,
    volume: 0.5,
    mempoolStats: { count: 0, vsize: 0, total_fee: 0 }
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

  const visualizerRef = useRef<VisualizerHandle>(null);
  const txQueue = useRef<any[]>([]);
  const timeoutRef = useRef<number | null>(null);
  
  // Rhythm Grid State
  const beatIndex = useRef<number>(0);
  // Base tempo for a laid back bluesy/jazzy vibe
  const BASE_INTERVAL = 200; 

  const fetchInitialData = async () => {
    try {
      const priceRes = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
      const priceData = await priceRes.json();
      const btcPrice = parseFloat(priceData.data.amount);

      const mempoolRes = await fetch('https://mempool.space/api/mempool');
      const mempoolData = await mempoolRes.json();
      
      setState(prev => ({ 
        ...prev, 
        btcPrice,
        mempoolStats: {
          count: mempoolData.count,
          vsize: mempoolData.vsize,
          total_fee: mempoolData.total_fee
        }
      }));
    } catch (err) {
      console.error('Initial data fetch error', err);
    }
  };

  useEffect(() => {
    fetchInitialData();
    const interval = setInterval(fetchInitialData, 60000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Bluesy/Jazzy Dispatcher:
   * Uses "Swing" timing where the grid alternates between a long and short duration.
   * This creates a shuffle (blues) or swing (jazz) feel.
   * Also ensures transactions are spread out even during high volume spikes.
   */
  const processNextTransaction = useCallback(() => {
    const qLen = txQueue.current.length;
    const isEvenBeat = beatIndex.current % 2 === 0;
    
    // Swing factor: 1.5 for bluesy shuffle, up to 2.0 for hard jazz swing.
    // We increase swing intensity slightly as the mempool gets busier.
    const swingFactor = qLen > 100 ? 1.8 : 1.4;
    
    // Calculate the duration for this specific step
    let stepDuration = isEvenBeat 
      ? BASE_INTERVAL * swingFactor 
      : BASE_INTERVAL * (2 - swingFactor);

    // Adjust global tempo based on congestion (speed up if queue is huge)
    const congestionSpeedUp = Math.min(2.5, 1 + qLen / 150);
    stepDuration = stepDuration / congestionSpeedUp;

    // Minimum duration to prevent audio glitching/crowding
    stepDuration = Math.max(40, stepDuration);

    // Deciding whether to play on this specific beat
    // We emphasize the "downbeats" (multiples of 4) for stability
    const isStrongBeat = beatIndex.current % 4 === 0;
    const probability = isStrongBeat ? 0.95 : 0.6;
    
    const shouldPlay = qLen > 0 && Math.random() < probability;

    if (shouldPlay) {
      const tx = txQueue.current.shift();
      if (tx) {
        const value = tx.value || 0;
        const feeRate = tx.feeRate || 1;

        if (audioEngine) {
          audioEngine.playTransaction(value, beatIndex.current);
        }
        if (visualizerRef.current) {
          visualizerRef.current.addTransaction({
            id: tx.txid || tx.id,
            value,
            feeRate
          });
        }
      }
    } else if (isEvenBeat && state.isAudioStarted && Math.random() < 0.2) {
        // Ghost notes to keep the rhythm alive
        audioEngine.playTransaction(0, beatIndex.current);
    }

    // Increment rhythm
    beatIndex.current = (beatIndex.current + 1) % 16;

    timeoutRef.current = window.setTimeout(processNextTransaction, stepDuration);
  }, [state.isAudioStarted]);

  useEffect(() => {
    processNextTransaction();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [processNextTransaction]);

  const handleNewTransaction = useCallback((tx: any) => {
    const value = tx.value || (tx.vsize ? tx.vsize * 120 : 10000); 
    const feeRate = tx.feeRate || (tx.fee ? tx.fee / tx.vsize : 1);
    
    setState(prev => ({
      ...prev,
      mempoolStats: {
        ...prev.mempoolStats,
        count: prev.mempoolStats.count + 1
      }
    }));

    // Add to queue for scheduled playback
    txQueue.current.push({ ...tx, value, feeRate });
    
    // Cap queue to prevent memory leak and excessive delay
    if (txQueue.current.length > 5000) txQueue.current.splice(0, 500);
  }, []);

  const handleNewBlock = useCallback((block: Block) => {
    setState(prev => ({ ...prev, lastBlock: block }));
    if (audioEngine) audioEngine.playBlockConfirm();
    if (visualizerRef.current) visualizerRef.current.flashBlock();
  }, []);

  const handleStats = useCallback((stats: MempoolStats) => {
    setState(prev => ({ 
      ...prev, 
      mempoolStats: {
        ...stats,
        count: Math.max(prev.mempoolStats.count, stats.count)
      }
    }));
  }, []);

  useEffect(() => {
    const socket = new MempoolSocket(
      handleNewTransaction,
      handleNewBlock,
      handleStats,
      setConnectionStatus
    );
    socket.connect();
    return () => socket.disconnect();
  }, [handleNewTransaction, handleNewBlock, handleStats]);

  const startAudio = async () => {
    await audioEngine.init();
    audioEngine.setVolume(state.volume);
    setState(prev => ({ ...prev, isAudioStarted: true }));
  };

  const handleVolumeChange = (vol: number) => {
    setState(prev => ({ ...prev, volume: vol }));
    audioEngine.setVolume(vol);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#050208] selection:bg-green-500/30">
      <Visualizer ref={visualizerRef} blockHeight={state.lastBlock?.height} btcPrice={state.btcPrice} />
      
      {state.isAudioStarted && (
        <Header 
          lastBlock={state.lastBlock} 
          mempoolCount={state.mempoolStats.count} 
        />
      )}
      
      <Controls 
        isAudioStarted={state.isAudioStarted}
        onStartAudio={startAudio}
        volume={state.volume}
        onVolumeChange={handleVolumeChange}
        mempoolCount={state.mempoolStats.count}
        btcPrice={state.btcPrice}
        lastBlock={state.lastBlock}
      />

      {!state.isAudioStarted && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-3xl z-50 p-6 text-center">
          <div className="max-w-3xl flex flex-col items-center">
            <h1 className="text-5xl md:text-6xl font-black text-white mb-12 logo-font tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-green-400 via-yellow-400 to-red-600 drop-shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              MEMPOOL.RADIO
            </h1>
            <p className="text-gray-300 mb-16 leading-relaxed font-light text-2xl md:text-3xl max-w-xl mx-auto opacity-90">
              The natural mystic of the Bitcoin chain. 
              Real-time transactions flow through island rhythms of warm organs and steel drums.
            </p>
            <button
              onClick={startAudio}
              className="px-16 py-8 bg-white text-black font-black rounded-full transition-all hover:scale-[1.05] active:scale-95 shadow-[0_0_60px_rgba(255,255,255,0.2)] logo-font tracking-[0.2em] text-3xl hover:bg-green-500 hover:text-white"
            >
              FEEL THE CHAIN
            </button>
            <div className="mt-16 text-[12px] uppercase tracking-[0.6em] text-gray-500 font-black animate-pulse">
              ONE CHAIN • ONE LOVE • GENESIS 2009
            </div>
            <div className="mt-6 text-[11px] text-gray-500 font-mono">
              {connectionStatus === 'connecting' && 'Connecting to chain…'}
              {connectionStatus === 'connected' && 'Live'}
              {connectionStatus === 'disconnected' && 'Reconnecting…'}
            </div>
          </div>
        </div>
      )}

      {/* Tropical Scanline Filter */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.04] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%),linear-gradient(90deg,rgba(255,0,0,0.08),rgba(0,255,0,0.03),rgba(0,0,255,0.08))] z-40 bg-[length:100%_3px,4px_100%]"></div>
    </div >
  );
};

export default App;
