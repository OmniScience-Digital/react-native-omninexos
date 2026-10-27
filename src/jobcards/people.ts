// src/jobcards/people.ts
// Who is who. One person can sign in two ways (email and password, or Google) and each way is a different Cognito id,
// so people are recognised by EMAIL. An id is only used when no email is known. Pure.

export interface Me {
  /** This login's id, plus any other id of the same person that is known */
  ids: Set<string>;
  email?: string;
}

export const normEmail = (e?: string | null): string | undefined =>
  e?.trim().toLowerCase() || undefined;

/** The key that identifies a person: the email when known, else the id. */
export const personKey = (id: string, email?: string | null): string => {
  const e = normEmail(email);
  return e ? `email:${e}` : `id:${id}`;
};

/** Is this job card assigned to the signed-in person? Matches by email, or by any of their known ids. */
export function isAssignedToMe(
  card: { assignedTo?: string | null; assignedToEmail?: string | null },
  me: Me,
): boolean {
  const mine = normEmail(me.email);
  const theirs = normEmail(card.assignedToEmail);
  if (mine && theirs) return mine === theirs;
  return !!card.assignedTo && me.ids.has(card.assignedTo);
}
