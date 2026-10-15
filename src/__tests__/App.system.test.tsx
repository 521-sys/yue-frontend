import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../App";
vi.mock('../lib/scene-api',()=>({listPublishedScenes:async()=>[{id:'official:1',title:'茶餐厅点餐',place:'香港',roles:['店员','顾客'],lines:[]}],getPublishedScene:vi.fn()}));

describe("简化后的核心导航", () => {
  beforeEach(() => localStorage.clear());

  it("首页突出 AI 语音入口并保留三个核心功能", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "开始 AI 语音对话" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "AI语音" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "场景对话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "电影模仿" })).toBeInTheDocument();
  });

  it("点击主麦克风打开现有 AI 对话", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "开始 AI 语音对话" }));
    expect(screen.getByText("AI语音助手")).toBeInTheDocument();
  });

  it("场景和电影模仿均能到达", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "场景对话" }));
    expect(await screen.findByText("茶餐厅点餐")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "电影模仿" }));
    expect(screen.getByRole("heading", { name: "电影模仿" })).toBeInTheDocument();
  });
});
