interface ClientPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientPage({ params }: ClientPageProps) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Клиент #{id}</h1>
      <p className="text-muted-foreground">
        Детальная информация о клиенте.
      </p>
    </div>
  );
}
