export const PROCESSING_JOB_ERROR = "The photograph could not be processed.";

export type JobState = "idle" | "running" | "done" | "failed" | "cancelled";

export type JobTask<Result> = (
  signal: AbortSignal,
  report: (progress: number) => void,
) => Promise<Result>;

export type JobCancellation = {
  cancelled: true;
};

export type JobSnapshot = {
  state: JobState;
  progress: number;
  error: string | null;
};

export type JobListener = (snapshot: JobSnapshot) => void;

export type JobController = {
  readonly state: JobState;
  readonly progress: number;
  readonly error: string | null;
  snapshot: () => JobSnapshot;
  subscribe: (listener: JobListener) => () => void;
  start: <Result>(task: JobTask<Result>) => Promise<Result | JobCancellation>;
  cancel: () => void;
  retry: () => Promise<unknown>;
};

function clampProgress(progress: number) {
  if (!Number.isFinite(progress)) {
    return 0;
  }
  if (progress < 0) {
    return 0;
  }
  if (progress > 1) {
    return 1;
  }
  return progress;
}

function isAbort(error: unknown, signal: AbortSignal) {
  if (signal.aborted) {
    return true;
  }
  return error instanceof Error && error.name === "AbortError";
}

export function createJobController(): JobController {
  let state: JobState = "idle";
  let progress = 0;
  let error: string | null = null;
  let generation = 0;
  let abortController: AbortController | null = null;
  let lastTask: JobTask<unknown> | null = null;
  const listeners = new Set<JobListener>();

  function snapshot(): JobSnapshot {
    return { state, progress, error };
  }

  function notify() {
    const current = snapshot();
    for (const listener of [...listeners]) {
      listener(current);
    }
  }

  function subscribe(listener: JobListener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function cancelledResult(run: number): JobCancellation {
    if (run === generation && state === "running") {
      state = "cancelled";
      notify();
    }
    return { cancelled: true };
  }

  function cancel() {
    if (state !== "running" || abortController === null) {
      return;
    }
    abortController.abort();
    generation += 1;
    state = "cancelled";
    notify();
  }

  async function start<Result>(task: JobTask<Result>): Promise<Result | JobCancellation> {
    if (state === "running") {
      cancel();
    }

    const run = ++generation;
    const controller = new AbortController();
    abortController = controller;
    lastTask = (signal, report) => task(signal, report);
    state = "running";
    progress = 0;
    error = null;
    notify();

    if (run !== generation || controller.signal.aborted) {
      return cancelledResult(run);
    }

    const report = (value: number) => {
      if (run !== generation || controller.signal.aborted || state !== "running") {
        return;
      }
      const next = clampProgress(value);
      if (next === progress) {
        return;
      }
      progress = next;
      notify();
    };

    try {
      const value = await task(controller.signal, report);
      if (run !== generation || controller.signal.aborted) {
        return cancelledResult(run);
      }
      state = "done";
      error = null;
      notify();
      return value;
    } catch (caught) {
      if (run !== generation || isAbort(caught, controller.signal)) {
        return cancelledResult(run);
      }
      state = "failed";
      error = PROCESSING_JOB_ERROR;
      notify();
      throw new Error(PROCESSING_JOB_ERROR);
    }
  }

  async function retry() {
    if (lastTask === null) {
      return { cancelled: true };
    }
    return start(lastTask);
  }

  return {
    get state() {
      return state;
    },
    get progress() {
      return progress;
    },
    get error() {
      return error;
    },
    snapshot,
    subscribe,
    start,
    cancel,
    retry,
  };
}
