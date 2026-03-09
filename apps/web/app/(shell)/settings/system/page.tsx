import { BEDROCK_CORE_MODULE_MANIFESTS } from "@bedrock/modules/contracts";
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

const enabledModules = BEDROCK_CORE_MODULE_MANIFESTS.filter(
  (module) => module.enabledByDefault,
);

function getAdditionalInfo(module: (typeof enabledModules)[number]) {
  const info: string[] = [];

  info.push(`тип: ${module.kind}`);
  info.push(`изменяемость: ${module.mutability}`);

  const scopes = [
    module.scopeSupport.global ? "global" : null,
    module.scopeSupport.book ? "book" : null,
  ].filter((scope): scope is string => scope !== null);
  info.push(`контур: ${scopes.join("/")}`);

  const apiCapabilities =
    "api" in module.capabilities ? module.capabilities.api : undefined;
  if (apiCapabilities) {
    const apiVersion = apiCapabilities.version ?? "v1";
    info.push(`api: ${apiVersion} ${apiCapabilities.routePath}`);
  }

  const workers =
    "workers" in module.capabilities
      ? module.capabilities.workers
      : undefined;
  if (workers?.length) {
    info.push(`воркеры: ${workers.length}`);
  }

  if (module.dependencies.length) {
    info.push(
      `зависит от: ${module.dependencies.map((entry) => entry.moduleId).join(", ")}`,
    );
  }

  return info.join(" · ");
}

export default function SettingsSystemPage() {
  return (
    <div className="flex flex-col gap-6">
        <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Включенные модули</CardTitle>
          <CardDescription>
            Версии и техническая информация по модулям runtime-платформы.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Модуль</TableHead>
                <TableHead className="w-28">Версия</TableHead>
                <TableHead className="w-32">Состояние</TableHead>
                <TableHead>Дополнительная информация</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enabledModules.map((module) => (
                <TableRow key={module.id} className="align-top">
                  <TableCell>
                    <div className="font-medium">{module.id}</div>
                    <div className="text-muted-foreground text-xs">
                      {module.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">v{module.version}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge>включен</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {getAdditionalInfo(module)}
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
