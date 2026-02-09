import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Cue } from './types';
import { Controls } from './components/Controls';
import { Timeline } from './components/Timeline';
import { CueList } from './components/CueList';

// Web Audio API context
const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
const audioCtx = new AudioContextClass();

export default function App() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cues, setCues] = useState<Cue[]>([]);
  const [waveformColor] = useState('#00d2ff'); 

  // Refs for audio playback logic
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Stop current playback
    handleStop();

    const arrayBuffer = await file.arrayBuffer();
    
    try {
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
      setDuration(decodedBuffer.duration);
      setFileName(file.name);
      setCues([]); // Reset cues for new file
    } catch (err) {
      console.error("Error decoding audio", err);
      alert("Failed to decode audio file.");
    }
  };

  // Cue JSON Import Handler
  const handleCueImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
        const data = JSON.parse(text);
        if (Array.isArray(data.cues)) {
            // Replace current cues with imported ones
            // Ensure they have all properties (migration safety)
            const importedCues = data.cues.map((c: any) => ({
                id: c.id || crypto.randomUUID(),
                time: Number(c.time) || 0,
                label: c.label || "Imported Cue",
                color: c.color || '#ef4444',
                row: typeof c.row === 'number' ? c.row : 0
            }));
            
            setCues(importedCues);
            
            // Allow importing even if names don't match, but maybe warn if duration is wildly different?
            // User knows best.
        } else {
            alert("Invalid JSON format: missing 'cues' array.");
        }
    } catch (err) {
        console.error("Error parsing JSON", err);
        alert("Failed to parse JSON file.");
    }
    // Reset input so same file can be selected again if needed
    e.target.value = '';
  };

  // Playback Loop
  const updateProgress = useCallback(() => {
    if (!isPlaying) return;
    
    const now = audioCtx.currentTime;
    const elapsed = now - startTimeRef.current;
    
    // Check if finished
    if (elapsed >= duration) {
        handleStop();
        return;
    }
    
    setCurrentTime(elapsed);
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  }, [isPlaying, duration]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, updateProgress]);


  const playAudio = (startOffset: number) => {
    if (!audioBuffer) return;
    
    // Disconnect old node if exists
    if (sourceNodeRef.current) {
        try { sourceNodeRef.current.disconnect(); } catch(e){}
    }

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    
    // Web Audio Logic:
    source.start(0, startOffset);
    
    sourceNodeRef.current = source;
    startTimeRef.current = audioCtx.currentTime - startOffset;
    
    setIsPlaying(true);
  };

  const pauseAudio = () => {
    if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e){}
        sourceNodeRef.current = null;
    }
    pauseTimeRef.current = currentTime;
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pauseAudio();
    } else {
      if (currentTime >= duration) {
        // Restart if at end
        setCurrentTime(0);
        playAudio(0);
      } else {
        playAudio(currentTime);
      }
    }
  };

  const handleStop = () => {
    pauseAudio();
    setCurrentTime(0);
    pauseTimeRef.current = 0;
  };

  const handleSeek = (time: number) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) pauseAudio();
    
    setCurrentTime(time);
    pauseTimeRef.current = time;
    
    if (wasPlaying) {
        playAudio(time);
    }
  };

  // Cue Management
  const handleAddCue = (time: number) => {
    const newCue: Cue = {
      id: crypto.randomUUID(),
      time,
      label: `Cue ${cues.length + 1}`,
      color: '#ef4444', // Default Red
      row: 0
    };
    setCues(prev => [...prev, newCue]);
  };

  const handleUpdateCue = (id: string, updates: Partial<Cue>) => {
    setCues(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleDeleteCue = (id: string) => {
    setCues(prev => prev.filter(c => c.id !== id));
  };

  // Export
  const handleExport = () => {
    const data = {
        projectName: fileName,
        duration,
        cues,
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName || 'project'}_cues.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-black text-neutral-200 overflow-hidden font-sans">
      
      {/* Top Controls */}
      <Controls 
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        fileName={fileName}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onFileUpload={handleFileUpload}
        onCueImport={handleCueImport}
        onExport={handleExport}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col relative min-h-0">
        
        {/* Upper Half: Timeline Visualizer */}
        <div className="flex-[2] border-b border-neutral-800 bg-black relative min-h-[300px]">
            <Timeline 
                audioBuffer={audioBuffer}
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
                cues={cues}
                waveformColor={waveformColor}
                onSeek={handleSeek}
                onAddCue={handleAddCue}
                onUpdateCue={handleUpdateCue}
                onDeleteCue={handleDeleteCue}
            />
            
            {/* Overlay Gradient for depth */}
            <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-20" />
            <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-20" />
        </div>

        {/* Lower Half: Cue List */}
        <div className="flex-1 min-h-[200px] bg-neutral-900 z-10">
            <CueList cues={cues} currentTime={currentTime} />
        </div>

      </div>
    </div>
  );
}