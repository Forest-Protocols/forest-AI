export class TerminationError extends Error {
  constructor() {
    super("Termination signal received");
    this.name = "TerminationError";
  }
}
