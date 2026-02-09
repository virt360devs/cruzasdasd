import React, { useRef, useEffect } from 'react';
import { Cue } from '../types';
import { formatTime } from '../utils/audioUtils';
import { ArrowRight, Hash, Layers } from 'lucide-react';

interface CueListProps {
  cues: Cue[];
  currentTime: number;
}

export const CueList: React.FC<CueListProps> = ({ cues, currentTime }) => {
  const sortedCues = [...cues].sort((a, b) => a.time - b.time);
  
  // Find the first upcoming cue (or the one currently playing if we treat "now" as a small window)
  // Logic: "Next" is the first one where time > currentTime.
  const nextIndex = sortedCues.findIndex(c => c.time > currentTime);
  
  // If we are at the end, nextIndex is -1.
  const scrollIndex = nextIndex === -1 ? sortedCues.length - 1 : nextIndex;
  
  const nextCue = nextIndex !== -1 ? sortedCues[nextIndex] : null;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current && scrollIndex !== -1) {
      // Find the row. The structure is div > table > tbody > tr
      const rows = listRef.current.querySelectorAll('tbody tr');
      const activeRow = rows[scrollIndex];
      
      if (activeRow) {
        activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [scrollIndex]);

  return (
    <div className="h-full flex flex-col bg-neutral-900 border-t border-neutral-800">
      <div className="p-3 border-b border-neutral-800 flex items-center justify-between bg-black shrink-0 z-20">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Hash size={14} className="text-neutral-500"/> 
            Cue Sheet
        </h3>
        {nextCue && (
            <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-500">NEXT:</span>
                <span className="font-bold animate-pulse" style={{ color: nextCue.color }}>{nextCue.label}</span>
                <span className="font-mono text-neutral-400">in {formatTime(nextCue.time - currentTime)}</span>
            </div>
        )}
      </div>
      
      <div className="flex-1 overflow-auto p-0 scroll-smooth relative" ref={listRef}>
        <table className="w-full text-left border-collapse relative">
            <thead className="bg-neutral-900 sticky top-0 z-10 text-xs text-neutral-500 font-mono uppercase shadow-sm">
                <tr>
                    <th className="p-3 border-b border-neutral-800 w-12 text-center bg-neutral-900">Row</th>
                    <th className="p-3 border-b border-neutral-800 w-24 bg-neutral-900">Time</th>
                    <th className="p-3 border-b border-neutral-800 w-24 bg-neutral-900">Delta</th>
                    <th className="p-3 border-b border-neutral-800 bg-neutral-900">Label</th>
                    <th className="p-3 border-b border-neutral-800 w-24 text-right bg-neutral-900">Status</th>
                </tr>
            </thead>
            <tbody>
                {sortedCues.map((cue, idx) => {
                    const diff = cue.time - currentTime;
                    const isPast = diff < -0.5;
                    const isNow = !isPast && diff <= 0; // Within 0.5s of passing
                    
                    // Fader Logic: Sequential
                    // Starts after previous cue ends (or start of track for first cue)
                    const prevTime = idx === 0 ? 0 : sortedCues[idx - 1].time;
                    const windowDuration = cue.time - prevTime;
                    
                    let progressPercent = 0;
                    let isActiveSegment = false;

                    // Calculate progress only if we are in the window [prevTime, cue.time]
                    if (currentTime >= prevTime && currentTime <= cue.time) {
                        isActiveSegment = true;
                        if (windowDuration > 0) {
                            progressPercent = ((currentTime - prevTime) / windowDuration) * 100;
                        } else {
                            progressPercent = 100; // Immediate transition
                        }
                    } else if (currentTime > cue.time) {
                        progressPercent = 100;
                    }

                    return (
                        <tr 
                            key={cue.id} 
                            data-index={idx}
                            className={`
                                border-b border-neutral-800 transition-colors group relative
                                ${isNow ? 'bg-blue-900/20' : 'hover:bg-neutral-800'}
                                ${isPast ? 'opacity-40' : 'opacity-100'}
                            `}
                        >
                            <td className="p-3 border-r border-neutral-800 text-center relative z-10">
                                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: cue.color }} />
                                <span className="font-mono text-xs text-neutral-400 bg-neutral-800 rounded px-1.5 py-0.5">
                                    {cue.row + 1}
                                </span>
                            </td>
                            <td className="p-3 font-mono text-sm text-neutral-300 relative z-10">
                                {formatTime(cue.time)}
                            </td>
                            <td className="p-3 font-mono text-sm font-medium relative z-10">
                                <span className={diff > 0 ? 'text-green-500' : 'text-red-500'}>
                                    {diff > 0 ? '-' : '+'}{formatTime(Math.abs(diff))}
                                </span>
                            </td>
                            
                            {/* Label Column with Green Fader */}
                            <td className="p-3 text-sm font-medium text-white relative overflow-hidden">
                                {!isPast && (
                                    <div 
                                        className="absolute top-0 left-0 bottom-0 bg-green-500/20 pointer-events-none transition-all duration-75 ease-linear"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                )}
                                <div className="relative z-10 flex items-center gap-2">
                                    {isNow && <ArrowRight size={14} className="text-blue-500" />}
                                    {cue.label}
                                </div>
                            </td>

                            <td className="p-3 text-xs font-mono text-right relative z-10">
                                {isPast && <span className="text-neutral-500">PASSED</span>}
                                {isNow && <span className="text-blue-400 font-bold">GO</span>}
                                {!isPast && !isNow && (
                                    <span className={isActiveSegment ? "text-green-400 font-medium" : "text-neutral-500"}>
                                        {isActiveSegment ? "READY" : "WAIT"}
                                    </span>
                                )}
                            </td>
                        </tr>
                    );
                })}
                {cues.length === 0 && (
                    <tr>
                        <td colSpan={5} className="p-8 text-center text-neutral-600 text-sm">
                            No cues added yet.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};