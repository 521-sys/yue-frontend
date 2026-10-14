export interface DubbingCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

/** Share available gaps; preparation time must never consume neighbouring dialogue. */
export function recordingWindow(cue: DubbingCue, cues: DubbingCue[], durationMs: number) {
  let startMs = Math.max(0, cue.startMs - 1000);
  let endMs = Math.min(durationMs > 0 ? durationMs : cue.endMs + 1000, cue.endMs + 1000);
  for (const other of cues) {
    if (other.id === cue.id || !cueIsValid(other)) continue;
    if (other.endMs <= cue.startMs) startMs = Math.max(startMs, Math.floor((other.endMs + cue.startMs) / 2));
    else if (other.startMs >= cue.endMs) endMs = Math.min(endMs, Math.floor((cue.endMs + other.startMs) / 2));
    else {
      // Existing dialogue overlaps cannot be removed by trimming silence.
      startMs = cue.startMs;
      endMs = cue.endMs;
    }
  }
  return { startMs, endMs, preparationMs: cue.startMs - startMs < 1000 ? 1000 : 0 };
}

function parseTimestamp(value: string): number | null {
  const match = /^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})$/.exec(value.trim());
  if (!match) return null;
  return ((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000 + Number(match[4]);
}

function formatTimestamp(timeMs: number): string {
  const value = Math.max(0, Math.round(timeMs));
  const hours = Math.floor(value / 3_600_000);
  const minutes = Math.floor(value / 60_000) % 60;
  const seconds = Math.floor(value / 1000) % 60;
  const milliseconds = value % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

export function parseSrt(text: string): DubbingCue[] {
  const blocks = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/);
  const cues: DubbingCue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const [startRaw, endRaw] = lines[timingIndex].split(/\s*-->\s*/);
    const startMs = parseTimestamp(startRaw ?? "");
    const endMs = parseTimestamp(endRaw ?? "");
    const cueText = lines.slice(timingIndex + 1).join("\n").trim();
    if (startMs === null || endMs === null || endMs <= startMs || !cueText) continue;
    cues.push({ id: `cue-${cues.length + 1}`, startMs, endMs, text: cueText });
  }
  if (!cues.length) throw new Error("没有找到有效字幕，请选择 SRT 文件");
  return cues.sort((a, b) => a.startMs - b.startMs);
}

export function serializeSrt(cues: DubbingCue[]): string {
  return cues.map((cue, index) => `${index + 1}\n${formatTimestamp(cue.startMs)} --> ${formatTimestamp(cue.endMs)}\n${cue.text.trim()}\n`).join("\n");
}

export function activeCueAt(cues: DubbingCue[], timeMs: number): DubbingCue | null {
  return cues.find((cue) => timeMs >= cue.startMs && timeMs < cue.endMs) ?? null;
}

export function cueIsValid(cue: DubbingCue, durationMs = 0): boolean {
  return Number.isFinite(cue.startMs) && Number.isFinite(cue.endMs)
    && cue.startMs >= 0 && cue.endMs > cue.startMs
    && (durationMs <= 0 || cue.endMs <= durationMs)
    && Boolean(cue.text.trim());
}
