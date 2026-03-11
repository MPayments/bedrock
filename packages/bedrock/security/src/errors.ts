import {
  defineDomainError,
  defineHttpError,
  type DomainErrorInstance,
  type HttpErrorInstance,
} from "@bedrock/core";
import { z } from "zod";

export const AccessScopeSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
});

export const SecurityForbiddenDetails = z.object({
  kind: z.enum(["role", "permission", "policy"]),
  role: z.string().min(1).optional(),
  permission: z.string().min(1).optional(),
  policy: z.string().min(1).optional(),
  scope: AccessScopeSchema.optional(),
});

export const SecurityUnauthenticated = defineDomainError(
  "SECURITY_UNAUTHENTICATED",
);

export const SecurityForbidden = defineDomainError("SECURITY_FORBIDDEN", {
  details: SecurityForbiddenDetails,
});

export const UnauthorizedHttpError = defineHttpError("SECURITY_UNAUTHENTICATED", {
  status: 401,
  description: "Unauthorized",
});

export const ForbiddenHttpError = defineHttpError("SECURITY_FORBIDDEN", {
  status: 403,
  description: "Forbidden",
  details: SecurityForbiddenDetails,
});

export type SecurityUnauthenticatedError = DomainErrorInstance<
  typeof SecurityUnauthenticated
>;

export type SecurityForbiddenError = DomainErrorInstance<typeof SecurityForbidden>;

export type SecurityAccessError =
  | SecurityUnauthenticatedError
  | SecurityForbiddenError;

export type UnauthorizedHttpErrorInstance = HttpErrorInstance<
  typeof UnauthorizedHttpError
>;

export type ForbiddenHttpErrorInstance = HttpErrorInstance<
  typeof ForbiddenHttpError
>;
