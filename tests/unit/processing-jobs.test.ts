import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createJobController, PROCESSING_JOB_ERROR } from "@/features/photo-intelligence/jobs/controller";
import { useProcessingJob } from "@/features/photo-intelligence/jobs/use-processing-job";

afterEach(cleanup);

function deferred<T>() {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value: T) {
      resolvePromise(value);
    },
  };
}

async function rejectionOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return null;
}

describe("processing jobs", () => {
  it("reports clamped progress while the photograph is processing", async () => {
    const controller = createJobController();
    const gate = deferred<string>();
    const seen: number[] = [];
    controller.subscribe((snapshot) => {
      if (snapshot.state === "running") {
        seen.push(snapshot.progress);
      }
    });

    expect(controller.state).toBe("idle");
    expect(controller.progress).toBe(0);
    expect(controller.error).toBeNull();

    const pending = controller.start(async (signal, report) => {
      expect(signal.aborted).toBe(false);
      report(-0.4);
      report(0.35);
      report(4);
      return gate.promise;
    });

    expect(controller.state).toBe("running");
    expect(controller.progress).toBe(1);
    expect(seen).toEqual([0, 0.35, 1]);

    gate.resolve("saved");
    await expect(pending).resolves.toBe("saved");
    expect(controller.state).toBe("done");
    expect(controller.error).toBeNull();
  });

  it("cancels a run before it finishes", async () => {
    const controller = createJobController();
    const gate = deferred<string>();
    const secret = "cancel-before-finish-secret";
    const pending = controller.start(async (signal) => {
      await gate.promise;
      if (signal.aborted) {
        throw new Error(secret);
      }
      return "finished";
    });

    expect(controller.state).toBe("running");
    controller.cancel();
    expect(controller.state).toBe("cancelled");
    expect(controller.error).toBeNull();

    gate.resolve("finished");
    await expect(pending).resolves.toEqual({ cancelled: true });
    expect(controller.state).toBe("cancelled");
    expect(JSON.stringify(controller.snapshot())).not.toContain(secret);
  });

  it("does not call the task when the signal is already aborted", async () => {
    const controller = createJobController();
    let calls = 0;
    controller.subscribe(() => {
      if (controller.state === "running") {
        controller.cancel();
      }
    });

    const result = await controller.start(async () => {
      calls += 1;
      return "processed";
    });

    expect(calls).toBe(0);
    expect(result).toEqual({ cancelled: true });
    expect(controller.state).toBe("cancelled");
  });

  it("keeps the failure message free of the thrown text", async () => {
    const controller = createJobController();
    const gate = deferred<string>();
    const secret = "patient-photo-private-raw-exception";
    const pending = controller.start(async () => {
      await gate.promise;
      throw new Error(secret);
    });

    gate.resolve("continue");
    const caught = await rejectionOf(pending);

    expect(caught).toBeInstanceOf(Error);
    expect(caught).toMatchObject({ message: PROCESSING_JOB_ERROR });
    expect(caught instanceof Error ? caught.cause : undefined).toBeUndefined();
    expect(caught instanceof Error ? caught.message : "").not.toContain(secret);
    expect(controller.state).toBe("failed");
    expect(controller.error).toBe("The photograph could not be processed.");
    expect(JSON.stringify(controller.snapshot())).not.toContain(secret);
  });

  it("retries the same task after failure and can succeed", async () => {
    const controller = createJobController();
    const secret = "lens-calibration-stack";
    let attempt = 0;
    const task = async (_signal: AbortSignal, report: (progress: number) => void) => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error(secret);
      }
      report(1);
      return { photoId: "photo-1" };
    };

    const caught = await rejectionOf(controller.start(task));
    expect(caught).toBeInstanceOf(Error);
    expect(caught instanceof Error ? caught.message : "").toBe(PROCESSING_JOB_ERROR);
    expect(controller.state).toBe("failed");
    expect(controller.error).not.toContain(secret);

    await expect(controller.retry()).resolves.toEqual({ photoId: "photo-1" });
    expect(attempt).toBe(2);
    expect(controller.state).toBe("done");
    expect(controller.progress).toBe(1);
    expect(controller.error).toBeNull();
  });

  it("cancels the previous run when start is called again", async () => {
    const controller = createJobController();
    const firstGate = deferred<string>();
    const secondGate = deferred<string>();
    const secret = "superseded-run-secret";
    const first = controller.start(async (signal) => {
      await firstGate.promise;
      if (signal.aborted) {
        throw new Error(secret);
      }
      return "first";
    });
    const second = controller.start(async () => {
      await secondGate.promise;
      return "second";
    });

    expect(controller.state).toBe("running");
    secondGate.resolve("go");
    await expect(second).resolves.toBe("second");
    expect(controller.state).toBe("done");

    firstGate.resolve("go");
    await expect(first).resolves.toEqual({ cancelled: true });
    expect(controller.state).toBe("done");
    expect(JSON.stringify(controller.snapshot())).not.toContain(secret);
  });

  it("mirrors progress, cancellation, and retry in react state", async () => {
    const { result, rerender } = renderHook(() => useProcessingJob());
    const gate = deferred<string>();
    let pending: Promise<unknown> = Promise.resolve();

    act(() => {
      pending = result.current.start(async (signal, report) => {
        expect(signal.aborted).toBe(false);
        report(0.25);
        report(8);
        return gate.promise;
      });
    });

    expect(result.current.state).toBe("running");
    expect(result.current.progress).toBe(1);
    expect(result.current.error).toBeNull();

    act(() => {
      result.current.cancel();
    });
    expect(result.current.state).toBe("cancelled");

    await act(async () => {
      gate.resolve("late");
      await pending;
    });
    expect(result.current.state).toBe("cancelled");

    const secret = "hook-raw-error";
    let attempt = 0;
    const task = async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error(secret);
      }
      return "ready";
    };

    await act(async () => {
      await rejectionOf(result.current.start(task));
    });
    expect(result.current.state).toBe("failed");
    expect(result.current.error).toBe("The photograph could not be processed.");
    expect(result.current.error).not.toContain(secret);

    rerender();
    await act(async () => {
      await result.current.retry();
    });
    expect(attempt).toBe(2);
    expect(result.current.state).toBe("done");
    expect(result.current.error).toBeNull();
  });
});
