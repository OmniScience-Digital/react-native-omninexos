// src/sync/backgroundRuntime.ts
// Makes JavaScript timers work while the OS runs our background task, and records what the network layer does.
//
// Why: on Android, JavaScript timers do not fire when the OS starts the app with no screen. Libraries wait with
// `setTimeout` in places we do not control; Amplify's HTTP client, for one, sleeps on a timer between retries. If
// the first request of a background wake fails (normal when the radio has only just woken), that retry timer never
// fires and the whole sync hangs forever. Inside the task we replace setTimeout with one that is driven by calls to
// native code, which do complete in a background wake.
//
// This is installed only for the duration of one background run and removed afterwards; the foreground is untouched.

type Timer = { due: number; fn: (...a: unknown[]) => void; args: unknown[] };

export interface BackgroundRuntimeOptions {
  /** Any cheap call that completes through native code (e.g. an AsyncStorage read). Drives the timers. */
  tick: () => Promise<unknown>;
  /** Told what the network layer and timers are doing, so a run that stops shows where. */
  note?: (step: string) => void;
}

const hostOf = (input: unknown): string => {
  const raw =
    typeof input === "string"
      ? input
      : ((input as { url?: string } | null)?.url ?? String(input));
  const m = /^[a-z]+:\/\/([^/?#:]+)/i.exec(raw);
  return m ? m[1] : "unknown-host";
};

const isNetworkUrl = (input: unknown): boolean => {
  const raw =
    typeof input === "string"
      ? input
      : ((input as { url?: string } | null)?.url ?? String(input));
  return /^https?:\/\//i.test(raw);
};

/** Installs the background timers and fetch tracing. Returns a function that puts everything back. */
export function enterBackgroundRuntime(
  opts: BackgroundRuntimeOptions,
): () => void {
  const g = globalThis as any;
  const origSet = g.setTimeout;
  const origClear = g.clearTimeout;
  const origFetch = g.fetch;
  const timers = new Map<number, Timer>();
  let nextId = 1_000_000_000;
  let pumping = false;
  let active = true;
  let lastNote = "";
  const note = (s: string) => {
    if (!opts.note || s === lastNote) return;
    lastNote = s;
    try {
      opts.note(s);
    } catch {
      /* tracing must never break the sync */
    }
  };

  // One shared loop runs every pending timer: each turn awaits one native call, then fires whatever is due.
  async function pump(): Promise<void> {
    if (pumping) return;
    pumping = true;
    try {
      while (active && timers.size) {
        const now = Date.now();
        for (const [id, t] of [...timers]) {
          if (t.due > now) continue;
          timers.delete(id);
          try {
            t.fn(...t.args);
          } catch (e) {
            console.warn("[background] timer callback threw:", e);
          }
        }
        if (!timers.size) break;
        try {
          await opts.tick();
        } catch {
          // The native call itself failed. Never spin on microtasks (that would starve everything else): hand
          // back to the real timer for a moment and try again.
          origSet(() => void pump(), 20);
          return;
        }
      }
    } finally {
      pumping = false;
    }
  }

  g.setTimeout = (
    fn: (...a: unknown[]) => void,
    ms?: number,
    ...args: unknown[]
  ) => {
    const wait = Math.max(0, Number(ms) || 0);
    const id = nextId++;
    timers.set(id, { due: Date.now() + wait, fn, args });
    if (wait >= 100) note(`waiting ${wait}ms on a timer`);
    void pump();
    return id;
  };
  g.clearTimeout = (id: unknown) => {
    if (typeof id === "number" && timers.delete(id)) return;
    origClear(id);
  };

  if (typeof origFetch === "function") {
    g.fetch = async (input: unknown, init?: unknown) => {
      // Reading a photo from the phone (file://) also goes through fetch. That is not a network call: pass it
      // straight through and do not log it as one.
      if (!isNetworkUrl(input)) return origFetch(input, init);
      const host = hostOf(input);
      note(`network request to ${host}`);
      try {
        const res = await origFetch(input, init);
        note(`network reply ${res?.status} from ${host}`);
        return res;
      } catch (e) {
        note(
          `network request to ${host} failed: ${e instanceof Error ? e.message : String(e)}`,
        );
        throw e;
      }
    };
  }

  return () => {
    active = false;
    timers.clear();
    g.setTimeout = origSet;
    g.clearTimeout = origClear;
    if (typeof origFetch === "function") g.fetch = origFetch;
  };
}
