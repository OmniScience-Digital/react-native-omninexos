// src/jobcards/api.ts
// The real server calls for the Job Cards module (GraphQL through Amplify, and photo uploads to storage).
// Query names are the ones the web project's data model defines (amplify/data/jobcards.models.ts).
import { client } from "@/src/amplify";
import { fetchUserAttributes } from "aws-amplify/auth";
import { uploadData } from "aws-amplify/storage";
import { normEmail } from "./people";
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
  // Amplify rejects (throws) on GraphQL errors; unwrap them to a plain Error with the message
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

const isAlreadyExists = (e: unknown) =>
  /ConditionalCheckFailed|already exists/i.test((e as Error)?.message ?? "");

// ---- one person, several logins -------------------------------------------------------------------------------
// The same person can have more than one Cognito login (email/password and Google). Work is assigned to ONE of
// their ids, so asking only for this login's id can miss it. The office's technician list knows every login that
// shares an email, so look that up and ask for all of them.
const TECHNICIANS = /* GraphQL */ `
  query Technicians {
    techniciansList {
      id
      email
    }
  }
`;
const idCache = new Map<string, string[]>();

/** This login's id plus the ids of any other login with the same email. Falls back to just this login offline. */
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
    idCache.set(userSub, result); // only remembered after a successful lookup
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

/** What the server says about one piece of work: null = it no longer exists. Throws if the server cannot be reached. */
export async function getWorkItemState(
  id: string,
): Promise<{ status: string; assignedTo: string | null } | null> {
  const d = await gql<{
    getJobCardModule: { status: string; assignedTo?: string | null } | null;
  }>(GET_MODULE, { id });
  const m = d.getJobCardModule;
  return m ? { status: m.status, assignedTo: m.assignedTo ?? null } : null;
}

// Every open job card, and every piece of work on it (pending AND finished). Anyone can open and complete any of it:
// assigning a job card only decides who is notified, so the phone no longer asks for "my" work items.
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
const LIST_PENDING_WORK = /* GraphQL */ `
  query PendingWork($jobCardId: ID!, $nextToken: String) {
    modulesByJobCard(
      jobCardId: $jobCardId
      filter: { status: { eq: PENDING } }
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
const LIST_SUBMITTED_WORK = /* GraphQL */ `
  query SubmittedWork($jobCardId: ID!, $nextToken: String) {
    modulesByJobCard(
      jobCardId: $jobCardId
      filter: { status: { eq: SUBMITTED } }
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
        submittedAt
      }
      nextToken
    }
  }
`;
const LATEST_MODULE_RESULT = /* GraphQL */ `
  query LatestModuleResult($moduleId: ID!) {
    submissionsByModule(moduleId: $moduleId, sortDirection: DESC, limit: 1) {
      items {
        id
        submittedAt
        payload
      }
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

export const jobCardApi: JobCardApi = {
  /**
   * Every open job card, its scales, the work still pending on it, and ALL its finished work (regardless of age:
   * finished work on an open job card stays editable as a revision). A job card whose work could not be read in full
   * is reported in incompleteJobCardIds, so the phone keeps what it already has for it.
   */
  async listOpenWork(): Promise<OpenWork> {
    const jobCards: OpenWork["jobCards"] = [];
    let nextToken: string | null = null;
    do {
      const data: {
        jobCardsByStatus: {
          items: (OpenWork["jobCards"][number] | null)[];
          nextToken: string | null;
        };
      } = await gql(LIST_OPEN_JOB_CARDS, { nextToken });
      for (const j of data.jobCardsByStatus.items) if (j) jobCards.push(j);
      nextToken = data.jobCardsByStatus.nextToken;
    } while (nextToken);

    const scales: OpenWork["scales"] = [];
    const items: ServerWorkItem[] = [];
    const doneItems: ServerDoneItem[] = [];
    const incompleteJobCardIds: string[] = [];
    for (let i = 0; i < jobCards.length; i += 4) {
      await Promise.all(
        jobCards.slice(i, i + 4).map(async (j) => {
          try {
            const myScales: OpenWork["scales"] = [];
            const myItems: ServerWorkItem[] = [];
            let t: string | null = null;
            do {
              const d: {
                scalesByJobCard: {
                  items: (OpenWork["scales"][number] | null)[];
                  nextToken: string | null;
                };
              } = await gql(LIST_SCALES, { jobCardId: j.id, nextToken: t });
              for (const sc of d.scalesByJobCard.items)
                if (sc) myScales.push(sc);
              t = d.scalesByJobCard.nextToken;
            } while (t);
            do {
              const d: {
                modulesByJobCard: {
                  items: (
                    | (ServerWorkItem & { addedAt?: string | null })
                    | null
                  )[];
                  nextToken: string | null;
                };
              } = await gql(LIST_PENDING_WORK, {
                jobCardId: j.id,
                nextToken: t,
              });
              for (const m of d.modulesByJobCard.items)
                if (m)
                  myItems.push({
                    id: m.id,
                    jobCardId: m.jobCardId,
                    scaleId: m.scaleId,
                    moduleType: m.moduleType,
                    sequence: m.sequence ?? 0,
                    assignedAt: m.addedAt ?? null,
                  });
              t = d.modulesByJobCard.nextToken;
            } while (t);

            // Finished work is read separately. If it fails, the pending work above still comes through, AND the
            // job card is reported incomplete: applyPull then leaves every local copy of its work alone (so a
            // submitted item the phone already had is never deleted just because this one request failed).
            const myDone: ServerDoneItem[] = [];
            let doneFailed = false;
            try {
              const submitted: (ServerWorkItem & {
                submittedAt?: string | null;
              })[] = [];
              t = null;
              do {
                const d: {
                  modulesByJobCard: {
                    items: (
                      | (ServerWorkItem & {
                          addedAt?: string | null;
                          submittedAt?: string | null;
                        })
                      | null
                    )[];
                    nextToken: string | null;
                  };
                } = await gql(LIST_SUBMITTED_WORK, {
                  jobCardId: j.id,
                  nextToken: t,
                });
                for (const m of d.modulesByJobCard.items)
                  if (m)
                    submitted.push({
                      id: m.id,
                      jobCardId: m.jobCardId,
                      scaleId: m.scaleId,
                      moduleType: m.moduleType,
                      sequence: m.sequence ?? 0,
                      assignedAt: m.addedAt ?? null,
                      submittedAt: m.submittedAt ?? null,
                    });
                t = d.modulesByJobCard.nextToken;
              } while (t);
              // the latest saved result of each piece, a few at a time
              for (let k = 0; k < submitted.length; k += 5) {
                await Promise.all(
                  submitted.slice(k, k + 5).map(async (s) => {
                    const r: {
                      submissionsByModule: {
                        items: ({
                          id: string;
                          submittedAt: string;
                          payload: unknown;
                        } | null)[];
                      };
                    } = await gql(LATEST_MODULE_RESULT, { moduleId: s.id });
                    const latest = r.submissionsByModule.items[0];
                    const payload = latest ? parseJson(latest.payload) : null;
                    if (latest && payload)
                      myDone.push({
                        ...s,
                        submittedAt: latest.submittedAt,
                        submissionId: latest.id,
                        payload,
                      });
                  }),
                );
              }
            } catch (e) {
              myDone.length = 0;
              doneFailed = true;
              console.warn(
                "[jobcards] could not read the finished work of job card",
                j.id,
                e,
              );
            }

            scales.push(...myScales);
            items.push(...myItems);
            doneItems.push(...myDone);
            // If any finished work could not be read, mark the job card incomplete so applyPull keeps every local
            // row for it untouched. This is the difference between "keep what the phone already had" and "silently
            // delete a submitted result because one request failed".
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
    const d = await gql<{
      getJobCard: {
        id: string;
        jcNumber: string;
        customerName?: string;
        title?: string;
        status: string;
        closedAt?: string | null;
        assignedTo?: string | null;
        assignedToName?: string | null;
        assignedToEmail?: string | null;
        assignedAt?: string | null;
      } | null;
    }>(GET_JOB_CARD, { id });
    return d.getJobCard;
  },

  async getScale(id) {
    const d = await gql<{
      getJobCardScale: {
        id: string;
        jobCardId: string;
        scaleName: string;
      } | null;
    }>(GET_SCALE, { id });
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
          // The backend worker finds new results through this field, then sends them to ClickUp and Telegram.
          deliveryState: "PENDING",
        },
      });
    } catch (e) {
      if (!isAlreadyExists(e)) throw e; // the same result was already saved by an earlier try
    }
  },

  async listTimeEntries(jobCardId) {
    const out: {
      id: string;
      userId: string;
      userName?: string | null;
      userEmail?: string | null;
      startedAt?: string | null;
      minutes?: number | null;
      endedAt?: string | null;
      lastActiveAt?: string | null;
      startReason?: string | null;
    }[] = [];
    let nextToken: string | null = null;
    do {
      const data: {
        timeEntriesByJobCard: {
          items: {
            id: string;
            userId: string;
            userName?: string | null;
            userEmail?: string | null;
            startedAt?: string | null;
            minutes?: number | null;
            endedAt?: string | null;
            lastActiveAt?: string | null;
            startReason?: string | null;
          }[];
          nextToken: string | null;
        };
      } = await gql(LIST_TIME_ENTRIES, { jobCardId, nextToken });
      out.push(...data.timeEntriesByJobCard.items.filter(Boolean));
      nextToken = data.timeEntriesByJobCard.nextToken;
    } while (nextToken);
    return out;
  },

  async closeTimeEntry(a) {
    try {
      // The web may already have closed this entry: the server's stop wins only when it is the real finish of the work
      const cur = (
        await gql<{
          getJobCardTimeEntry: {
            endedAt?: string | null;
            endReason?: string | null;
          } | null;
        }>(GET_TIME_ENTRY, { id: a.id })
      ).getJobCardTimeEntry;
      if (!cur) return; // the entry is gone: nothing left to do
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
          // keep the reason the work finished for; otherwise the person simply left
          ...(finishedByWork ? {} : { endReason: "SESSION_ENDED" }),
        },
      });
    } catch (e) {
      // the entry is gone, or the server already closed it: nothing left to do
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
      /* not sent yet, or already closed: the heartbeat is best effort */
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
          // a technician entering the job card (the same reason the web app uses, so the web can close it if it goes quiet)
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
      if (!isAlreadyExists(e)) throw e; // the scale was already created by an earlier try
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
          // not assigned to anyone: the job card is what gets assigned, and everyone can work on every item
        },
      });
    } catch (e) {
      if (!isAlreadyExists(e)) throw e; // the work item was already created by an earlier try
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
