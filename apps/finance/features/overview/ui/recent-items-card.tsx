import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

export function RecentItemsCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: {
    id: string;
    title: string;
    subtitle: string;
    href: string;
  }[];
}) {
  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Данные отсутствуют.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="hover:bg-muted block rounded-sm border p-3 transition-colors"
              >
                <div className="font-medium">{item.title}</div>
                <div className="text-muted-foreground mt-1 text-sm">
                  {item.subtitle}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
