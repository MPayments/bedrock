import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";

export default function CreateCounterpartyGroupBreadcrumbPage() {
  return (
    <DynamicBreadcrumb
      items={[
        {
          label: "Справочники",
          icon: "book-open",
        },
        {
          label: "Контрагенты",
          href: "/entities/counterparties",
          icon: "building-2",
        },
        {
          label: "Новая группа",
          href: "/entities/counterparties/groups/create",
        },
      ]}
    />
  );
}
