import type { JobProgressEvent } from "@/lib/types";

const encoder = new TextEncoder();

export type SseController = ReadableStreamDefaultController<Uint8Array>;

const connections = new Map<string, Set<SseController>>();

export function addSseConnection(userId: string, controller: SseController): void {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(controller);
}

export function removeSseConnection(userId: string, controller: SseController): void {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) {
    connections.delete(userId);
  }
}

export function emitJobProgress(userId: string, payload: JobProgressEvent): void {
  const set = connections.get(userId);
  if (!set) return;
  const chunk = encoder.encode(`data: ${JSON.stringify({ success: true, data: payload })}\n\n`);
  for (const controller of [...set]) {
    try {
      controller.enqueue(chunk);
    } catch {
      set.delete(controller);
    }
  }
}
