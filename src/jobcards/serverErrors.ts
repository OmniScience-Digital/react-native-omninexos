// src/jobcards/serverErrors.ts
// Reading the server's answers. Kept apart from api.ts (which needs the Amplify client) so it is easy to test.

/**
 * DynamoDB refused a write because the condition attached to it was not met: a create for an id that already
 * exists, or an update of a record that is gone. Through AppSync the text is NOT "ConditionalCheckFailedException"
 * but "The conditional request failed (Service: DynamoDb, Status Code: 400, Request ID: ...)". Matching only the
 * first wording meant a repeated send of a result the server already had was never recognised as done, and was
 * retried for ever (17+ attempts in a real background log).
 */
export const isConditionalFailure = (text: string): boolean =>
  /ConditionalCheckFailed|conditional request failed/i.test(text);

/** A create that failed only because an earlier try already created the same record. */
export const isAlreadyExistsText = (text: string): boolean =>
  isConditionalFailure(text) || /already exists/i.test(text);
