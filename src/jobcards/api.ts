// src/jobcards/api.ts
import { client } from "@/src/amplify";
import { fetchUserAttributes } from "aws-amplify/auth";
import { uploadData } from "aws-amplify/storage";
import { normEmail } from "./people";
import { isAlreadyExistsText } from "./serverErrors";
import type {
  JobCardApi,
  OpenWork,
  ServerDoneItem,
  ServerSubmission,
  ServerWorkItem,
} from "./sync";
import { resolveEnd } from "./time";
import type { WorkItemType } from "./types";

const AUTH = { authMode: "userPool" } as const;

type GqlResult<T> = {
  data?: T;
  errors?: { message?: string; errorType?: string }[];
};

async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  try {
    const res = (await client.graphql({
      query,
      variables,
      ...AUTH,
    })) as GqlResult<T>;
    if (res.errors?.length)
      throw new Error(res.errors.map((e) => e.message).join("; "));
    return res.data as T;
  } catch (e) {
    const errs = (e as { errors?: { message?: string }[] })?.errors;
    if (errs?.length) throw new Error(errs.map((x) => x.message).join("; "));
    throw e;
  }
}

// A page from an Amplify index query. `items` may contain nulls (Amplify
// returns them for rows the index still points at after a delete).
interface Page<T> {
  items: (T | null)[];
  nextToken: string | null;
}

/**
 * Follow nextToken to the end, skipping null slots.
 *
 * The reason this exists: a `do { const d = await gql<T>(..., { nextToken }) }
 * while (nextToken = d.nextToken)` loop creates a circular type dependency
 * between `d` and `nextToken`, which TypeScript rejects (TS7022 "implicitly
 * has type any because it references itself in its own initializer"). Putting
 * the loop in a helper, where `token` is a function parameter, breaks the
 * cycle cleanly.
 */
async function fetchAllPages<T>(
  fetchPage: (token: string | null) => Promise<Page<T>>,
): Promise<T[]> {
  const out: T[] = [];
  let token: string | null = null;
  do {
    const page = await fetchPage(token);
    for (const item of page.items) if (item) out.push(item);
    token = page.nextToken;
  } while (token);
  return out;
}

const isAlreadyExists = (e: unknown) =>
  isAlreadyExistsText((e as Error)?.message ?? "");

const TECHNICIANS = /* GraphQL */ `
  query Technicians {
    techniciansList {
      id
      email
    }
  }
`;
const idCache = new Map<string, string[]>();

export async function resolveMyIds(userSub: string): Promise<string[]> {
  const cached = idCache.get(userSub);
  if (cached) return cached;
  try {
    const email = (await fetchUserAttributes()).email?.trim().toLowerCase();
    if (!email) return [userSub];
    const data = await gql<{
      techniciansList: ({ id: string; email?: string | null } | null)[];
    }>(TECHNICIANS, {});
    const ids = new Set<string>([userSub]);
    for (const t of data.techniciansList ?? [])
      if (t && t.email?.trim().toLowerCase() === email) ids.add(t.id);
    const result = [...ids];
    idCache.set(userSub, result);
    return result;
  } catch (e) {
    console.warn(
      "[jobcards] could not look up the other logins for this person:",
      e,
    );
    return [userSub];
  }
}

const GET_MODULE = /* GraphQL */ `
  query GetModule($id: ID!) {
    getJobCardModule(id: $id) {
      id
      status
      assignedTo
    }
  }
`;

export async function getWorkItemState(
  id: string,
): Promise<{ status: string; assignedTo: string | null } | null> {
  const d = await gql<{
    getJobCardModule: { status: string; assignedTo?: string | null } | null;
  }>(GET_MODULE, { id });
  const m = d.getJobCardModule;
  return m ? { status: m.status, assignedTo: m.assignedTo ?? null } : null;
}

const sameInstant = (a?: string | null, b?: string | null): boolean =>
  !!a && !!b && Date.parse(a) === Date.parse(b);

const LIST_OPEN_JOB_CARDS = /* GraphQL */ `
  query OpenJobCards($nextToken: String) {
    jobCardsByStatus(status: OPEN, limit: 200, nextToken: $nextToken) {
      items {
        id
        jcNumber
        customerName
        title
        status
        closedAt
        assignedTo
        assignedToName
        assignedToEmail
        assignedAt
      }
      nextToken
    }
  }
`;

const LIST_PENDING_MODULES = /* GraphQL */ `
  query PendingModules($jobCardId: ID!, $nextToken: String) {
    jobCardModulesByJobCardIdAndStatus(
      jobCardId: $jobCardId
      status: PENDING
      limit: 200
      nextToken: $nextToken
    ) {
      items {
        id
        jobCardId
        scaleId
        moduleType
        sequence
        addedAt
      }
      nextToken
    }
  }
`;

const LIST_SUBMISSIONS_BY_JOB_CARD = /* GraphQL */ `
  query SubmissionsByJobCard($jobCardId: ID!, $nextToken: String) {
    jobCardSubmissionsByJobCardIdAndSubmittedAt(
      jobCardId: $jobCardId
      sortDirection: DESC
      limit: 200
      nextToken: $nextToken
    ) {
      items {
        id
        moduleId
        scaleId
        moduleType
        submittedAt
        payload
      }
      nextToken
    }
  }
`;

const LIST_SCALES = /* GraphQL */ `
  query ScalesOfJobCard($jobCardId: ID!, $nextToken: String) {
    scalesByJobCard(jobCardId: $jobCardId, limit: 200, nextToken: $nextToken) {
      items {
        id
        jobCardId
        scaleName
      }
      nextToken
    }
  }
`;

const GET_JOB_CARD = /* GraphQL */ `
  query GetJobCard($id: ID!) {
    getJobCard(id: $id) {
      id
      jcNumber
      customerName
      title
      status
      closedAt
      assignedTo
      assignedToName
      assignedToEmail
      assignedAt
    }
  }
`;

const GET_SCALE = /* GraphQL */ `
  query GetScale($id: ID!) {
    getJobCardScale(id: $id) {
      id
      jobCardId
      scaleName
    }
  }
`;

const LATEST_SUBMISSION = /* GraphQL */ `
  query LatestSubmission($key: String!) {
    submissionsByScaleType(scaleTypeKey: $key, sortDirection: DESC, limit: 1) {
      items {
        id
        moduleType
        submittedAt
        payload
      }
    }
  }
`;

const UPDATE_MODULE = /* GraphQL */ `
  mutation UpdateModule($input: UpdateJobCardModuleInput!) {
    updateJobCardModule(input: $input) {
      id
      status
    }
  }
`;
const CREATE_SUBMISSION = /* GraphQL */ `
  mutation CreateSubmission($input: CreateJobCardSubmissionInput!) {
    createJobCardSubmission(input: $input) {
      id
    }
  }
`;
const LIST_TIME_ENTRIES = /* GraphQL */ `
  query TimeEntries($jobCardId: ID!, $nextToken: String) {
    timeEntriesByJobCard(
      jobCardId: $jobCardId
      limit: 200
      nextToken: $nextToken
    ) {
      items {
        id
        userId
        userName
        userEmail
        startedAt
        minutes
        endedAt
        lastActiveAt
        startReason
      }
      nextToken
    }
  }
`;
const GET_TIME_ENTRY = /* GraphQL */ `
  query GetTimeEntry($id: ID!) {
    getJobCardTimeEntry(id: $id) {
      id
      startedAt
      endedAt
      endReason
    }
  }
`;
const CLOSE_TIME_ENTRY = /* GraphQL */ `
  mutation CloseTimeEntry($input: UpdateJobCardTimeEntryInput!) {
    updateJobCardTimeEntry(input: $input) {
      id
    }
  }
`;
const CREATE_TIME_ENTRY = /* GraphQL */ `
  mutation CreateTimeEntry($input: CreateJobCardTimeEntryInput!) {
    createJobCardTimeEntry(input: $input) {
      id
    }
  }
`;
const CREATE_SCALE = /* GraphQL */ `
  mutation CreateScale($input: CreateJobCardScaleInput!) {
    createJobCardScale(input: $input) {
      id
    }
  }
`;
const CREATE_MODULE = /* GraphQL */ `
  mutation CreateModule($input: CreateJobCardModuleInput!) {
    createJobCardModule(input: $input) {
      id
    }
  }
`;

const parseJson = (v: unknown): Record<string, unknown> => {
  try {
    const x = typeof v === "string" ? JSON.parse(v) : v;
    return x && typeof x === "object" ? (x as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

// Row shapes returned by the paginated queries. Kept here so the lambdas that
// call gql<T> never need to reference the outer nextToken — that's what TS7022
// was flagging.
type JobCardRow = OpenWork["jobCards"][number];
type ScaleRow = OpenWork["scales"][number];
type PendingModuleRow = {
  id: string;
  jobCardId: string;
  scaleId: string;
  moduleType: WorkItemType;
  sequence: number;
  addedAt?: string | null;
};
type SubmissionRow = {
  id: string;
  moduleId: string;
  scaleId: string;
  moduleType: WorkItemType;
  submittedAt: string;
  payload: unknown;
};
type TimeEntryRow = {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  startedAt?: string | null;
  minutes?: number | null;
  endedAt?: string | null;
  lastActiveAt?: string | null;
  startReason?: string | null;
};

export const jobCardApi: JobCardApi = {
  async listOpenWork(known?: Record<string, string>): Promise<OpenWork> {
    const jobCards = await fetchAllPages<JobCardRow>(async (token) => {
      const d = await gql<{ jobCardsByStatus: Page<JobCardRow> }>(
        LIST_OPEN_JOB_CARDS,
        { nextToken: token },
      );
      return d.jobCardsByStatus;
    });

    const scales: OpenWork["scales"] = [];
    const items: ServerWorkItem[] = [];
    const doneItems: ServerDoneItem[] = [];
    const incompleteJobCardIds: string[] = [];

    for (let i = 0; i < jobCards.length; i += 4) {
      await Promise.all(
        jobCards.slice(i, i + 4).map(async (j) => {
          try {
            // ---- scales ----
            const myScales = await fetchAllPages<ScaleRow>(async (token) => {
              const d = await gql<{ scalesByJobCard: Page<ScaleRow> }>(
                LIST_SCALES,
                { jobCardId: j.id, nextToken: token },
              );
              return d.scalesByJobCard;
            });

            // ---- pending modules (new GSI) ----
            const pendingRows = await fetchAllPages<PendingModuleRow>(
              async (token) => {
                const d = await gql<{
                  jobCardModulesByJobCardIdAndStatus: Page<PendingModuleRow>;
                }>(LIST_PENDING_MODULES, {
                  jobCardId: j.id,
                  nextToken: token,
                });
                return d.jobCardModulesByJobCardIdAndStatus;
              },
            );
            const myItems: ServerWorkItem[] = pendingRows.map((m) => ({
              id: m.id,
              jobCardId: m.jobCardId,
              scaleId: m.scaleId,
              moduleType: m.moduleType,
              sequence: m.sequence ?? 0,
              assignedAt: m.addedAt ?? null,
            }));

            // ---- finished work (bulk, one chain) ----
            const myDone: ServerDoneItem[] = [];
            let doneFailed = false;
            try {
              const submissionRows = await fetchAllPages<SubmissionRow>(
                async (token) => {
                  const d = await gql<{
                    jobCardSubmissionsByJobCardIdAndSubmittedAt: Page<SubmissionRow>;
                  }>(LIST_SUBMISSIONS_BY_JOB_CARD, {
                    jobCardId: j.id,
                    nextToken: token,
                  });
                  return d.jobCardSubmissionsByJobCardIdAndSubmittedAt;
                },
              );
              // Latest submission per moduleId — submissions come DESC.
              const latestByModule = new Map<
                string,
                {
                  submissionId: string;
                  scaleId: string;
                  moduleType: WorkItemType;
                  submittedAt: string;
                  payload: Record<string, unknown>;
                }
              >();
              for (const s of submissionRows) {
                if (latestByModule.has(s.moduleId)) continue;
                latestByModule.set(s.moduleId, {
                  submissionId: s.id,
                  scaleId: s.scaleId,
                  moduleType: s.moduleType,
                  submittedAt: s.submittedAt,
                  payload: parseJson(s.payload),
                });
              }
              for (const [moduleId, latest] of latestByModule) {
                if (sameInstant(known?.[moduleId], latest.submittedAt))
                  continue;
                myDone.push({
                  id: moduleId,
                  jobCardId: j.id,
                  scaleId: latest.scaleId,
                  moduleType: latest.moduleType,
                  sequence: Number(latest.payload.sequence ?? 0),
                  assignedAt: null,
                  submittedAt: latest.submittedAt,
                  submissionId: latest.submissionId,
                  payload: latest.payload,
                });
              }
            } catch (e) {
              doneFailed = true;
              console.warn(
                "[jobcards] could not read submissions of job card",
                j.id,
                e,
              );
            }

            scales.push(...myScales);
            items.push(...myItems);
            doneItems.push(...myDone);
            if (doneFailed) incompleteJobCardIds.push(j.id);
          } catch {
            incompleteJobCardIds.push(j.id);
          }
        }),
      );
    }
    return { jobCards, scales, items, doneItems, incompleteJobCardIds };
  },

  async getJobCard(id) {
    const d = await gql<{ getJobCard: JobCardRow | null }>(GET_JOB_CARD, {
      id,
    });
    return d.getJobCard;
  },

  async getScale(id) {
    const d = await gql<{ getJobCardScale: ScaleRow | null }>(GET_SCALE, {
      id,
    });
    return d.getJobCardScale;
  },

  async latestSubmission(
    scaleId,
    type: WorkItemType,
  ): Promise<ServerSubmission | null> {
    const d = await gql<{
      submissionsByScaleType: {
        items: {
          id: string;
          moduleType: WorkItemType;
          submittedAt: string;
          payload: unknown;
        }[];
      };
    }>(LATEST_SUBMISSION, { key: `${scaleId}#${type}` });
    const s = d.submissionsByScaleType.items[0];
    return s
      ? {
          id: s.id,
          moduleType: s.moduleType,
          submittedAt: s.submittedAt,
          payload: parseJson(s.payload),
        }
      : null;
  },

  async markModuleSubmitted({ id, submittedAt, submittedBy }) {
    await gql(UPDATE_MODULE, {
      input: { id, status: "SUBMITTED", submittedAt, submittedBy },
    });
  },

  async createSubmission(a) {
    try {
      await gql(CREATE_SUBMISSION, {
        input: {
          id: a.id,
          moduleId: a.moduleId,
          scaleId: a.scaleId,
          jobCardId: a.jobCardId,
          moduleType: a.moduleType,
          scaleTypeKey: `${a.scaleId}#${a.moduleType}`,
          submittedBy: a.submittedBy,
          submittedAt: a.submittedAt,
          schemaVersion: 1,
          payload: JSON.stringify(a.payload),
          deliveryState: "PENDING",
        },
      });
    } catch (e) {
      if (!isAlreadyExists(e)) throw e;
    }
  },

  async listTimeEntries(jobCardId) {
    return fetchAllPages<TimeEntryRow>(async (token) => {
      const data = await gql<{ timeEntriesByJobCard: Page<TimeEntryRow> }>(
        LIST_TIME_ENTRIES,
        { jobCardId, nextToken: token },
      );
      return data.timeEntriesByJobCard;
    });
  },

  async closeTimeEntry(a) {
    try {
      const cur = (
        await gql<{
          getJobCardTimeEntry: {
            endedAt?: string | null;
            endReason?: string | null;
          } | null;
        }>(GET_TIME_ENTRY, { id: a.id })
      ).getJobCardTimeEntry;
      if (!cur) return;
      const endedAt = resolveEnd({
        startedAt: a.startedAt,
        phoneEnd: a.endedAt,
        serverEndedAt: cur.endedAt,
        serverEndReason: cur.endReason,
      });
      const finishedByWork = [
        "ALL_SUBMITTED",
        "JOB_CLOSED",
        "NO_WORK_ITEMS",
      ].includes(cur.endReason ?? "");
      await gql(CLOSE_TIME_ENTRY, {
        input: {
          id: a.id,
          endedAt,
          minutes: Math.max(
            0,
            Math.round(
              (Date.parse(endedAt) - Date.parse(a.startedAt)) / 60_000,
            ),
          ),
          ...(finishedByWork ? {} : { endReason: "SESSION_ENDED" }),
        },
      });
    } catch (e) {
      if (
        !/ConditionalCheckFailed|does not exist|not found/i.test(
          String((e as Error)?.message ?? e),
        )
      )
        throw e;
    }
  },

  async touchTimeEntry(a) {
    try {
      await gql(CLOSE_TIME_ENTRY, { input: { id: a.id, lastActiveAt: a.at } });
    } catch {
      /* best effort */
    }
  },

  async createTimeEntry(a) {
    try {
      await gql(CREATE_TIME_ENTRY, {
        input: {
          id: a.id,
          jobCardId: a.jobCardId,
          userId: a.userId,
          userName: a.userName,
          userEmail: normEmail(a.userEmail),
          startedAt: a.startedAt,
          lastActiveAt: a.startedAt,
          startReason: "JOB_CARD_OPENED",
        },
      });
    } catch (e) {
      if (!isAlreadyExists(e)) throw e;
    }
  },

  async createScale(a) {
    try {
      await gql(CREATE_SCALE, {
        input: {
          id: a.id,
          jobCardId: a.jobCardId,
          scaleName: a.scaleName,
          createdBy: a.createdBy,
        },
      });
    } catch (e) {
      if (!isAlreadyExists(e)) throw e;
    }
  },

  async createModule(a) {
    try {
      await gql(CREATE_MODULE, {
        input: {
          id: a.id,
          scaleId: a.scaleId,
          jobCardId: a.jobCardId,
          moduleType: a.moduleType,
          status: "PENDING",
          sequence: a.sequence,
          addedBy: a.addedBy,
          addedAt: a.addedAt,
        },
      });
    } catch (e) {
      if (!isAlreadyExists(e)) throw e;
    }
  },

  async uploadPhoto(storageKey, localUri) {
    const response = await fetch(localUri);
    const blob = await response.blob();
    await uploadData({
      path: storageKey,
      data: blob,
      options: { contentType: "image/jpeg" },
    }).result;
  },
};
