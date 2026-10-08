/** Convert mono microphone samples into signed little-endian PCM16 at 16kHz. */
export function encodePcm16(samples: Float32Array, rate: number): ArrayBuffer {
  const size = Math.floor(samples.length * 16000 / rate);
  const buffer = new ArrayBuffer(size * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < size; i++) {
    const start = Math.floor(i * rate / 16000);
    const end = Math.min(samples.length, Math.max(start + 1, Math.floor((i + 1) * rate / 16000)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    const sample = Math.max(-1, Math.min(1, sum / (end - start)));
    view.setInt16(i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}
