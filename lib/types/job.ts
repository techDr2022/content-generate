export type JobStatus = "pending" | "processing" | "done" | "failed" | "cancelled";

export interface GenerationJobDTO {
  id: string;
  clientId: string;
  userId: string;
  status: JobStatus;
  month: number;
  year: number;
  postCount: number;
  fileUrl: string | null;
  errorMsg: string | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string; doctorName: string };
}

export interface JobProgressEvent {
  jobId: string;
  status: JobStatus;
  fileUrl?: string;
  clientName: string;
  /** Rough completion 0–100 for this job. */
  progress: number;
  /** Human-readable step (e.g. Claude call, Excel build). */
  phase?: string;
  /** Milliseconds since this job started running in the worker (0 when only queued). */
  elapsedMs?: number;
  errorMsg?: string;
  month?: number;
  year?: number;
}

export interface GenerateJobPayload {
  jobId: string;
  clientId: string;
  month: number;
  year: number;
  userId: string;
  postCountOverride?: number;
  extraSpecialDays?: { label: string; date: string; type: string }[];
}
