import type { Dialogue, DialogueLine } from "../data/dialogues";

export function parseGeneratedDialogue(raw: string): Dialogue {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const root = JSON.parse(clean) as Record<string, unknown>;
  const data = (root.dialogue && typeof root.dialogue === "object" ? root.dialogue : root) as Record<string, unknown>;
  const roles = Array.isArray(data.roles) ? data.roles.filter((x): x is string => typeof x === "string") : [];
  const lines = Array.isArray(data.lines) ? data.lines.map((x, i) => {
    const v = x as Record<string, unknown>;
    const speaker = String(v.speaker ?? v.role ?? (i % 2 ? "B" : "A")).toUpperCase();
    const yue = String(v.yue ?? v.cantonese ?? v.cantoneseText ?? "").trim();
    const man = String(v.man ?? v.mandarin ?? v.translation ?? "").trim();
    if (!/[AB]/.test(speaker) || !yue || !man) throw new Error(`第 ${i + 1} 句格式不正确`);
    return { speaker: speaker as "A" | "B", yue, man } as DialogueLine;
  }) : [];
  if (typeof data.id !== "string" || typeof data.title !== "string" || typeof data.place !== "string" || roles.length !== 2 || lines.length < 2) throw new Error("场景数据格式不正确");
  return { id: data.id.trim(), title: data.title.trim(), place: data.place.trim(), emoji: typeof data.emoji === "string" ? data.emoji : "💬", roles: [roles[0], roles[1]] as [string, string], lines };
}

export function dialoguePrompt(topic: string): string {
  return `请生成一个适合粤语初学者的生活场景对话，只返回 JSON，不要 Markdown 代码围栏。格式：{"id":"英文短 id","emoji":"一个 emoji","title":"中文标题","place":"地点","roles":["角色A","角色B"],"lines":[{"speaker":"A","yue":"粤语","man":"普通话"}]}。对话需要 8 到 12 句，A/B 交替，每句有普通话翻译。场景主题：${topic.trim()}`;
}

export const CUSTOM_DIALOGUES_KEY = "yueCustomDialoguesV1";
export function readCustomDialogues(): Dialogue[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_DIALOGUES_KEY) || "[]").map((x: unknown) => parseGeneratedDialogue(JSON.stringify(x))); } catch { return []; }
}
export function saveCustomDialogue(d: Dialogue): void {
  const all = readCustomDialogues().filter((x) => x.id !== d.id);
  localStorage.setItem(CUSTOM_DIALOGUES_KEY, JSON.stringify([...all, d]));
}
