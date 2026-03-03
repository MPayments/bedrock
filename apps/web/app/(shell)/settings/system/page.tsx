import { BEDROCK_CORE_COMPONENT_MANIFESTS } from "@bedrock/core/component-runtime";
import { Badge } from "@bedrock/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

const enabledComponents = BEDROCK_CORE_COMPONENT_MANIFESTS.filter(
  (component) => component.enabledByDefault,
);

function getAdditionalInfo(component: (typeof enabledComponents)[number]) {
  const info: string[] = [];

  info.push(`kind: ${component.kind}`);
  info.push(`mutability: ${component.mutability}`);

  const scopes = [
    component.scopeSupport.global ? "global" : null,
    component.scopeSupport.book ? "book" : null,
  ].filter((scope): scope is string => scope !== null);
  info.push(`scope: ${scopes.join("/")}`);

  const apiCapabilities =
    "api" in component.capabilities ? component.capabilities.api : undefined;
  if (apiCapabilities) {
    const apiVersion = apiCapabilities.version ?? "v1";
    info.push(`api: ${apiVersion} ${apiCapabilities.routePath}`);
  }

  const workers =
    "workers" in component.capabilities
      ? component.capabilities.workers
      : undefined;
  if (workers?.length) {
    info.push(`workers: ${workers.length}`);
  }

  if (component.dependencies.length) {
    info.push(
      `depends on: ${component.dependencies.map((entry) => entry.componentId).join(", ")}`,
    );
  }

  return info.join(" · ");
}

export default function SettingsSystemPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Включенные компоненты</CardTitle>
          <CardDescription>
            Версии и техническая информация по компонентам platform runtime.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Компонент</TableHead>
                <TableHead className="w-28">Версия</TableHead>
                <TableHead className="w-32">Состояние</TableHead>
                <TableHead>Дополнительная информация</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enabledComponents.map((component) => (
                <TableRow key={component.id} className="align-top">
                  <TableCell>
                    <div className="font-medium">{component.id}</div>
                    <div className="text-muted-foreground text-xs">
                      {component.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">v{component.version}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge>enabled</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {getAdditionalInfo(component)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
