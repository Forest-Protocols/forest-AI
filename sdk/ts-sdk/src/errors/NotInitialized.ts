export class NotInitialized extends Error {
  constructor(entity: any) {
    super(`${entity} is not initialized yet`);
    this.name = "NotInitialized";
  }
}
