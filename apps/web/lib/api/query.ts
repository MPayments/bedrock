import { z, type ZodTypeAny } from "zod";

import {
  ApiRequestError,
  parseJsonSafely,
  readJsonWithSchema,
  requestOk,
  type HttpResponseLike,
} from "./response";

type ApiQueryResult<T> = {
  data: T;
  response: HttpResponseLike;
};

export async function readPaginatedList<TSchema extends ZodTypeAny>({
  request,
  schema,
  context,
}: {
  request: () => Promise<HttpResponseLike>;
  schema: TSchema;
  context: string;
}): Promise<ApiQueryResult<z.infer<TSchema>>> {
  const response = await requestOk(await request(), context);
  const data = await readJsonWithSchema(response, schema);
  return { data, response };
}

export async function readOptionsList<TSchema extends ZodTypeAny>({
  request,
  schema,
  context,
}: {
  request: () => Promise<HttpResponseLike>;
  schema: TSchema;
  context: string;
}): Promise<z.infer<TSchema>> {
  const response = await requestOk(await request(), context);
  return readJsonWithSchema(response, schema);
}

export async function readEntityById<TSchema extends ZodTypeAny>({
  id,
  request,
  schema,
  resourceName,
}: {
  id: string;
  request: (validId: string) => Promise<HttpResponseLike>;
  schema: TSchema;
  resourceName: string;
}): Promise<z.infer<TSchema> | null> {
  if (!z.uuid({ version: "v4" }).safeParse(id).success) {
    return null;
  }

  const response = await request(id);

  if (response.status === 404) {
    return null;
  }

  await requestOk(response, `Не удалось загрузить ${resourceName}`);
  return readJsonWithSchema(response, schema);
}
