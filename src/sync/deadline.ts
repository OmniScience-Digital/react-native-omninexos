// src/sync/deadline.ts
// "Give up waiting after N ms". A background run must never wait forever: the OS then thinks the task is still
// working, and we learn nothing about why. Uses the global setTimeout at call time, so inside a background run it is
// the working replacement from backgroundRuntime.ts.

export class DeadlineError extends Error {
  constructor(
    public readonly label: string,
    ms: number,
  ) {
    super(`${label} did not finish within ${Math.round(ms / 1000)}s`);
    this.name = "DeadlineError";
  }
}

export function withDeadline<T>(
  work: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DeadlineError(label, ms)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
