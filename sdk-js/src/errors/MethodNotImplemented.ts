export class MethodNotImplemented extends Error {
  constructor() {
    super(`Method is not implemented`);
    this.name = "MethodNotImplemented";
  }
}
