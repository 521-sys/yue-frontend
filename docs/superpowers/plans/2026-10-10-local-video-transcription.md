# 本地视频自动生成台词 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有“电影模仿”网页中点击按钮，将本地视频交给本机离线识别服务，并把带时间的台词填入现有时间轴。

**Architecture:** 在 `yue-backend/media-worker/asr_service` 新建仅监听 loopback 的 FastAPI 服务，用已下载的 `faster-whisper` small 模型处理临时视频文件。前端直接请求 `http://127.0.0.1:8765`，成功后才替换当前字幕；失败、零句或旧请求返回时保留当前工程状态。

**Tech Stack:** Python 3.12、FastAPI/Uvicorn、faster-whisper 1.2.1、PyAV 18.x、FFprobe；React 19、TypeScript、Vitest。

**Spec:** `docs/superpowers/specs/2026-10-10-local-video-transcription-design.md`

## Global Constraints

- 仅个人本机测试：服务绑定 `127.0.0.1`，默认端口 `8765`；只允许 `http://localhost:8443` 和 `http://127.0.0.1:8443` Origin，不能公开部署。
- 模型目录由 `ASR_MODEL_DIR` 指定；启动/请求时绝不自动联网下载模型。默认 CPU，无需 CUDA。
- 单视频上限 5 分钟和 200 MB；超限直接提示截短。一次只运行一个转写；上传采用有大小上限的流式写入，处理结束删除临时文件。
- 请求只能由用户点击触发。识别失败或零句不覆盖当前台词与录音；有内容时替换前确认。保留 SRT 导入/导出和手动新增。
- `av<19`；不修改现有 Java 服务、FFmpeg 渲染逻辑或与本功能无关的脏工作区文件。
- 前端当前有未提交修改；提交时只暂存本轮新增的文件/代码块，不把既有用户改动混入提交。无法安全拆分时保留未提交并报告。

## Review Focus

- 视频没有音轨：后端返回可读的 422，前端保留旧台词；Task 2 的无音轨测试和 Task 4 的失败保留测试覆盖。
- 视频有音轨但没有人声：返回 `cues: []`，前端提示零句且不清空旧台词；Task 1 与 Task 4 覆盖。
- 超过 200 MB 或 300 秒：在模型运行前拒绝；Task 2 用可注入的小体积上限与手写 301 秒探测结果做边界测试。
- 非本机网页 Origin：预检或 POST 拒绝；Task 2 的 Origin 测试覆盖。
- 识别中换了视频或离开页面：迟到响应不可覆盖新视频；Task 4 的竞态测试覆盖。

---

### Task 1: 离线识别适配器

**Files:**
- Create: `../yue-backend/media-worker/asr_service/__init__.py`
- Create: `../yue-backend/media-worker/asr_service/transcriber.py`
- Create: `../yue-backend/media-worker/tests/test_transcriber.py`
- Create: `../yue-backend/media-worker/requirements-asr.txt`

**Interfaces:**
- Produces: `Cue` TypedDict (`startMs: int`, `endMs: int`, `text: str`)；`class LocalTranscriber(model_dir: Path)`；`transcribe(path: Path) -> list[Cue]`。
- `LocalTranscriber` 在首次调用时加载 `WhisperModel(model_dir, device="cpu", compute_type="int8")` 并复用；调用 `transcribe(path, language="zh", beam_size=3, vad_filter=True)`。

- [ ] **Step 1: 写失败测试。** 在 `test_transcriber.py` 用假的 `WhisperModel` 返回手写分段：`(1.25, 2.5, " 你好 ")` 必须得到 `{"startMs":1250,"endMs":2500,"text":"你好"}`；空分段得到 `[]`；空文本/逆序时间被过滤；缺少 `model.bin` 明确报模型不可用。
- [ ] **Step 2: 运行 RED。** 从 `yue-backend/media-worker` 运行 `python -m unittest tests.test_transcriber -v`，预期因适配器不存在而失败。
- [ ] **Step 3: 实现最小适配器和依赖。** 固定 `faster-whisper==1.2.1`、`av>=18,<19`，模型目录只读；延迟加载且不触网。时间四舍五入到整数毫秒，按开始时间排序。
- [ ] **Step 4: 运行 GREEN。** 同一测试命令，预期全部通过；普通测试不使用真实模型或下载。
- [ ] **Step 5: 只暂存本任务文件并提交。** `git -C ../yue-backend add -- media-worker/asr_service/__init__.py media-worker/asr_service/transcriber.py media-worker/tests/test_transcriber.py media-worker/requirements-asr.txt`，检查暂存清单后提交。

### Task 2: 本机 HTTP 接口与清理

**Files:**
- Create: `../yue-backend/media-worker/asr_service/api.py`
- Create: `../yue-backend/media-worker/asr_service/__main__.py`
- Create: `../yue-backend/media-worker/tests/test_asr_api.py`
- Modify: `../yue-backend/media-worker/requirements-asr.txt`
- Modify: `../yue-backend/media-worker/README.md`（只追加本机 ASR 小节）

**Interfaces:**
- Consumes: `LocalTranscriber.transcribe(path: Path) -> list[Cue]`。
- Produces: `MediaInfo` TypedDict（`duration_s: float`, `has_audio: bool`）；`probe_media(path: Path) -> MediaInfo`；`create_app(transcribe_fn: Callable[[Path], list[Cue]] | None = None, probe_fn: Callable[[Path], MediaInfo] = probe_media, max_upload_bytes: int = 200 * 1024 * 1024) -> FastAPI`；`GET /health`；`POST /transcribe` multipart 字段 `file`，成功 JSON `{"cues":[...]}`，错误 JSON `{"error":"..."}`。注入 `transcribe_fn` 时不要求真实模型目录，便于接口测试。

- [ ] **Step 1: 写失败接口测试。** `TestClient(create_app(fake, fake_probe, max_upload_bytes=8))` 断言有效视频返回三字段字幕；无音轨 422、坏格式 422、9 字节文件为 413、时长 301 秒为 413、未知 Origin 为 403、允许 Origin 的 OPTIONS 预检成功、缺模型 503、处理异常 500；断言失败/成功后临时文件已移除，并断言默认上限为 `200 * 1024 * 1024`。
- [ ] **Step 2: 运行 RED。** 从 `yue-backend/media-worker` 运行 `python -m unittest tests.test_asr_api -v`，预期因 API 不存在而失败。
- [ ] **Step 3: 实现接口。** 在依赖文件加入 FastAPI、`python-multipart`、Uvicorn 和接口测试所需的 `httpx`；`ASR_MODEL_DIR` 缺失时 health 报不可用、POST 返回 503；POST 先查 Origin 与文件类型，再按 `max_upload_bytes` 分块复制并拒绝超限（`Content-Length` 只能作粗略提前拒绝，不能把 multipart 头字节算入文件大小）；FFprobe 校验音轨及 `duration <= 300` 秒；`TemporaryDirectory` 管理文件；`threading.Lock` 限单任务；`__main__` 绑定 `127.0.0.1`。统一异常转成约定状态码和中文提示。
- [ ] **Step 4: 运行 GREEN 与现有媒体测试。** `python -m unittest discover -s tests -v` 全绿；确认 HTTP 响应和临时文件清理。
- [ ] **Step 5: 更新 README 并只提交本任务文件。** 给出 `ASR_MODEL_DIR`、安装依赖、`python -m asr_service`、`GET /health` 的 Windows PowerShell 示例；明确不得公网部署。检查暂存清单后提交。

### Task 3: 网页本地识别客户端

**Files:**
- Create: `src/lib/local-transcription.ts`
- Create: `src/__tests__/local-transcription.test.ts`

**Interfaces:**
- Produces: `type TranscriptionCue = { startMs: number; endMs: number; text: string }`；`transcribeLocalVideo(file: File, signal?: AbortSignal): Promise<TranscriptionCue[]>`。
- 默认地址 `http://127.0.0.1:8765`，可用 `VITE_LOCAL_ASR_URL` 改写；只调用 `POST /transcribe`。返回值按接口约定检查时间为有限整数、非空文本，错误抛出适合页面显示的消息。

- [ ] **Step 1: 写失败客户端测试。** mock `fetch`：检查 `FormData` 的 `file` 与当前文件相同；200 成功返回手写 cue；`cues: []` 返回空数组；503/422 解析 `error`；网络失败提示“本地识别服务未启动”；格式错误拒绝。
- [ ] **Step 2: 运行 RED。** 在 `yue-frontend` 运行 `npm test -- --run src/__tests__/local-transcription.test.ts`，预期因模块不存在而失败。
- [ ] **Step 3: 实现客户端。** 不自动上传、不缓存文件、不自动下载模型；将 AbortSignal 传给 `fetch`。
- [ ] **Step 4: 运行 GREEN。** 同一命令全绿。
- [ ] **Step 5: 只提交两个新文件。** 检查暂存内容与工作区原有修改隔离。

### Task 4: 页面按钮与时间轴接入

**Files:**
- Modify: `src/screens/MovieImitationScreen.tsx`
- Modify: `src/__tests__/movie.test.tsx`

**Interfaces:**
- Consumes: `transcribeLocalVideo(file, signal)`；映射到现有 `DubbingCue`（ID 形如 `cue-1`，毫秒时间不改变）。
- 用户动作：`handleAutoTranscribe()`；仅在点击按钮后上传，并在成功且非零句时替换当前 `cues`。

- [ ] **Step 1: 写失败页面测试。** 按钮在无视频/录音中不可点；导入视频不触发请求；点击才上传；已有字幕/录音取消确认则不上传；成功生成两句并可点击定位；零句、422、网络失败都保留原有字幕/录音；导入另一视频后旧响应不得覆盖；卸载后不更新状态。
- [ ] **Step 2: 运行 RED。** `npm test -- --run src/__tests__/movie.test.tsx`，预期缺按钮/行为导致失败。
- [ ] **Step 3: 实现页面状态与交互。** 保存当前 `File` 引用；显示“自动生成台词”和“仅点击后发送至本机识别服务”；处理中禁用重复提交，显示“正在识别”；确认替换后才发请求；非空成功后清理旧录音 URL 并选中第一句；错误或零句保留当前内容；视频切换/卸载时 AbortController 中止请求并用请求序号忽略迟到结果。保留现有 SRT/手动路径。
- [ ] **Step 4: 运行 GREEN 与完整前端验证。** `npm test`、`npm run build` 均退出 0；若 `npx tsc --noEmit` 仍报既有 `LearningState.seen` / `@ts-expect-error` 错误，记录而不顺手改无关代码。
- [ ] **Step 5: 隔离暂存本轮改动。** `MovieImitationScreen.tsx` 和其测试目前已有未提交改动；只提交可独立暂存的本轮 patch，若不能安全隔离则不提交这两个文件并在交付说明中注明。

### Task 5: 本机端到端验收

**Files:**
- Modify: `../yue-backend/media-worker/README.md`（补实际验收命令或排错）
- Modify: `docs/dubbing-web-roadmap.md`（只在确认端到端可用后更新状态）

**Interfaces:** 复用 Tasks 1–4 的接口，无新 API。

- [ ] **Step 1: 启动本机服务。** 指向现有已下载模型，验证 `GET /health` 就绪；确认仅监听 `127.0.0.1:8765`。
- [ ] **Step 2: 真实样本验证。** 使用项目中的有声视频走 `POST /transcribe`，确认返回非空、非负且在视频时长内的字幕；用无语音片段验证零句提示（若该片段实际有人声，改用可控静音样本）。
- [ ] **Step 3: 浏览器验收。** 在 `http://localhost:8443/` 导入同一视频，点击“自动生成台词”，检查台词出现、点击定位、改字、录音与导出 SRT；断开本机服务后再次点击，检查错误提示及原字幕保留。
- [ ] **Step 4: 完整复验与记录。** 重跑前后端测试、前端构建和 `git diff --check`；记录速度、字幕误差、剩余限制；更新 README/路线图状态，不宣称已有分离或成片导出。
