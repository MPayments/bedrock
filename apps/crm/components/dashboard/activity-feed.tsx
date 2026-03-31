"use client";

import { useEffect, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";

import { getCrmActivity } from "@/lib/activity/client";
import type { CrmActivityItem } from "@/lib/activity/contracts";

function formatActivityDate(dateString: string): string {
  const date = new Date(dateString);
  const time = format(date, "HH:mm");

  if (isToday(date)) {
    return `Сегодня в ${time}`;
  }

  if (isYesterday(date)) {
    return `Вчера в ${time}`;
  }

  return `${format(date, "dd.MM.yyyy", { locale: ru })} в ${time}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const actionEntityTexts: Record<string, Record<string, string>> = {
  agreement: {
    comment: "добавил комментарий к соглашению",
    create: "создал соглашение",
    delete: "удалил соглашение",
    status_change: "изменил статус соглашения",
    update: "изменил соглашение",
    upload_document: "загрузил документ для соглашения",
  },
  calculation: {
    comment: "добавил комментарий к расчёту",
    create: "создал расчёт",
    delete: "удалил расчёт",
    status_change: "изменил статус расчёта",
    update: "изменил расчёт",
    upload_document: "загрузил документ для расчёта",
  },
  customer: {
    comment: "добавил комментарий к клиенту",
    create: "создал клиента",
    delete: "удалил клиента",
    status_change: "изменил статус клиента",
    update: "изменил клиента",
    upload_document: "загрузил документ для клиента",
  },
  deal: {
    comment: "добавил комментарий к сделке",
    create: "создал сделку",
    delete: "удалил сделку",
    status_change: "изменил статус сделки",
    update: "изменил сделку",
    upload_document: "загрузил документ для сделки",
  },
  document: {
    comment: "добавил комментарий к документу",
    create: "создал документ",
    delete: "удалил документ",
    status_change: "изменил статус документа",
    update: "изменил документ",
    upload_document: "загрузил документ для документа",
  },
  task: {
    comment: "добавил комментарий к задаче",
    create: "создал задачу",
    delete: "удалил задачу",
    status_change: "изменил статус задачи",
    update: "изменил задачу",
    upload_document: "загрузил документ для задачи",
  },
};

const fallbackActionTexts: Record<string, string> = {
  comment: "добавил комментарий к",
  create: "создал",
  delete: "удалил",
  status_change: "изменил статус",
  update: "изменил",
  upload_document: "загрузил документ для",
};

const entityNamesNominative: Record<string, string> = {
  agreement: "соглашение",
  calculation: "расчёт",
  customer: "клиент",
  deal: "сделка",
  document: "документ",
  task: "задача",
};

const statusLabels: Record<string, Record<string, string>> = {
  deal: {
    awaiting_funds: "Ожидание средств",
    awaiting_payment: "Ожидание оплаты",
    cancelled: "Отменена",
    closing_documents: "Закрывающие документы",
    done: "Завершена",
    draft: "Черновик",
    preparing_documents: "Подготовка документов",
    rejected: "Отклонена",
    submitted: "Отправлена",
  },
};

function getStatusLabel(entityType: string, status: string): string {
  return statusLabels[entityType]?.[status] || status;
}

function getActionText(activity: CrmActivityItem) {
  const title =
    activity.entityTitle || (activity.entityId ? `#${activity.entityId}` : "");

  const actionText =
    actionEntityTexts[activity.entityType]?.[activity.action] ||
    `${fallbackActionTexts[activity.action] || activity.action} ${
      entityNamesNominative[activity.entityType] || activity.entityType
    }`;

  if (activity.action === "status_change" && activity.metadata?.newStatus) {
    const nextStatus = getStatusLabel(
      activity.entityType,
      String(activity.metadata.newStatus),
    );

    return (
      <>
        {actionText} <span className="font-mono">{title}</span>
        <span className="text-muted-foreground"> → {nextStatus}</span>
      </>
    );
  }

  return (
    <>
      {actionText} <span className="font-mono">{title}</span>
    </>
  );
}

export function ActivityFeed({ className }: { className?: string }) {
  const [activities, setActivities] = useState<CrmActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchActivities() {
      try {
        const response = await getCrmActivity(10);
        if (!isMounted) {
          return;
        }
        setActivities(response.data);
        setUnavailable(response.unavailable);
      } catch (error) {
        console.error("Failed to fetch CRM activity:", error);
        if (!isMounted) {
          return;
        }
        setActivities([]);
        setUnavailable(true);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchActivities();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="text-muted-foreground text-sm animate-pulse">
        Загрузка...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-muted-foreground text-sm">
        {unavailable ? "Журнал временно недоступен" : "Нет записей в журнале"}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 text-sm ${className ?? ""}`}>
      {activities.map((activity, index) => (
        <div
          key={activity.id}
          className={`flex items-start gap-3 ${
            index < activities.length - 1 ? "border-b pb-3" : ""
          }`}
        >
          <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
            {activity.userName ? getInitials(activity.userName) : "??"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate">
              <span className="font-medium">
                {activity.userName ?? "Система"}
              </span>{" "}
              {getActionText(activity)}
            </div>
            <div className="text-muted-foreground text-xs flex items-center gap-2">
              {formatActivityDate(activity.createdAt)}
              {activity.source === "bot" && (
                <span className="text-blue-500">• бот</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
