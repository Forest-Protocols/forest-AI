export class NotInitialized extends Error {
  constructor(entity: any) {
    super(`${entity} not initialized`);
    this.name = "NotInitialized";
  }
}
