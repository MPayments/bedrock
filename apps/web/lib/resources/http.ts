import { z } from "zod";

import { resolveApiErrorMessage } from "@/lib/api-error";
import { readEntityById } from "@/lib/api/query";
import {
  parseJsonSafely,
  type HttpResponseLike,
} from "@/lib/api/response";

export type { HttpResponseLike } from "@/lib/api/response";

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

type MutationResult<T> =
  | {
      ok: true;
      data: T;
      response: HttpResponseLike;
    }
  | {
      ok: false;
      message: string;
      status?: number;
    };

type ExecuteMutationOptions<T> = {
  request: () => Promise<HttpResponseLike>;
  fallbackMessage: string;
  parseData?: (response: HttpResponseLike) => Promise<T>;
};

export async function executeMutation<T>(
  options: ExecuteMutationOptions<T>,
): Promise<MutationResult<T>> {
  const parseData =
    options.parseData ?? (async (response) => (await response.json()) as T);

  try {
    const response = await options.request();

    if (!response.ok) {
      const payload = await parseJsonSafely(response);
      return {
        ok: false,
        status: response.status,
        message: resolveApiErrorMessage(
          response.status,
          payload,
          options.fallbackMessage,
        ),
      };
    }

    const data = await parseData(response);

    return {
      ok: true,
      data,
      response,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : options.fallbackMessage,
    };
  }
}

type ReadResourceByIdOptions<T> = {
  id: string;
  resourceName: string;
  request: (validId: string) => Promise<HttpResponseLike>;
  validate?: (payload: unknown) => payload is T;
  map?: (payload: unknown) => T;
};

export async function readResourceById<T>({
  id,
  resourceName,
  request,
  validate,
  map,
}: ReadResourceByIdOptions<T>): Promise<T | null> {
  const payload = await readEntityById({
    id,
    request,
    resourceName,
    schema: z.unknown().transform((value) => value as T),
  });

  if (!payload) {
    return null;
  }

  if (validate && !validate(payload)) {
    return null;
  }

  if (map) {
    return map(payload);
  }

  return payload;
}
