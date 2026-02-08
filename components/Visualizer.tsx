
import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';

interface Bubble {
  id: string;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  baseHue: number;
  alpha: number;
  life: number;
  value: number;
  feeRate: number;
  noiseOffsets: number[]; // Unique offsets for each vertex
  isWhale: boolean;
  pulseOffset: number;
}

export interface VisualizerHandle {
  addTransaction: (tx: { id: string, value: number, feeRate: number }) => void;
  flashBlock: () => void;
}

interface VisualizerProps {
  blockHeight?: number;
  btcPrice: number;
}

const Visualizer = forwardRef<VisualizerHandle, VisualizerProps>(({ blockHeight, btcPrice }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const flashAlphaRef = useRef(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const isOverCanvasRef = useRef(false);
  const avgFeeRateRef = useRef(1);
  
  const [hoveredTx, setHoveredTx] = useState<Bubble | null>(null);

  // Helper to map fee rate to a nuanced tropical/cyber hue
  const getHueFromFeeRate = (feeRate: number) => {
    // 1 sat/vB -> 210 (Deep Blue)
    // 50 sat/vB -> 140 (Island Green)
    // 150 sat/vB -> 45 (Sunset Orange/Yellow)
    // 400+ sat/vB -> 0 (Fiery Red)
    if (feeRate <= 1) return 210;
    if (feeRate <= 50) return 210 - (feeRate / 50) * 70;
    if (feeRate <= 150) return 140 - ((feeRate - 50) / 100) * 95;
    return Math.max(0, 45 - ((feeRate - 150) / 250) * 45);
  };

  useImperativeHandle(ref, () => ({
    addTransaction: (tx) => {
      const btc = tx.value / 100_000_000;
      const radius = Math.max(20, Math.min(180, Math.sqrt(btc * 30000) + 30));
      const isWhale = btc >= 1.0;
      
      const canvas = canvasRef.current;
      if (!canvas) return;

      const numVertices = 14;
      const noiseOffsets = Array.from({ length: numVertices }, () => Math.random() * Math.PI * 2);

      bubblesRef.current.push({
        id: tx.id || Math.random().toString(),
        x: Math.random() * canvas.width,
        y: canvas.height + radius * 2,
        radius,
        vx: (Math.random() - 0.5) * 0.7,
        vy: isWhale ? -(Math.random() * 0.2 + 0.1) : -(Math.random() * 1.5 + 0.4),
        baseHue: getHueFromFeeRate(tx.feeRate),
        alpha: 0.85,
        life: 1.0,
        value: tx.value,
        feeRate: tx.feeRate,
        noiseOffsets,
        isWhale,
        pulseOffset: Math.random() * 1000
      });

      avgFeeRateRef.current = avgFeeRateRef.current * 0.98 + tx.feeRate * 0.02;
    },
    flashBlock: () => {
      flashAlphaRef.current = 1.0;
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.015;
      
      const congestionIntensity = Math.min(1, avgFeeRateRef.current / 300);
      const bgColor = `rgba(${6 + congestionIntensity * 35}, ${10 + congestionIntensity * 5}, ${20}, 1)`;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- Cyber Grid ---
      ctx.strokeStyle = `rgba(34, 197, 94, ${0.03 + congestionIntensity * 0.07})`;
      ctx.lineWidth = 1;
      const gridSize = 120;
      const gridOffset = (time * 15) % gridSize;
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
      }
      for (let y = gridOffset; y <= canvas.height; y += gridSize) {
        ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();

      // --- Fluid Bubbles ---
      const bubbles = bubblesRef.current;
      let currentHover: Bubble | null = null;

      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        // Drift movement
        b.x += b.vx + Math.sin(time * 0.5 + b.pulseOffset) * 0.4;
        b.y += b.vy;
        b.life -= 0.0007;
        b.alpha = Math.min(0.9, b.life * 3);

        const dx = b.x - mouseRef.current.x;
        const dy = b.y - mouseRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < b.radius) currentHover = b;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        
        // Render organic, asymmetrical blob shape
        const numV = b.noiseOffsets.length;
        for (let j = 0; j <= numV; j++) {
          const idx = j % numV;
          const angle = (j / numV) * Math.PI * 2;
          
          // Combine multiple noise components for fluid asymmetrical wobbling
          const noiseFactor = 
            Math.sin(time * 1.5 + b.noiseOffsets[idx]) * 0.12 +
            Math.cos(time * 0.8 + b.noiseOffsets[(idx + 3) % numV]) * 0.08;
          
          const currentRadius = b.radius * (1 + noiseFactor);
          const px = b.x + Math.cos(angle) * currentRadius;
          const py = b.y + Math.sin(angle) * currentRadius;
          
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        // Complex Multi-layered Gradient
        const gradX = b.x + Math.sin(time * 2 + b.pulseOffset) * (b.radius * 0.3);
        const gradY = b.y + Math.cos(time * 1.5 + b.pulseOffset) * (b.radius * 0.2);
        const gradient = ctx.createRadialGradient(gradX, gradY, 0, b.x, b.y, b.radius * 1.3);
        
        const coreHue = b.isWhale ? 45 : b.baseHue;
        const sat = b.isWhale ? '100%' : '90%';
        const light = b.isWhale ? '75%' : '55%';
        
        gradient.addColorStop(0, `hsla(${coreHue}, ${sat}, ${light}, ${b.alpha})`);
        gradient.addColorStop(0.4, `hsla(${coreHue}, ${sat}, ${light}, ${b.alpha * 0.8})`);
        gradient.addColorStop(0.7, `hsla(${coreHue}, ${sat}, 40%, ${b.alpha * 0.6})`);
        gradient.addColorStop(1, `hsla(${coreHue}, ${sat}, 20%, 0)`);

        ctx.fillStyle = gradient;
        ctx.fill();

        // Subtle glowing rim
        if (b.isWhale || b.feeRate > 100) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = `hsla(${coreHue}, ${sat}, 80%, ${b.alpha * 0.3})`;
          ctx.stroke();
        }

        ctx.restore();
        
        if (b.life <= 0 || b.y + b.radius * 3 < 0) bubbles.splice(i, 1);
      }
      // Only show transaction tooltip when cursor is over the canvas and over a bubble
      setHoveredTx(isOverCanvasRef.current ? currentHover : null);

      // --- Canvas Overlay UI (Centered Top) ---
      ctx.save();
      const centerX = canvas.width / 2;
      ctx.textAlign = 'center';
      
      ctx.font = 'bold 32px Orbitron';
      const logoGrad = ctx.createLinearGradient(centerX - 200, 0, centerX + 200, 0);
      logoGrad.addColorStop(0, '#4ade80');
      logoGrad.addColorStop(0.5, '#facc15');
      logoGrad.addColorStop(1, '#ef4444');
      ctx.fillStyle = logoGrad;
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.fillText('MEMPOOL.RADIO', centerX, 60);
      
      ctx.font = '13px Share Tech Mono';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.letterSpacing = '5px';
      ctx.fillText('NATURAL MYSTIC • ONE CHAIN • ONE LOVE', centerX, 85);
      
      ctx.restore();

      if (flashAlphaRef.current > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlphaRef.current * 0.4})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        flashAlphaRef.current -= 0.008;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      isOverCanvasRef.current = e.target === canvas;
    };
    const handleMouseLeave = () => {
      isOverCanvasRef.current = false;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    handleResize();
    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [blockHeight]);

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 z-0 block cursor-crosshair" />
      {hoveredTx && (
        <div 
          className="fixed pointer-events-none z-50 p-6 rounded-3xl bg-[#0a120b]/95 backdrop-blur-3xl border border-green-500/20 shadow-[0_0_80px_rgba(34,197,94,0.15)] transition-all duration-200"
          style={{ 
            left: Math.min(window.innerWidth - 300, mouseRef.current.x + 25), 
            top: Math.min(window.innerHeight - 220, mouseRef.current.y + 25) 
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-4 h-4 rounded-full ${hoveredTx.isWhale ? 'bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'bg-green-400'}`}></div>
            <div className="text-[11px] text-green-400 uppercase tracking-[0.3em] font-black">
                {hoveredTx.isWhale ? 'LEGENDARY WHALE' : 'ISLAND TRANSFERS'}
            </div>
          </div>
          <div className="text-4xl font-bold text-white mb-4 font-mono tracking-tighter">
            {(hoveredTx.value / 100_000_000).toFixed(4)} <span className="text-sm text-yellow-300 font-black">BTC</span>
          </div>
          <div className="grid grid-cols-2 gap-8 border-t border-white/5 pt-5">
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Priority</div>
              <div className="text-xl text-pink-500 font-mono">{hoveredTx.feeRate.toFixed(1)} <span className="text-[10px] opacity-70">sat/vB</span></div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">USD Value</div>
              <div className="text-xl text-cyan-400 font-mono">
                ${((hoveredTx.value / 100_000_000) * btcPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

Visualizer.displayName = 'Visualizer';

export default Visualizer;
