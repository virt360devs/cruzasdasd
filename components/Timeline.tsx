import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Cue } from '../types';
import { formatTime } from '../utils/audioUtils';
import { Plus, GripVertical, Trash2, ZoomIn, ZoomOut, Crosshair } from 'lucide-react';

interface TimelineProps {
  audioBuffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  cues: Cue[];
  waveformColor: string;
  onSeek: (time: number) => void;
  onAddCue: (time: number) => void;
  onUpdateCue: (id: string, updates: Partial<Cue>) => void;
  onDeleteCue: (id: string) => void;
}

const MIN_ZOOM = 10;
const MAX_ZOOM = 600;
const NUM_ROWS = 4;
const COLORS = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#a855f7', // Purple
    '#ec4899', // Pink
];

export const Timeline: React.FC<TimelineProps> = ({
  audioBuffer,
  currentTime,
  duration,
  isPlaying,
  cues,
  waveformColor,
  onSeek,
  onAddCue,
  onUpdateCue,
  onDeleteCue,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // View State
  const [zoom, setZoom] = useState(100);
  const [isFollowing, setIsFollowing] = useState(true);
  const [viewCenterTime, setViewCenterTime] = useState(0);
  
  // Interaction State
  const [draggingCueId, setDraggingCueId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [snapToGrid, setSnapToGrid] = useState(true);

  // Sync view center with playback if following
  useEffect(() => {
    if (isFollowing) {
      setViewCenterTime(currentTime);
    }
  }, [currentTime, isFollowing]);

  // Generate waveform data
  const waveformPeaks = useMemo(() => {
    if (!audioBuffer) return [];
    
    const samplesPerSecond = 200; 
    const totalSamples = Math.ceil(duration * samplesPerSecond);
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / totalSamples);
    const peaks = new Float32Array(totalSamples);
    
    for (let i = 0; i < totalSamples; i++) {
      const start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize; j += 10) { 
         sum += Math.abs(channelData[start + j]);
      }
      peaks[i] = sum / (blockSize / 10);
    }
    
    let max = 0;
    for(let i=0; i<peaks.length; i++) if(peaks[i] > max) max = peaks[i];
    const multiplier = 1 / (max || 1);
    for(let i=0; i<peaks.length; i++) peaks[i] *= multiplier;

    return peaks;
  }, [audioBuffer, duration]);

  // Draw Waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = containerRef.current?.clientWidth || 0;
    const height = containerRef.current?.clientHeight || 300;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);
    
    // Rows Background
    const rowHeight = height / NUM_ROWS;
    
    for(let i=1; i<NUM_ROWS; i++) {
        const y = i * rowHeight;
        ctx.beginPath();
        ctx.strokeStyle = '#222';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    ctx.setLineDash([]); // Reset

    const middle = height / 2;
    const scaleY = height * 0.4; 

    // Visible Time Range
    const halfWindow = width / 2;
    const centerT = viewCenterTime;
    const startT = centerT - (halfWindow / zoom);
    const endT = centerT + (halfWindow / zoom);
    
    const samplesPerSecond = 200; 
    const startIdx = Math.floor(Math.max(0, startT) * samplesPerSecond);
    const endIdx = Math.ceil(Math.min(duration, endT) * samplesPerSecond);

    // Grid / Time Ruler
    let gridInterval = 1;
    if (zoom > 200) gridInterval = 0.5;
    if (zoom < 50) gridInterval = 5;
    if (zoom < 20) gridInterval = 10;

    const firstGrid = Math.floor(startT / gridInterval) * gridInterval;
    
    for (let t = firstGrid; t < endT; t += gridInterval) {
        if (t < 0) continue;
        const x = (t - startT) * zoom;
        
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x, 0, 1, height); // Vertical grid line
        
        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(formatTime(t), x + 4, height - 6);
    }
    
    // Waveform (Behind Cues)
    const gradient = ctx.createLinearGradient(0, middle - scaleY, 0, middle + scaleY);
    gradient.addColorStop(0, '#00d2ff');   
    gradient.addColorStop(0.5, '#3a7bd5'); 
    gradient.addColorStop(1, '#00d2ff');   

    ctx.beginPath();
    ctx.strokeStyle = gradient;
    ctx.globalAlpha = 0.4; // Fade waveform a bit to let rows be visible
    ctx.lineWidth = Math.max(2, zoom / 50); 
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = startIdx; i < endIdx; i++) {
        const t = i / samplesPerSecond;
        const x = (t - startT) * zoom;
        const y = waveformPeaks[i] * scaleY;
        
        ctx.moveTo(x, middle - y);
        ctx.lineTo(x, middle + y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

  }, [waveformPeaks, duration, zoom, viewCenterTime, audioBuffer]);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setDragStartX(e.clientX);
    setDragStartTime(viewCenterTime);
    setIsFollowing(false);
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (draggingCueId) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        // Time Calc
        const halfWindow = rect.width / 2;
        const mouseX = e.clientX - rect.left;
        const startT = viewCenterTime - (halfWindow / zoom);
        let newTime = (mouseX / zoom) + startT;
        newTime = Math.max(0, Math.min(duration, newTime));

        if (snapToGrid) {
            newTime = Math.round(newTime * 10) / 10;
        }

        // Row Calc
        const mouseY = e.clientY - rect.top;
        const rowHeight = rect.height / NUM_ROWS;
        let newRow = Math.floor(mouseY / rowHeight);
        newRow = Math.max(0, Math.min(NUM_ROWS - 1, newRow));
        
        onUpdateCue(draggingCueId, { time: newTime, row: newRow });
        return;
    }

    if (isPanning) {
        const deltaPixels = e.clientX - dragStartX;
        const deltaTime = deltaPixels / zoom;
        const newCenter = Math.max(0, Math.min(duration, dragStartTime - deltaTime));
        setViewCenterTime(newCenter);
    }
  }, [draggingCueId, isPanning, dragStartX, dragStartTime, zoom, viewCenterTime, duration, snapToGrid, onUpdateCue]);

  const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
    if (draggingCueId) {
        setDraggingCueId(null);
    }
    
    if (isPanning) {
        setIsPanning(false);
        if (Math.abs(e.clientX - dragStartX) < 5) {
             const rect = containerRef.current?.getBoundingClientRect();
             if (rect) {
                 const halfWindow = rect.width / 2;
                 const mouseX = e.clientX - rect.left;
                 const startT = viewCenterTime - (halfWindow / zoom);
                 const clickTime = (mouseX / zoom) + startT;
                 const clampedTime = Math.max(0, Math.min(duration, clickTime));
                 onSeek(clampedTime);
             }
        }
    }
  }, [draggingCueId, isPanning, dragStartX, zoom, viewCenterTime, duration, onSeek]);

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);

  const getCueScreenX = (time: number) => {
    if (!containerRef.current) return -1000;
    const width = containerRef.current.clientWidth;
    const halfWindow = width / 2;
    const startT = viewCenterTime - (halfWindow / zoom);
    return (time - startT) * zoom;
  };

  const getPlayheadX = () => {
    return getCueScreenX(currentTime);
  };

  if (!audioBuffer) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 border-b border-neutral-800 bg-neutral-900/50">
        <p>Upload an audio file to begin</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black select-none relative group">
      
      {/* Toolbar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-30">
         <div className="flex items-center gap-2 pointer-events-auto bg-black/80 backdrop-blur border border-neutral-800 rounded-lg p-1.5 shadow-xl">
            <button 
                onClick={() => setSnapToGrid(!snapToGrid)}
                className={`p-2 rounded hover:bg-neutral-800 transition-colors ${snapToGrid ? 'text-green-400' : 'text-neutral-500'}`}
                title="Toggle Snap"
            >
                <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                    <div className="bg-current rounded-[1px] opacity-50"></div>
                    <div className="bg-current rounded-[1px]"></div>
                    <div className="bg-current rounded-[1px]"></div>
                    <div className="bg-current rounded-[1px] opacity-50"></div>
                </div>
            </button>
            <div className="w-px h-6 bg-neutral-800 mx-1" />
            <button 
                onClick={() => onAddCue(currentTime)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-xs transition-colors shadow-lg shadow-blue-900/20"
            >
                <Plus size={14} />
                <span>CUE</span>
            </button>
         </div>

         <div className="flex items-center gap-3 pointer-events-auto bg-black/80 backdrop-blur border border-neutral-800 rounded-lg p-1.5 shadow-xl">
             <button
                onClick={() => setIsFollowing(!isFollowing)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${isFollowing ? 'bg-neutral-800 text-green-400' : 'hover:bg-neutral-800 text-neutral-400'}`}
             >
                <Crosshair size={14} className={isFollowing ? "animate-pulse" : ""} />
                {isFollowing ? 'LOCKED' : 'FREE'}
             </button>
             <div className="w-px h-6 bg-neutral-800 mx-1" />
             <ZoomOut size={14} className="text-neutral-500" />
             <input 
                type="range" 
                min={MIN_ZOOM} 
                max={MAX_ZOOM} 
                value={zoom} 
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-24 md:w-48 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
             />
             <ZoomIn size={14} className="text-neutral-500" />
         </div>
      </div>

      {/* Main Timeline Viewport */}
      <div 
        ref={containerRef}
        className={`flex-1 relative overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
      >
        <canvas ref={canvasRef} className="absolute top-0 left-0 pointer-events-none" />
        
        {/* Playhead */}
        <div 
            className="absolute top-0 bottom-0 w-[2px] bg-white z-20 pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.5)]"
            style={{ 
                left: getPlayheadX(),
                opacity: (getPlayheadX() >= 0 && getPlayheadX() <= (containerRef.current?.clientWidth || 0)) ? 1 : 0 
            }} 
        >
             <div className="absolute top-0 -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white" />
        </div>

        {/* Cues Layer */}
        {cues.map(cue => {
            const cueX = getCueScreenX(cue.time);
            if (cueX < -300 || cueX > (containerRef.current?.clientWidth || 2000) + 300) return null;
            
            // Calculate Y position based on row
            const height = containerRef.current?.clientHeight || 300;
            const rowHeight = height / NUM_ROWS;
            const cueY = cue.row * rowHeight;
            
            const timeToCue = cue.time - currentTime;
            const isUpcoming = timeToCue > 0 && timeToCue < 10; // 10s lookahead for special visual

            return (
                <div
                    key={cue.id}
                    className="absolute z-10"
                    style={{ 
                        left: cueX, 
                        top: cueY,
                        height: rowHeight,
                        transform: 'translateX(-50%)' 
                    }}
                    onMouseDown={(e) => { e.stopPropagation(); setDraggingCueId(cue.id); }}
                >
                    {/* Visual Marker */}
                    <div className="relative h-full flex flex-col items-center group">
                        {/* Vertical line through the row */}
                        <div className="absolute top-0 bottom-0 w-0.5" style={{ backgroundColor: cue.color }} />
                        
                        {/* Flag Header */}
                        <div 
                            className="w-4 h-4 rounded-sm mt-1 shadow-md transition-transform group-hover:scale-125 cursor-grab active:cursor-grabbing"
                            style={{ backgroundColor: cue.color }}
                        />

                        {/* Editor Popup (Shows on hover or drag) */}
                        <div className="absolute top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900 border border-neutral-700 rounded-md p-2 shadow-2xl z-50 min-w-[180px] pointer-events-none group-hover:pointer-events-auto">
                            {/* Time & Countdown */}
                            <div className="flex justify-between items-baseline mb-2 border-b border-neutral-800 pb-1">
                                <span className="text-[10px] text-neutral-400 font-mono">{formatTime(cue.time)}</span>
                                <span className={`text-[10px] font-mono font-bold ${timeToCue > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {timeToCue > 0 ? `-${formatTime(timeToCue)}` : `+${formatTime(Math.abs(timeToCue))}`}
                                </span>
                            </div>

                            {/* Label Input */}
                            <div className="flex items-center gap-2 mb-2">
                                <GripVertical size={12} className="text-neutral-500" />
                                <input 
                                   className="bg-neutral-800 rounded px-1 py-0.5 text-xs text-white focus:outline-none w-full border border-transparent focus:border-blue-500"
                                   value={cue.label}
                                   onChange={(e) => onUpdateCue(cue.id, { label: e.target.value })}
                                   onMouseDown={(e) => e.stopPropagation()} 
                                />
                            </div>

                            {/* Color Picker */}
                            <div className="flex gap-1 flex-wrap mb-2 justify-center">
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        className={`w-4 h-4 rounded-full border border-neutral-600 hover:scale-110 transition-transform ${cue.color === c ? 'ring-2 ring-white' : ''}`}
                                        style={{ backgroundColor: c }}
                                        onClick={(e) => { e.stopPropagation(); onUpdateCue(cue.id, { color: c }); }}
                                    />
                                ))}
                            </div>

                            {/* Delete */}
                            <button 
                                onMouseDown={(e) => { e.stopPropagation(); onDeleteCue(cue.id); }}
                                className="w-full flex items-center justify-center gap-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 py-1 rounded transition-colors"
                            >
                                <Trash2 size={12} />
                                <span>Delete Cue</span>
                            </button>
                        </div>
                    </div>
                </div>
            );
        })}

      </div>
      
      {/* Zoom indicator */}
      <div className="absolute bottom-2 right-4 text-[10px] font-mono text-neutral-600 pointer-events-none">
         ZOOM: {zoom}px/s | ROWS: {NUM_ROWS}
      </div>
    </div>
  );
};
