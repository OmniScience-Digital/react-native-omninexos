// src/jobcards/time.ts
// Time worked on a job card, counted from SESSIONS: the time a technician had the job card open in the app (or the web).
// The server's copy of every session and this phone's own sessions are combined (the phone's copy wins when they
// are the same session). One PERSON's overlapping sessions are counted once, and a person is recognised by email, so
// a manual login and a Google login are one person. Different people's time adds up.
//
// Two kinds of server row are NOT counted as time worked:
//  - rows started by ADDING work (startReason WORK_ITEM_ADDED): adding or assigning work never starts a timer;
//  - a row that is still open but has gone quiet (no heartbeat for STALE_MS) only counts up to its last sign of life,
//    so a phone that died or a closed tab cannot run for days.
import { personKey, type Me } from "./people";

export interface TimeRow {
  id: string;
  jobCardId: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  startedAt: string;
  endedAt: string | null;
  /** Last heartbeat. Absent on older rows. */
  lastActiveAt?: string | null;
  startReason?: string | null;
}

export interface JobCardTime {
  /** Everyone's time on the job card */
  totalMinutes: number;
  /** This technician's own time */
  myMinutes: number;
  /** One of this technician's sessions is running right now */
  running: boolean;
}

/** An open session with no heartbeat for this long is treated as ended at its last heartbeat. */
export const STALE_MS = 5 * 60_000;

export function computeTimes(
  serverRows: TimeRow[],
  phoneRows: TimeRow[],
  me: Me,
  nowMs: number,
): Map<string, JobCardTime> {
  const byId = new Map<string, { row: TimeRow; fromPhone: boolean }>();
  for (const r of serverRows) byId.set(r.id, { row: r, fromPhone: false });
  for (const r of phoneRows) byId.set(r.id, { row: r, fromPhone: true }); // the phone knows its own sessions best

  // id -> email, learned from any row that has both (older rows only have the id)
  const emailOfId = new Map<string, string>();
  for (const { row } of byId.values())
    if (row.userEmail) emailOfId.set(row.userId, row.userEmail);
  if (me.email) for (const id of me.ids) emailOfId.set(id, me.email);
  const keyOf = (r: TimeRow) =>
    personKey(r.userId, r.userEmail ?? emailOfId.get(r.userId));
  const myKey = personKey([...me.ids][0] ?? "", me.email);
  const isMine = (r: TimeRow) => keyOf(r) === myKey || me.ids.has(r.userId);

  const perCard = new Map<string, Map<string, [number, number][]>>();
  const running = new Set<string>();
  for (const { row: r, fromPhone } of byId.values()) {
    if (r.startReason === "WORK_ITEM_ADDED") continue; // adding work is not working
    const start = Date.parse(r.startedAt);
    let end: number;
    if (r.endedAt) end = Date.parse(r.endedAt);
    else if (fromPhone)
      end = nowMs; // this phone's own live session
    else {
      // somebody else's (or an earlier device's) open session: believe it only while it is still sending heartbeats
      const lastSeen = Date.parse(r.lastActiveAt ?? r.startedAt);
      end = Math.min(nowMs, lastSeen + STALE_MS);
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      continue;
    if (!r.endedAt && end === nowMs && isMine(r)) running.add(r.jobCardId);
    const people =
      perCard.get(r.jobCardId) ?? new Map<string, [number, number][]>();
    const spans = people.get(keyOf(r)) ?? [];
    spans.push([start, end]);
    people.set(keyOf(r), spans);
    perCard.set(r.jobCardId, people);
  }

  const out = new Map<string, JobCardTime>();
  for (const [jobCardId, people] of perCard) {
    let total = 0;
    let mine = 0;
    for (const [key, spans] of people) {
      spans.sort((a, b) => a[0] - b[0]);
      let ms = 0;
      let [s, e] = spans[0];
      for (const [s2, e2] of spans.slice(1)) {
        if (s2 <= e) e = Math.max(e, e2);
        else {
          ms += e - s;
          [s, e] = [s2, e2];
        }
      }
      ms += e - s;
      const minutes = Math.round(ms / 60_000);
      total += minutes;
      if (key === myKey) mine += minutes;
    }
    out.set(jobCardId, {
      totalMinutes: total,
      myMinutes: mine,
      running: running.has(jobCardId),
    });
  }
  return out;
}

/**
 * When the phone sends the end of a session, the server may already have closed that entry. Who is right?
 *  - Not closed yet, or closed because nothing was heard (IDLE_TIMEOUT: the phone was offline): the phone knows
 *    when the technician really left, so its end wins.
 *  - Closed because all the work was submitted (or the job card was closed): that is the real finish, so time after it
 *    is not counted. The EARLIER of the two ends is used.
 * Never before the start.
 */
export function resolveEnd(a: {
  startedAt: string;
  phoneEnd: string;
  serverEndedAt?: string | null;
  serverEndReason?: string | null;
}): string {
  const start = Date.parse(a.startedAt);
  const phone = Date.parse(a.phoneEnd);
  let end = phone;
  const server = a.serverEndedAt ? Date.parse(a.serverEndedAt) : NaN;
  const workFinished = [
    "ALL_SUBMITTED",
    "JOB_CLOSED",
    "NO_WORK_ITEMS",
  ].includes(a.serverEndReason ?? "");
  if (Number.isFinite(server) && workFinished) end = Math.min(phone, server);
  return new Date(Math.max(start, end)).toISOString();
}
