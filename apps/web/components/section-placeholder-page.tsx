import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";

type SectionPlaceholderPageProps = {
  title: string;
  description?: string;
};

export function SectionPlaceholderPage({
  title,
  description,
}: SectionPlaceholderPageProps) {
  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="text-muted-foreground py-8 text-sm">
        Раздел находится в разработке.
      </CardContent>
    </Card>
  );
}
