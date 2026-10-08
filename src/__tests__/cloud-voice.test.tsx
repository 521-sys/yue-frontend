import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCloudVoice } from '../lib/useCloudVoice';
vi.mock('../lib/api', () => ({ transcribeAudio: vi.fn() }));
const close = vi.fn(async () => {});
class FakeContext {
  state = 'running'; sampleRate = 48000; destination = {};
  resume = vi.fn(async () => {}); close = close;
  createMediaStreamSource = () => ({connect:vi.fn(),disconnect:vi.fn()});
  createScriptProcessor = () => ({connect:vi.fn(),disconnect:vi.fn(),onaudioprocess:null});
  createGain = () => ({gain:{value:1},connect:vi.fn(),disconnect:vi.fn()});
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); close.mockClear(); });
describe('cloud microphone lifecycle', () => {
  it('releases a late permission grant after cancellation', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    let grant!: (stream: MediaStream) => void;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>(r => {grant = r;}));
    vi.stubGlobal('navigator', {mediaDevices:{getUserMedia}});
    const stop = vi.fn(); const onText = vi.fn();
    const {result} = renderHook(() => useCloudVoice(onText, vi.fn()));
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.toggle(); });
    act(() => result.current.cancel());
    await act(async () => { grant({getTracks:() => [{stop}]} as unknown as MediaStream); await pending; });
    expect(stop).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalled();
    expect(result.current.phase).toBe('idle'); expect(onText).not.toHaveBeenCalled();
  });
  it('shows permission denial and closes audio context', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('navigator', {mediaDevices:{getUserMedia:vi.fn().mockRejectedValue(new DOMException('Denied','NotAllowedError'))}});
    const {result} = renderHook(() => useCloudVoice(vi.fn(), vi.fn()));
    await act(async () => { await result.current.toggle(); });
    expect(result.current.error).toContain('允许麦克风'); expect(result.current.phase).toBe('idle'); expect(close).toHaveBeenCalled();
  });
  it('stops microphone tracks when the page unmounts', async () => {
    vi.stubGlobal('AudioContext', FakeContext); const stop = vi.fn();
    vi.stubGlobal('navigator', {mediaDevices:{getUserMedia:vi.fn().mockResolvedValue({getTracks:() => [{stop}]})}});
    const {result,unmount} = renderHook(() => useCloudVoice(vi.fn(), vi.fn()));
    await act(async () => { await result.current.toggle(); });
    expect(result.current.phase).toBe('recording'); unmount(); expect(stop).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalled();
  });
});
