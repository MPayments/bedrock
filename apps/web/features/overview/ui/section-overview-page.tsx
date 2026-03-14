import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

type OverviewStat = {
  id: string;
  label: string;
  value: string;
  description: string;
  href?: string;
};

type OverviewLink = {
  id: string;
  title: string;
  description: string;
  href: string;
  cta?: string;
};

export function SectionOverviewPage({
  icon: Icon,
  title,
  description,
  stats,
  links,
  aside,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  stats: OverviewStat[];
  links: OverviewLink[];
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="bg-muted rounded-lg p-2.5">
          <Icon className="text-muted-foreground size-5" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            {description}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.id} className="rounded-sm">
              <CardHeader className="border-b pb-4">
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-3xl">{stat.value}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 text-sm">
                <p className="text-muted-foreground">{stat.description}</p>
                {stat.href ? (
                  <Button
                    className="mt-4"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={stat.href} />}
                  >
                    Открыть
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>

        {aside ? aside : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => (
          <Card key={link.id} className="rounded-sm">
            <CardHeader className="border-b">
              <CardTitle className="text-lg">{link.title}</CardTitle>
              <CardDescription>{link.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Button nativeButton={false} render={<Link href={link.href} />}>
                {link.cta ?? "Перейти"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
