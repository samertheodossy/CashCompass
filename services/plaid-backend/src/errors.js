export class ServiceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
    this.code = code;
  }
}

export function fail(status, code, message) {
  throw new ServiceError(status, code, message);
}

export function publicError(error) {
  if (error instanceof ServiceError) {
    return { status: error.status, body: { ok: false, error: error.code } };
  }
  return { status: 500, body: { ok: false, error: 'INTERNAL_ERROR' } };
}
