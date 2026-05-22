export interface ApiErrorBody {
  success: false;
  message: string;
  errors: string[];
}

export interface ApiSuccessBody<T = unknown> {
  success: true;
  message: string;
  data?: T;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly errors: string[];

  constructor(statusCode: number, message: string, errors: string[] = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors.length > 0 ? errors : [message];
  }
}

export function successResponse<T>(
  message: string,
  data?: T
): ApiSuccessBody<T> {
  return data !== undefined ? { success: true, message, data } : { success: true, message };
}

export function errorResponse(message: string, errors: string[] = []): ApiErrorBody {
  return {
    success: false,
    message,
    errors: errors.length > 0 ? errors : [message],
  };
}
