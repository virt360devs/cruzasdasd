export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export const generateRandomBrightColor = (): string => {
  const hue = Math.floor(Math.random() * 360);
  // High saturation and lightness to ensure visibility against black
  return `hsl(${hue}, 100%, 60%)`;
};

export const analyzeAudioBuffer = (buffer: AudioBuffer, samples: number): number[] => {
  const channelData = buffer.getChannelData(0); // Use first channel
  const blockSize = Math.floor(channelData.length / samples);
  const filteredData = [];
  
  for (let i = 0; i < samples; i++) {
    const start = i * blockSize;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[start + j]);
    }
    filteredData.push(sum / blockSize);
  }
  
  // Normalize
  const multiplier = Math.pow(Math.max(...filteredData), -1);
  return filteredData.map(n => n * multiplier);
};
