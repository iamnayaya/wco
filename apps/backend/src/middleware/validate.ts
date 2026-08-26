import { ValidationError } from '@wco/shared';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

/**
 * Declarative Zod validation for body / params / query.
 *
 * Parsed values REPLACE the originals so downstream code works with coerced,
 * trimmed, defaults-applied data — never raw strings. Validation failures
 * become a single 422 with per-field details (machine-readable paths).
 *
 * Express 4 allows reassigning req.body/query/params; we also mirror the
 * result into res.locals.validated for handlers that prefer immutability.
 */
type Part = 'body' | 'params' | 'query';

export function validate<Schemas extends Partial<Record<Part, z.ZodTypeAny>>>(
  schemas: Schemas,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed: Partial<Record<Part, unknown>> = {};
      for (const part of ['params', 'query', 'body'] as const) {
        const schema = schemas[part];
        if (!schema) continue;
        // req.query may be an array under exotic querystrings — Zod handles shape checks.
        parsed[part] = schema.parse(req[part]);
        Object.defineProperty(req, part, {
          value: parsed[part],
          writable: true,
          configurable: true,
        });
      }
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(
          new ValidationError(
            'Request validation failed',
            Object.fromEntries(
              err.issues.map((i) => [i.path.join('.') || '(root)', i.message]),
            ),
          ),
        );
        return;
      }
      next(err);
    }
  };
}

/** Common reusable fragments. */
export const idParamSchema = z.object({ id: z.string().min(1).max(64) });
export type IdParam = z.infer<typeof idParamSchema>;
