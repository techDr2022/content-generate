import type { Response } from "express";
import type { JobProgressEvent } from "@hc/shared";

const connections = new Map<string, Set<Response>>();

export function addSseConnection(userId: string, res: Response): void {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(res);
}

export function removeSseConnection(userId: string, res: Response): void {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    connections.delete(userId);
  }
}

export function emitJobProgress(userId: string, payload: JobProgressEvent): void {
  const set = connections.get(userId);
  if (!set) return;
  const body = JSON.stringify({ success: true, data: payload });
  const message = `data: ${body}\n\n`;
  for (const res of [...set]) {
    try {
      res.write(message);
    } catch {
      set.delete(res);
    }
  }
}
