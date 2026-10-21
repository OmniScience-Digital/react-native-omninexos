// src/jobcards/api.ts
// The real server calls for the Job Cards module (GraphQL through Amplify, and photo uploads to storage).
// Query names are the ones the web project's data model defines (amplify/data/jobcards.models.ts).
import { client } from "@/src/amplify";
import { uploadData } from "aws-amplify/storage";
import type { JobCardApi, ServerSubmission, ServerWorkItem } from "./sync";
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

const LIST_ASSIGNED = /* GraphQL */ `
  query ModulesByAssignee($assignedTo: String!, $nextToken: String) {
    modulesByAssignee(
      assignedTo: $assignedTo
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
const GET_JOB_CARD = /* GraphQL */ `
  query GetJobCard($id: ID!) {
    getJobCard(id: $id) {
      id
      jcNumber
      customerName
      title
      status
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
        startedAt
        minutes
        endedAt
      }
      nextToken
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

const parseJson = (v: unknown): Record<string, unknown> => {
  try {
    const x = typeof v === "string" ? JSON.parse(v) : v;
    return x && typeof x === "object" ? (x as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

export const jobCardApi: JobCardApi = {
  async listAssignedPending(userSub) {
    const out: ServerWorkItem[] = [];
    let nextToken: string | null = null;
    do {
      const data: {
        modulesByAssignee: {
          items: (ServerWorkItem & { addedAt?: string })[];
          nextToken: string | null;
        };
      } = await gql(LIST_ASSIGNED, { assignedTo: userSub, nextToken });
      for (const i of data.modulesByAssignee.items) {
        if (i)
          out.push({
            id: i.id,
            jobCardId: i.jobCardId,
            scaleId: i.scaleId,
            moduleType: i.moduleType,
            sequence: i.sequence ?? 0,
            assignedAt: i.addedAt ?? null,
          });
      }
      nextToken = data.modulesByAssignee.nextToken;
    } while (nextToken);
    return out;
  },

  async getJobCard(id) {
    const d = await gql<{
      getJobCard: {
        id: string;
        jcNumber: string;
        customerName?: string;
        title?: string;
        status: string;
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
      startedAt?: string | null;
      minutes?: number | null;
      endedAt?: string | null;
    }[] = [];
    let nextToken: string | null = null;
    do {
      const data: {
        timeEntriesByJobCard: {
          items: {
            id: string;
            userId: string;
            startedAt?: string | null;
            minutes?: number | null;
            endedAt?: string | null;
          }[];
          nextToken: string | null;
        };
      } = await gql(LIST_TIME_ENTRIES, { jobCardId, nextToken });
      out.push(...data.timeEntriesByJobCard.items.filter(Boolean));
      nextToken = data.timeEntriesByJobCard.nextToken;
    } while (nextToken);
    return out;
  },

  async createTimeEntry(a) {
    try {
      await gql(CREATE_TIME_ENTRY, {
        input: {
          id: a.id,
          jobCardId: a.jobCardId,
          userId: a.userId,
          userName: a.userName,
          startedAt: a.startedAt,
          startReason: "WORK_ITEM_STARTED",
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
