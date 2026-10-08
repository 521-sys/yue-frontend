import { useEffect, useRef, useState } from 'react';
import { encodePcm16 } from './pcm';
import { transcribeAudio } from './api';

type Session = { stream: MediaStream; ctx: AudioContext; source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode; gain: GainNode; parts: Float32Array[]; count: number; timer?: ReturnType<typeof setTimeout> };

export function useCloudVoice(onText: (text: string) => void, onStart: () => void) {
  const [phase, setPhase] = useState<'idle' | 'starting' | 'recording' | 'recognizing'>('idle');
  const [error, setError] = useState('');
  const active = useRef<Session | null>(null);
  const generation = useRef(0);
  const state = useRef(phase);
  const abort = useRef<AbortController | null>(null);
  const callback = useRef(onText); callback.current = onText;
  function update(next: typeof phase) { state.current = next; setPhase(next); }
  function release() {
    const s = active.current; active.current = null;
    if (!s) return;
    clearTimeout(s.timer);
    s.processor.onaudioprocess = null;
    s.source.disconnect(); s.processor.disconnect(); s.gain.disconnect();
    s.stream.getTracks().forEach(t => t.stop());
    void s.ctx.close().catch(() => {});
  }
  function cancel() {
    generation.current++; abort.current?.abort(); abort.current = null;
    release(); update('idle');
  }
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); generation.current++; abort.current?.abort(); release(); };
  }, []);

  async function finish() {
    const s = active.current;
    if (!s || state.current !== 'recording') return;
    const id = generation.current;
    release(); update('recognizing');
    const ctrl = new AbortController(); abort.current = ctrl;
    try {
      if (s.count < s.ctx.sampleRate * 0.1) throw new Error('录音太短，请重新说一次');
      const samples = new Float32Array(s.count);
      let offset = 0;
      s.parts.forEach(part => { samples.set(part, offset); offset += part.length; });
      let peak = 0;
      for (const value of samples) peak = Math.max(peak, Math.abs(value));
      if (peak < 0.001) throw new Error('没有录到声音，请检查麦克风权限并靠近手机说话');
      const pcm = encodePcm16(samples, s.ctx.sampleRate);
      const text = await transcribeAudio(new Blob([pcm], {type:'application/octet-stream'}), ctrl.signal);
      if (id === generation.current) callback.current(text);
    } catch (e) {
      if (id === generation.current) setError(e instanceof Error ? e.message : '语音识别失败，请重试');
    } finally {
      if (id === generation.current) { abort.current = null; update('idle'); }
    }
  }
  async function toggle() {
    if (state.current === 'recording') { await finish(); return; }
    if (state.current !== 'idle') { cancel(); return; }
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) { setError('当前浏览器不能录音，请使用 HTTPS 并允许麦克风权限'); return; }
    const id = ++generation.current; update('starting'); onStart();
    let pending: MediaStream | undefined;
    let ctx: AudioContext | undefined;
    try {
      ctx = new AudioContext();
      await ctx.resume();
      pending = await navigator.mediaDevices.getUserMedia({audio:{channelCount:1, echoCancellation:true, noiseSuppression:true},video:false});
      if (id !== generation.current) { pending.getTracks().forEach(t => t.stop()); await ctx.close(); return; }
      const source = ctx.createMediaStreamSource(pending);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const gain = ctx.createGain(); gain.gain.value = 0;
      const s: Session = {stream:pending, ctx, source, processor, gain, parts:[], count:0};
      active.current = s;
      processor.onaudioprocess = e => {
        if (active.current !== s) return;
        const remaining = Math.floor(ctx!.sampleRate * 30) - s.count;
        if (remaining <= 0) { void finish(); return; }
        const part = e.inputBuffer.getChannelData(0).slice(0, remaining);
        s.parts.push(part); s.count += part.length;
      };
      source.connect(processor); processor.connect(gain); gain.connect(ctx.destination);
      pending.getTracks().forEach(track => { track.onended = () => {
        if (active.current === s) { cancel(); setError('麦克风已断开，请重新录音'); }
      }; });
      update('recording'); s.timer = setTimeout(() => void finish(), 30000);
    } catch (e) {
      pending?.getTracks().forEach(t => t.stop());
      if (id === generation.current && active.current) release(); else if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
      if (id === generation.current) {
        update('idle');
        setError(e instanceof DOMException && e.name === 'NotAllowedError' ? '请在浏览器中允许麦克风权限后重试' : '麦克风启动失败，请关闭其他录音应用后重试');
      }
    }
  }
  return { phase, error, toggle, cancel };
}
