export interface Cue {
  id: string;
  time: number;
  label: string;
  color: string;
  row: number; // 0-3 typically
}

export interface ProjectState {
  fileName: string | null;
  duration: number;
  cues: Cue[];
}

export interface AudioVisualData {
  peaks: number[]; // Normalized -1 to 1 or 0 to 1
  length: number;
}
