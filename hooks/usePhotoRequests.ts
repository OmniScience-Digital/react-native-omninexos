// hooks/usePhotoRequests.ts — paginated photo change requests for admin
import { client } from "@/src/amplify";
import { useCallback, useRef, useState } from "react";

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

const LIST_REQUESTS_PAGINATED = /* GraphQL */ `
  query ListPhotoChangeRequests(
    $status: String
    $limit: Int
    $nextToken: String
  ) {
    listPhotoChangeRequests(
      filter: { status: { eq: $status } }
      limit: $limit
      nextToken: $nextToken
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

const PAGE_SIZE = 15;

export function usePhotoRequests(statusFilter: "PENDING" | "ALL" = "PENDING") {
  const [items, setItems] = useState<PhotoChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const nextTokenRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  const loadFirstPage = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setItems([]);
    nextTokenRef.current = null;
    setHasMore(true);
    setError(null);

    try {
      const { data, errors } = (await client.graphql({
        query: LIST_REQUESTS_PAGINATED,
        variables: {
          status: statusFilter === "ALL" ? undefined : statusFilter,
          limit: PAGE_SIZE,
          nextToken: null,
        },
        authMode: "apiKey",
      })) as any;

      if (errors) throw new Error(errors[0].message);

      const result: PageResult = data.listPhotoChangeRequests;
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
      const { data, errors } = (await client.graphql({
        query: LIST_REQUESTS_PAGINATED,
        variables: {
          status: statusFilter === "ALL" ? undefined : statusFilter,
          limit: PAGE_SIZE,
          nextToken: nextTokenRef.current,
        },
        authMode: "apiKey",
      })) as any;

      if (errors) throw new Error(errors[0].message);

      const result: PageResult = data.listPhotoChangeRequests;
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
        return true;
      } catch (e: any) {
        setError(e?.message ?? "Failed to approve");
        return false;
      }
    },
    [],
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
        return true;
      } catch (e: any) {
        setError(e?.message ?? "Failed to deny");
        return false;
      }
    },
    [],
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
