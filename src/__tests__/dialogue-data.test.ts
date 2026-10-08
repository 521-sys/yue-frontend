import { describe, expect, it } from "vitest";
import { dialoguePrompt, parseGeneratedDialogue } from "../lib/dialogue-data";

describe("AI 场景对话数据", () => {
  it("解析微信端兼容的 JSON 对话", () => {
    const d = parseGeneratedDialogue(JSON.stringify({ id: "cafe", title: "茶餐厅", place: "餐厅", roles: ["客人", "店员"], lines: [{ speaker: "A", yue: "唔该", man: "你好" }, { speaker: "B", yue: "欢迎光临", man: "欢迎" }] }));
    expect(d.lines).toHaveLength(2);
    expect(d.roles).toEqual(["客人", "店员"]);
  });
  it("提示模型输出固定的场景格式", () => {
    expect(dialoguePrompt("买奶茶")).toContain('"lines"');
    expect(dialoguePrompt("买奶茶")).toContain("8 到 12 句");
  });
});
