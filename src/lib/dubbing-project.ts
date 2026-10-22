import type { DubbingCue } from "./dubbing-timeline";

type DubbingProjectState = {
  storageRevision?: string;
  background: Blob | null;
  backgroundName: string;
  cues: DubbingCue[];
  takes: Record<string, { blob: Blob; startMs: number }>;
  selectedCueId: string;
  playVideoAudio: boolean;
  autoAdvance: boolean;
};

export type DubbingProject = DubbingProjectState & ({
  version: 1;
  video: Blob;
  videoName: string;
} | {
  version: 2;
  source: { kind: "built-in"; materialId: string; partId: string };
});

let writes: Promise<unknown> = Promise.resolve();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error("浏览器不支持本地作品保存")); return; }
    let blocked = false;
    const request = indexedDB.open("yue-dubbing-project", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("projects");
    request.onsuccess = () => { if (blocked) { request.result.close(); return; } request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error("请关闭其他配音页面后重试")); };
  });
}

export function saveDubbingProject(project: DubbingProject, revision: { current: string | undefined }): Promise<void> {
  const write = writes.catch(() => {}).then(async () => {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("projects", "readwrite");
        const nextRevision = crypto.randomUUID();
        let conflict: Error | undefined;
        tx.oncomplete = () => { revision.current = nextRevision; resolve(); };
        tx.onabort = () => reject(conflict ?? tx.error ?? new Error("作品保存中断"));
        tx.onerror = () => reject(tx.error);
        const store = tx.objectStore("projects");
        const previous = store.get("current");
        previous.onsuccess = () => {
          if (previous.result?.storageRevision !== revision.current) {
            conflict = new Error("作品已在另一页面更新。为避免覆盖，新更改尚未保存；请勿关闭当前页，请先确认另一页的作品。");
            tx.abort(); return;
          }
          store.put({ ...project, storageRevision: nextRevision }, "current");
        };
      });
    } finally { db.close(); }
  });
  writes = write;
  return write;
}

export async function loadDubbingProject(): Promise<DubbingProject | undefined> {
  await writes.catch(() => {});
  const db = await openDatabase();
  try {
    const project = await new Promise<DubbingProject | undefined>((resolve, reject) => {
      const tx = db.transaction("projects", "readonly");
      const request = tx.objectStore("projects").get("current");
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
    if (!project) return undefined;
    const validSource = (project.version === 1 && project.video instanceof Blob && typeof project.videoName === "string")
      || (project.version === 2 && project.source?.kind === "built-in" && typeof project.source.materialId === "string" && typeof project.source.partId === "string");
    if ((project.storageRevision !== undefined && typeof project.storageRevision !== "string") || !validSource
      || (project.background !== null && !(project.background instanceof Blob)) || typeof project.backgroundName !== "string"
      || !Array.isArray(project.cues) || !project.cues.every((cue) => cue && typeof cue.id === "string" && typeof cue.text === "string" && Number.isFinite(cue.startMs) && Number.isFinite(cue.endMs))
      || !project.takes || typeof project.takes !== "object"
      || !Object.values(project.takes).every((take) => take && take.blob instanceof Blob && Number.isFinite(take.startMs) && take.startMs >= 0)
      || typeof project.selectedCueId !== "string" || typeof project.playVideoAudio !== "boolean" || typeof project.autoAdvance !== "boolean") {
      throw new Error("已保存作品的格式不兼容，未覆盖原记录");
    }
    return project;
  } finally { db.close(); }
}
