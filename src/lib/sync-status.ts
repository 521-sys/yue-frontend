import { useSyncExternalStore } from "react";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

let status: SyncStatus = "idle";
const listeners = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSyncStatus(next: SyncStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener());
}

export function clearSyncStatus() {
  setSyncStatus("idle");
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}
