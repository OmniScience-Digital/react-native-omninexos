// hooks/usePhotoRequests.ts — paginated photo change requests for admin
import { client } from "@/src/amplify";
import { useCallback, useEffect, useRef, useState } from "react";

export interface PhotoChangeRequest {
  id: string;
  userId: string;
  employeeName?: string;
  status: "PENDING" | "APPROVED" | "DENIED" | "COMPLETED";
  requestedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

interface PageResult {
  items: PhotoChangeRequest[];
  nextToken: string | null;
}

// Uses the GSI "photoChangeRequestsByStatusAndRequestedAt" so AppSync hits
// an index instead of a full table scan with a filter. The variable type
// must be PhotoChangeRequestStatus (the actual enum) — not String, which
// AppSync rejects and returns an error.
const LIST_BY_STATUS = /* GraphQL */ `
  query PhotoRequestsByStatus(
    $status: PhotoChangeRequestStatus!
    $limit: Int
    $nextToken: String
  ) {
    photoRequestsByStatus(
      status: $status
      limit: $limit
      nextToken: $nextToken
      sortDirection: DESC
    ) {
      items {
        id
        userId
        employeeName
        status
        requestedAt
        reviewedAt
        reviewedBy
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

// Full list with no status filter — used for the "ALL" tab.
const LIST_ALL = /* GraphQL */ `
  query ListAllPhotoChangeRequests($limit: Int, $nextToken: String) {
    listPhotoChangeRequests(limit: $limit, nextToken: $nextToken) {
      items {
        id
        userId
        employeeName
        status
        requestedAt
        reviewedAt
        reviewedBy
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

const UPDATE_REQUEST = /* GraphQL */ `
  mutation UpdatePhotoChangeRequest($input: UpdatePhotoChangeRequestInput!) {
    updatePhotoChangeRequest(input: $input) {
      id
      status
      reviewedAt
      reviewedBy
    }
  }
`;

// Looked up client-side right before notifying — this hook fetches the
// employee's registered push token(s) itself rather than the Lambda doing
// it, so notifyPhotoApproval stays a pure "send this push" function with
// no DynamoDB/AppSync access of its own.
const GET_PUSH_TOKENS = /* GraphQL */ `
  query GetPushTokens($userId: String!) {
    pushTokensByUser(userId: $userId) {
      items {
        token
      }
    }
  }
`;

// Sends a push notification to the employee — fires server-side via
// Lambda, so it reaches their device even if the app is fully closed.
const NOTIFY_STATUS = /* GraphQL */ `
  mutation NotifyPhotoRequestStatus($pushTokens: [String]!, $status: String!) {
    notifyPhotoRequestStatus(pushTokens: $pushTokens, status: $status)
  }
`;

const PAGE_SIZE = 15;

// Fetches the employee's registered push tokens, then fires the notify
// mutation. Best-effort by design — failures are logged, never thrown,
// since a missing/stale push token shouldn't block an approval/denial.
async function notifyEmployee(userId: string, status: "APPROVED" | "DENIED") {
  try {
    const { data, errors } = (await client.graphql({
      query: GET_PUSH_TOKENS,
      variables: { userId },
      authMode: "apiKey",
    })) as any;

    if (errors) throw new Error(errors[0].message);

    const tokens: string[] = (data?.pushTokensByUser?.items ?? [])
      .map((t: any) => t.token)
      .filter((t: string) => !!t);

    if (tokens.length === 0) {
      console.log(`[usePhotoRequests] No push tokens for user ${userId}`);
      return;
    }

    const { errors: notifyErrors } = (await client.graphql({
      query: NOTIFY_STATUS,
      variables: { pushTokens: tokens, status },
      authMode: "apiKey",
    })) as any;

    if (notifyErrors) throw new Error(notifyErrors[0].message);
  } catch (e) {
    console.warn("[usePhotoRequests] notify failed:", e);
  }
}

export function usePhotoRequests(statusFilter: "PENDING" | "ALL" = "PENDING") {
  const [items, setItems] = useState<PhotoChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const nextTokenRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  // Always-current mirror of items — lets approve/deny callbacks read the
  // latest list without capturing stale state via their dependency array.
  const itemsRef = useRef<PhotoChangeRequest[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const loadFirstPage = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setItems([]);
    nextTokenRef.current = null;
    setHasMore(true);
    setError(null);

    try {
      let result: PageResult;

      if (statusFilter === "ALL") {
        const { data, errors } = (await client.graphql({
          query: LIST_ALL,
          variables: { limit: PAGE_SIZE, nextToken: null },
          authMode: "apiKey",
        })) as any;
        if (errors) throw new Error(errors[0].message);
        result = data.listPhotoChangeRequests;
      } else {
        const { data, errors } = (await client.graphql({
          query: LIST_BY_STATUS,
          variables: {
            status: statusFilter,
            limit: PAGE_SIZE,
            nextToken: null,
          },
          authMode: "apiKey",
        })) as any;
        if (errors) throw new Error(errors[0].message);
        result = data.photoRequestsByStatus;
      }

      const sorted = [...result.items].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setItems(sorted);
      nextTokenRef.current = result.nextToken;
      setHasMore(!!result.nextToken);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load requests");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [statusFilter]);

  const loadMore = useCallback(async () => {
    if (!hasMore || fetchingMore || !nextTokenRef.current) return;
    setFetchingMore(true);

    try {
      let result: PageResult;

      if (statusFilter === "ALL") {
        const { data, errors } = (await client.graphql({
          query: LIST_ALL,
          variables: { limit: PAGE_SIZE, nextToken: nextTokenRef.current },
          authMode: "apiKey",
        })) as any;
        if (errors) throw new Error(errors[0].message);
        result = data.listPhotoChangeRequests;
      } else {
        const { data, errors } = (await client.graphql({
          query: LIST_BY_STATUS,
          variables: {
            status: statusFilter,
            limit: PAGE_SIZE,
            nextToken: nextTokenRef.current,
          },
          authMode: "apiKey",
        })) as any;
        if (errors) throw new Error(errors[0].message);
        result = data.photoRequestsByStatus;
      }

      setItems((prev) => {
        const ids = new Set(prev.map((i) => i.id));
        const fresh = result.items.filter((i) => !ids.has(i.id));
        return [...prev, ...fresh].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      });
      nextTokenRef.current = result.nextToken;
      setHasMore(!!result.nextToken);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load more");
    } finally {
      setFetchingMore(false);
    }
  }, [hasMore, fetchingMore, statusFilter]);

  const approveRequest = useCallback(
    async (id: string, reviewerEmail: string): Promise<boolean> => {
      try {
        const { errors } = (await client.graphql({
          query: UPDATE_REQUEST,
          variables: {
            input: {
              id,
              status: "APPROVED",
              reviewedAt: new Date().toISOString(),
              reviewedBy: reviewerEmail,
            },
          },
          authMode: "apiKey",
        })) as any;
        if (errors) throw new Error(errors[0].message);
        setItems((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: "APPROVED" } : r)),
        );

        // Use the ref — always points to the current list, no stale closure.
        const target = itemsRef.current.find((r) => r.id === id);
        if (target?.userId) {
          notifyEmployee(target.userId, "APPROVED");
        }

        return true;
      } catch (e: any) {
        setError(e?.message ?? "Failed to approve");
        return false;
      }
    },
    [], // no dependency on items — itemsRef stays current via useEffect
  );

  const denyRequest = useCallback(
    async (id: string, reviewerEmail: string): Promise<boolean> => {
      try {
        const { errors } = (await client.graphql({
          query: UPDATE_REQUEST,
          variables: {
            input: {
              id,
              status: "DENIED",
              reviewedAt: new Date().toISOString(),
              reviewedBy: reviewerEmail,
            },
          },
          authMode: "apiKey",
        })) as any;
        if (errors) throw new Error(errors[0].message);
        setItems((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: "DENIED" } : r)),
        );

        // Use the ref — same stale-closure fix as approveRequest above.
        const target = itemsRef.current.find((r) => r.id === id);
        if (target?.userId) {
          notifyEmployee(target.userId, "DENIED");
        }

        return true;
      } catch (e: any) {
        setError(e?.message ?? "Failed to deny");
        return false;
      }
    },
    [], // no dependency on items — itemsRef stays current via useEffect
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    items,
    loading,
    fetchingMore,
    hasMore,
    error,
    clearError,
    loadFirstPage,
    loadMore,
    approveRequest,
    denyRequest,
  };
}
