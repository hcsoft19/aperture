"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  createJobController,
  type JobController,
  type JobSnapshot,
  type JobState,
} from "@/features/photo-intelligence/jobs/controller";

export type ProcessingJob = {
  state: JobState;
  progress: number;
  error: string | null;
  start: JobController["start"];
  cancel: JobController["cancel"];
  retry: JobController["retry"];
};

export function useProcessingJob(): ProcessingJob {
  const controllerRef = useRef<JobController | null>(null);
  const [snapshot, setSnapshot] = useState<JobSnapshot>({
    state: "idle",
    progress: 0,
    error: null,
  });

  const getController = useCallback(() => {
    const existing = controllerRef.current;
    if (existing) {
      return existing;
    }
    const created = createJobController();
    controllerRef.current = created;
    return created;
  }, []);

  useEffect(() => getController().subscribe(setSnapshot), [getController]);

  const start = useCallback<JobController["start"]>(
    (task) => getController().start(task),
    [getController],
  );
  const cancel = useCallback(() => {
    getController().cancel();
  }, [getController]);
  const retry = useCallback(() => getController().retry(), [getController]);

  return {
    state: snapshot.state,
    progress: snapshot.progress,
    error: snapshot.error,
    start,
    cancel,
    retry,
  };
}
