import { notFound } from "next/navigation";

type ParamsWithId = Promise<{ id: string }>;

export async function loadResourceByIdParamOrNotFound<TEntity>({
  params,
  getById,
}: {
  params: ParamsWithId;
  getById: (id: string) => Promise<TEntity | null>;
}) {
  const { id } = await params;
  const entity = await getById(id);

  if (!entity) {
    notFound();
  }

  return {
    id,
    entity,
  };
}
