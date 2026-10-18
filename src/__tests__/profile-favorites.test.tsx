import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FavoritesView from "../components/profile/FavoritesView";
import { listFavoriteScenes, unfavoriteScene } from "../lib/scene-api";
import type { Dialogue } from "../data/dialogues";

vi.mock("../lib/scene-api", () => ({
  listFavoriteScenes: vi.fn(),
  unfavoriteScene: vi.fn(),
}));

const scenes: Dialogue[] = [
  { id: "official:7", emoji: "🍵", title: "茶餐厅", place: "香港", roles: ["店员", "客人"], lines: [] },
  { id: "official:8", emoji: "🚇", title: "地铁问路", place: "港铁", roles: ["游客", "路人"], lines: [] },
  { id: "official:9", emoji: "🛍️", title: "商场购物", place: "商场", roles: ["顾客", "店员"], lines: [] },
];

describe("我的收藏", () => {
  beforeEach(() => vi.clearAllMocks());

  it("先显示加载状态，再展示紧凑的场景列表", async () => {
    let resolve!: (items: Dialogue[]) => void;
    vi.mocked(listFavoriteScenes).mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<FavoritesView onBack={() => {}} onOpenScene={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("正在加载收藏");
    await act(async () => resolve(scenes));
    expect(await screen.findAllByRole("button", { name: /打开场景/ })).toHaveLength(3);
    expect(screen.getByText("茶餐厅")).toBeInTheDocument();
  });

  it("空列表提供收藏引导", async () => {
    vi.mocked(listFavoriteScenes).mockResolvedValue([]);
    render(<FavoritesView onBack={() => {}} onOpenScene={() => {}} />);
    expect(await screen.findByText("还没有收藏场景")).toBeInTheDocument();
    expect(screen.getByText("在场景对话中点亮爱心，之后会显示在这里")).toBeInTheDocument();
  });

  it("加载失败后可以重试", async () => {
    vi.mocked(listFavoriteScenes).mockRejectedValueOnce(new Error("网络开小差了")).mockResolvedValueOnce(scenes);
    render(<FavoritesView onBack={() => {}} onOpenScene={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("网络开小差了");
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByText("茶餐厅")).toBeInTheDocument();
    expect(listFavoriteScenes).toHaveBeenCalledTimes(2);
  });

  it("点击列表项打开场景，点爱心只取消收藏并移除该项", async () => {
    vi.mocked(listFavoriteScenes).mockResolvedValue(scenes);
    vi.mocked(unfavoriteScene).mockResolvedValue();
    const onOpenScene = vi.fn();
    render(<FavoritesView onBack={() => {}} onOpenScene={onOpenScene} />);
    fireEvent.click(await screen.findByRole("button", { name: "打开场景 茶餐厅" }));
    expect(onOpenScene).toHaveBeenCalledWith(7);
    fireEvent.click(screen.getByRole("button", { name: "取消收藏 茶餐厅" }));
    await waitFor(() => expect(screen.queryByText("茶餐厅")).not.toBeInTheDocument());
    expect(unfavoriteScene).toHaveBeenCalledWith(7);
    expect(onOpenScene).toHaveBeenCalledTimes(1);
  });

  it("取消收藏失败时保留条目并允许再次操作", async () => {
    vi.mocked(listFavoriteScenes).mockResolvedValue(scenes);
    vi.mocked(unfavoriteScene).mockRejectedValue(new Error("暂时无法取消收藏"));
    render(<FavoritesView onBack={() => {}} onOpenScene={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "取消收藏 茶餐厅" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("暂时无法取消收藏");
    expect(screen.getByText("茶餐厅")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消收藏 茶餐厅" })).toBeEnabled();
  });

  it("卸载后到达的加载结果不会更新状态", async () => {
    let resolve!: (items: Dialogue[]) => void;
    vi.mocked(listFavoriteScenes).mockReturnValue(new Promise((done) => { resolve = done; }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<FavoritesView onBack={() => {}} onOpenScene={() => {}} />);
    unmount();
    await act(async () => resolve(scenes));
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
