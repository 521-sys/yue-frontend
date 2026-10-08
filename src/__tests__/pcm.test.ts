import { describe, expect, it } from 'vitest';
import { encodePcm16 } from '../lib/pcm';
describe('microphone PCM', () => {
  it('resamples a 48kHz second to exactly 16kHz mono', () => {
    const output = encodePcm16(new Float32Array(48000).fill(0.5), 48000);
    expect(output.byteLength).toBe(32000);
    expect(new DataView(output).getInt16(0, true)).toBe(16384);
  });
  it('clips peaks and writes little endian signed samples', () => {
    const result = new DataView(encodePcm16(new Float32Array([-2, 0, 2]), 16000));
    expect([0, 2, 4].map(i => result.getInt16(i, true))).toEqual([-32768, 0, 32767]);
  });
});
