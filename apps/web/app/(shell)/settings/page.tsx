import { BookOpen } from "lucide-react";

import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";

export default function SettingsPage() {
  return (
    <SectionOverviewPage
      icon={BookOpen}
      title="Настройки"
      description="Общий раздел системных и пользовательских настроек веб-приложения."
      stats={[
        {
          id: "sections",
          label: "Разделы",
          value: "1",
          description: "Доступен раздел профиля.",
        },
        {
          id: "scope",
          label: "Контур",
          value: "Web",
          description: "Настройки применяются к текущему веб-интерфейсу.",
        },
      ]}
      links={[
        {
          id: "profile",
          title: "Профиль",
          description: "Личные параметры и настройки пользователя.",
          href: "/settings/profile",
        },
      ]}
    />
  );
}
