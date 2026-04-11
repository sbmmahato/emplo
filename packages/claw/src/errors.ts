export class GoclawHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'GoclawHttpError';
    this.status = status;
    this.body = body;
  }
}
