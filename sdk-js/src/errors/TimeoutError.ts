export class TimeoutError extends Error {
  constructor(timeoutFor?: string) {
    super(
      `Timeout reached ${timeoutFor !== undefined ? `for ${timeoutFor}` : ""}`
    );
    this.name = "TimeoutError";
  }
}
