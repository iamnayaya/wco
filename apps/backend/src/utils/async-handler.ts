import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps async route handlers so rejected promises reach the error middleware.
 * Express 4 does not await handlers — without this, an async throw crashes
 * the request with a hung socket instead of a clean 500.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
