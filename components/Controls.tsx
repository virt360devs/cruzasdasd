import React from 'react';
import { Play, Pause, Square, Upload, Download, FileJson, Music } from 'lucide-react';
import { formatTime } from '../utils/audioUtils';

interface ControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  fileName: string | null;
  onPlayPause: () => void;
  onStop: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCueImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  fileName,
  onPlayPause,
  onStop,
  onFileUpload,
  onCueImport,
  onExport
}) => {
  return (
    <div className="h-20 bg-neutral-950 border-b border-neutral-800 flex items-center px-6 justify-between shrink-0">
      
      {/* Transport */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onPlayPause}
          disabled={!fileName}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center transition-all
            ${!fileName ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 
              isPlaying 
                ? 'bg-neutral-800 text-yellow-400 hover:bg-neutral-700 hover:shadow-lg hover:shadow-yellow-400/20' 
                : 'bg-white text-black hover:bg-neutral-200 hover:shadow-lg hover:shadow-white/20'
            }
          `}
        >
          {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1"/>}
        </button>
        
        <button 
          onClick={onStop}
          disabled={!fileName}
          className="w-10 h-10 rounded-full bg-neutral-900 text-neutral-400 hover:text-red-500 hover:bg-neutral-800 flex items-center justify-center transition-colors disabled:opacity-50"
        >
          <Square size={16} fill="currentColor" />
        </button>

        {/* Time Display */}
        <div className="ml-6 flex flex-col">
            <div className="text-3xl font-mono font-light tracking-tighter text-white tabular-nums leading-none">
                {formatTime(currentTime)}
            </div>
            <div className="text-xs font-mono text-neutral-600 tracking-wider">
                TOTAL {formatTime(duration)}
            </div>
        </div>
      </div>

      {/* File Info & Actions */}
      <div className="flex items-center gap-6">
        {fileName && (
            <div className="text-right hidden md:block">
                <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Current Project</div>
                <div className="text-sm font-medium text-neutral-300 max-w-[200px] truncate">{fileName}</div>
            </div>
        )}

        <div className="h-8 w-px bg-neutral-800 mx-2" />

        <div className="flex gap-2">
            <label className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 rounded border border-neutral-700 cursor-pointer transition-colors group">
                <Music size={16} className="text-neutral-400 group-hover:text-white" />
                <span className="text-sm font-medium text-neutral-400 group-hover:text-white">Audio</span>
                <input type="file" accept="audio/*" onChange={onFileUpload} className="hidden" />
            </label>

            <label className={`flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 rounded border border-neutral-700 cursor-pointer transition-colors group ${!fileName ? 'opacity-50 pointer-events-none' : ''}`}>
                <FileJson size={16} className="text-neutral-400 group-hover:text-white" />
                <span className="text-sm font-medium text-neutral-400 group-hover:text-white">JSON</span>
                <input type="file" accept=".json" onChange={onCueImport} className="hidden" disabled={!fileName} />
            </label>
            
            <button 
                onClick={onExport}
                disabled={!fileName}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 rounded border border-neutral-700 transition-colors group disabled:opacity-50"
            >
                <Download size={16} className="text-neutral-400 group-hover:text-blue-400" />
                <span className="text-sm font-medium text-neutral-400 group-hover:text-blue-400">Export</span>
            </button>
        </div>
      </div>
    </div>
  );
};
