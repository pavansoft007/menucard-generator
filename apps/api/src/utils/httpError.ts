export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  static badRequest(msg: string, details?: unknown) {
    return new HttpError(400, 'BAD_REQUEST', msg, details);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new HttpError(401, 'UNAUTHORIZED', msg);
  }
  static forbidden(msg = 'Forbidden') {
    return new HttpError(403, 'FORBIDDEN', msg);
  }
  static notFound(msg = 'Not found') {
    return new HttpError(404, 'NOT_FOUND', msg);
  }
  static conflict(msg: string) {
    return new HttpError(409, 'CONFLICT', msg);
  }
}
