import { resolveApiErrorMessage } from "@/lib/api-error";

export interface HttpResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function parseJsonSafely(
  response: HttpResponseLike,
): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function resolveResponseErrorMessage(
  response: HttpResponseLike,
  fallbackMessage: string,
) {
  const payload = await parseJsonSafely(response);
  return resolveApiErrorMessage(response.status, payload, fallbackMessage);
}

function resolveUnknownErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
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
      return {
        ok: false,
        status: response.status,
        message: await resolveResponseErrorMessage(
          response,
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
      message: resolveUnknownErrorMessage(error, options.fallbackMessage),
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
  if (!isUuid(id)) {
    return null;
  }

  const response = await request(id);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch ${resourceName}: ${response.status}`);
  }

  const payload = await parseJsonSafely(response);

  if (
    !payload ||
    typeof payload !== "object" ||
    !("id" in payload) ||
    typeof payload.id !== "string"
  ) {
    return null;
  }

  if (validate && !validate(payload)) {
    return null;
  }

  if (map) {
    return map(payload);
  }

  return payload as T;
}
