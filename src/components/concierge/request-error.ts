/** Thrown when a concierge fetch (chat or voice-turn) comes back non-ok, so the catch handler can tell a rate limit apart from any other failure and hand off to WhatsApp with an accurate message. */
export class ConciergeRequestError extends Error {
  readonly rateLimited: boolean;

  constructor(status: number) {
    super(`Concierge request failed (${status}).`);
    this.rateLimited = status === 429;
  }
}
