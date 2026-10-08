import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Movie from "../screens/MovieImitationScreen";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("starts with local import and prevents recording without a video", () => {
  render(<Movie />);
  expect(screen.getByText("请先导入一个视频")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开始配音" })).toBeDisabled();
});
it("imports video, seeks, and releases its URL on exit", () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:movie");
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  const { container, unmount } = render(<Movie />);
  fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [new File(["video"], "clip.mp4", { type: "video/mp4" })] } });
  const video = container.querySelector("video")!;
  expect(video.getAttribute("src")).toBe("blob:movie");
  Object.defineProperty(video, "duration", { value: 30 });
  fireEvent.loadedMetadata(video);
  fireEvent.change(screen.getByRole("slider", { name: "视频进度" }), { target: { value: "12" } });
  expect(video.currentTime).toBe(12);
  unmount();
  expect(revoke).toHaveBeenCalledWith("blob:movie");
});
