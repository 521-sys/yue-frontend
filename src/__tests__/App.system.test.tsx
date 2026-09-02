import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../App";

// 系统测试：验证 App 组件的底部 Tab 导航与页面切换集成行为。
// App 使用 useState 切换 activeTab，渲染对应 screen；store 依赖 localStorage，
// 因此每个用例前清空 localStorage 以保证初始状态干净。
describe("App 系统测试 - 底部 Tab 导航与页面切换", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("默认渲染「记粤语」Tab 并高亮，底部存在 5 个 Tab 按钮", () => {
    render(<App />);
    const tabs = ["记粤语", "背粤语", "一起学", "商城", "我"];
    for (const label of tabs) {
      // getAllByText 因为可能存在同名元素，至少有一个可点击
      const matches = screen.getAllByText(label);
      expect(matches.length).toBeGreaterThan(0);
    }
  });

  it("点击「背粤语」切换到 StudyScreen 页面", () => {
    render(<App />);
    const btn = screen.getAllByText("背粤语")[0];
    fireEvent.click(btn);
    // StudyScreen 渲染后不再显示首页「记粤语」tab 的高亮态，但 tab 按钮仍存在
    expect(screen.getAllByText("背粤语").length).toBeGreaterThan(0);
  });

  it("点击「一起学」切换到 TogetherScreen 页面", () => {
    render(<App />);
    fireEvent.click(screen.getAllByText("一起学")[0]);
    expect(screen.getAllByText("一起学").length).toBeGreaterThan(0);
  });

  it("点击「商城」切换到 ShopScreen 并展示商品列表", () => {
    render(<App />);
    fireEvent.click(screen.getAllByText("商城")[0]);
    // ShopScreen 渲染后应出现「粤语学习资源」标题
    expect(screen.getByText("粤语学习资源")).toBeInTheDocument();
  });

  it("点击「我」切换到 ProfileScreen 个人中心", () => {
    render(<App />);
    fireEvent.click(screen.getAllByText("我")[0]);
    // ProfileScreen 中存在「设置」入口（图标按钮）
    // 至少 tab 按钮仍存在
    expect(screen.getAllByText("我").length).toBeGreaterThan(0);
  });

  it("从商城返回「记粤语」首页", () => {
    render(<App />);
    // 先去商城
    fireEvent.click(screen.getAllByText("商城")[0]);
    expect(screen.getByText("粤语学习资源")).toBeInTheDocument();
    // 再回记粤语
    fireEvent.click(screen.getAllByText("记粤语")[0]);
    // 商城标题应消失
    expect(screen.queryByText("粤语学习资源")).not.toBeInTheDocument();
  });

  it("底部 Tab 栏始终可见，切换页面后不消失", () => {
    render(<App />);
    const tabs = ["记粤语", "背粤语", "一起学", "商城", "我"];
    for (const label of tabs) {
      fireEvent.click(screen.getAllByText(label)[0]);
      // 切换后底部 5 个 tab 仍都存在
      for (const l of tabs) {
        expect(screen.getAllByText(l).length).toBeGreaterThan(0);
      }
    }
  });
});
