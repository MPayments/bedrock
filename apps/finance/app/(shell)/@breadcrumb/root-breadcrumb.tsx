import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";

export function RootBreadcrumb() {
  return (
    <DynamicBreadcrumb
      items={[
        {
          label: "Дашборд",
          icon: "home",
        },
      ]}
    />
  );
}
