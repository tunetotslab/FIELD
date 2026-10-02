export class StorageError extends Error {
  readonly reason: string;
  constructor(
    public readonly step: string,
    cause: unknown,
  ) {
    super("Local recording storage failed");
    this.reason =
      cause instanceof Error && /^[a-zA-Z]{1,30}$/.test(cause.name)
        ? cause.name
        : "Error";
  }
}
