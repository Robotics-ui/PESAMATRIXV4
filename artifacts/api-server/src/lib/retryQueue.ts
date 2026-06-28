import { logger } from "./logger";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface QueueJob<T = unknown> {
  id: string;
  name: string;
  payload: T;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: string;
  lastAttemptAt?: string;
  completedAt?: string;
}

export interface RetryQueueStats {
  pending: number;
  running: number;
  completedInHistory: number;
  failedInHistory: number;
  totalProcessed: number;
}

export interface QueueSnapshot {
  name: string;
  stats: RetryQueueStats;
  pending: QueueJob[];
  recentHistory: QueueJob[];
}

type JobHandler<T> = (payload: T) => Promise<void>;

const MAX_HISTORY = 100;

// ── Global registry ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queueRegistry = new Map<string, RetryQueue<any>>();

export function getRegisteredQueues(): QueueSnapshot[] {
  return Array.from(queueRegistry.entries()).map(([name, q]) => ({
    name,
    stats: q.getStats(),
    pending: q.getQueue() as QueueJob[],
    recentHistory: (q.getHistory() as QueueJob[]).slice(0, 50),
  }));
}

export function clearQueueByName(name: string): boolean {
  const q = queueRegistry.get(name);
  if (!q) return false;
  q.clear();
  logger.info({ queue: name }, "RetryQueue cleared by admin");
  return true;
}

export function retryHistoryJob(name: string, jobId: string): boolean {
  const q = queueRegistry.get(name);
  if (!q) return false;
  const history = q.getHistory() as QueueJob[];
  const job = history.find((j) => j.id === jobId);
  if (!job) return false;
  // Re-enqueue with a fresh ID to bypass deduplication
  const newId = `${job.id}:retry:${Date.now()}`;
  q.enqueue(newId, `${job.name} (retry)`, job.payload, job.maxAttempts);
  logger.info({ queue: name, originalJobId: jobId, newJobId: newId }, "RetryQueue job manually re-triggered");
  return true;
}

export function retryAllFailed(name: string): number {
  const q = queueRegistry.get(name);
  if (!q) return 0;
  const history = q.getHistory() as QueueJob[];
  const failed = history.filter((j) => j.status === "failed");
  for (const job of failed) {
    const newId = `${job.id}:retry:${Date.now()}`;
    q.enqueue(newId, `${job.name} (retry)`, job.payload, job.maxAttempts);
  }
  logger.info({ queue: name, count: failed.length }, "RetryQueue: all failed jobs re-triggered by admin");
  return failed.length;
}

// ── RetryQueue class ──────────────────────────────────────────────────────────

export class RetryQueue<T = unknown> {
  private readonly queueName: string;
  private readonly handler: JobHandler<T>;
  private readonly baseDelayMs: number;
  private queue: QueueJob<T>[] = [];
  private history: QueueJob<T>[] = [];
  private processing = false;

  constructor(
    queueName: string,
    handler: JobHandler<T>,
    options?: { baseDelayMs?: number }
  ) {
    this.queueName = queueName;
    this.handler = handler;
    this.baseDelayMs = options?.baseDelayMs ?? 1000;
    // Auto-register in global registry
    queueRegistry.set(queueName, this);
  }

  enqueue(id: string, name: string, payload: T, maxAttempts = 3): void {
    const existing = this.queue.find((j) => j.id === id);
    if (existing) return;

    this.queue.push({
      id,
      name,
      payload,
      status: "pending",
      attempts: 0,
      maxAttempts,
      createdAt: new Date().toISOString(),
    });

    if (!this.processing) {
      void this.processNext();
    }
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;

    const job = this.queue.find((j) => j.status === "pending");
    if (!job) return;

    this.processing = true;
    job.status = "running";
    job.attempts++;
    job.lastAttemptAt = new Date().toISOString();

    try {
      await this.handler(job.payload);
      job.status = "completed";
      job.completedAt = new Date().toISOString();
      this.queue = this.queue.filter((j) => j.id !== job.id);
      this.history = [job, ...this.history].slice(0, MAX_HISTORY);
      logger.debug(
        { queue: this.queueName, jobId: job.id, name: job.name, attempts: job.attempts },
        "RetryQueue: job completed"
      );
    } catch (err) {
      job.lastError = err instanceof Error ? err.message : String(err);

      if (job.attempts >= job.maxAttempts) {
        job.status = "failed";
        this.queue = this.queue.filter((j) => j.id !== job.id);
        this.history = [job, ...this.history].slice(0, MAX_HISTORY);
        logger.error(
          { queue: this.queueName, jobId: job.id, name: job.name, attempts: job.attempts, error: job.lastError },
          "RetryQueue: job exhausted all retries"
        );
      } else {
        job.status = "pending";
        const delay = this.baseDelayMs * Math.pow(2, job.attempts - 1);
        logger.warn(
          { queue: this.queueName, jobId: job.id, attempt: job.attempts, nextDelayMs: delay, error: job.lastError },
          "RetryQueue: job failed, scheduling retry"
        );
        this.processing = false;
        setTimeout(() => { void this.processNext(); }, delay);
        return;
      }
    } finally {
      this.processing = false;
    }

    if (this.queue.some((j) => j.status === "pending")) {
      void this.processNext();
    }
  }

  getQueue(): QueueJob<T>[] { return [...this.queue]; }
  getHistory(): QueueJob<T>[] { return [...this.history]; }

  getStats(): RetryQueueStats {
    return {
      pending: this.queue.filter((j) => j.status === "pending").length,
      running: this.queue.filter((j) => j.status === "running").length,
      completedInHistory: this.history.filter((j) => j.status === "completed").length,
      failedInHistory: this.history.filter((j) => j.status === "failed").length,
      totalProcessed: this.history.length,
    };
  }

  clear(): void {
    this.queue = this.queue.filter((j) => j.status === "running");
  }
}
