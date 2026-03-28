"use client";

import { useEffect, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import { API_BASE_URL } from "@/lib/constants";

function formatActivityDate(dateStr: string): string {
  const date = new Date(dateStr);
  const time = format(date, "HH:mm");

  if (isToday(date)) {
    return `Сегодня в ${time}`;
  }

  if (isYesterday(date)) {
    return `Вчера в ${time}`;
  }

  return format(date, "dd.MM.yyyy", { locale: ru }) + ` в ${time}`;
}

interface Activity {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  entityTitle: string | null;
  source: string;
  metadata: Record<string, any> | null;
  createdAt: string;
  user: { id: number; name: string } | null;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Тексты действий с падежами для разных сущностей
// Формат: { [entityType]: { [action]: "текст действия" } }
const actionEntityTexts: Record<string, Record<string, string>> = {
  application: {
    create: "создал заявку",
    update: "изменил заявку",
    delete: "удалил заявку",
    status_change: "изменил статус заявки",
    comment: "добавил комментарий к заявке",
    upload_document: "загрузил документ для заявки",
  },
  deal: {
    create: "создал сделку",
    update: "изменил сделку",
    delete: "удалил сделку",
    status_change: "изменил статус сделки",
    comment: "добавил комментарий к сделке",
    upload_document: "загрузил документ для сделки",
  },
  client: {
    create: "создал клиента",
    update: "изменил клиента",
    delete: "удалил клиента",
    status_change: "изменил статус клиента",
    comment: "добавил комментарий к клиенту",
    upload_document: "загрузил документ для клиента",
  },
  calculation: {
    create: "создал расчёт",
    update: "изменил расчёт",
    delete: "удалил расчёт",
    status_change: "изменил статус расчёта",
    comment: "добавил комментарий к расчёту",
    upload_document: "загрузил документ для расчёта",
  },
  contract: {
    create: "создал контракт",
    update: "изменил контракт",
    delete: "удалил контракт",
    status_change: "изменил статус контракта",
    comment: "добавил комментарий к контракту",
    upload_document: "загрузил документ для контракта",
  },
  todo: {
    create: "создал задачу",
    update: "изменил задачу",
    delete: "удалил задачу",
    status_change: "изменил статус задачи",
    comment: "добавил комментарий к задаче",
    upload_document: "загрузил документ для задачи",
  },
  document: {
    create: "создал документ",
    update: "изменил документ",
    delete: "удалил документ",
    status_change: "изменил статус документа",
    comment: "добавил комментарий к документу",
    upload_document: "загрузил документ для документа",
  },
};

// Fallback тексты действий
const fallbackActionTexts: Record<string, string> = {
  create: "создал",
  update: "изменил",
  delete: "удалил",
  status_change: "изменил статус",
  comment: "добавил комментарий к",
  upload_document: "загрузил документ для",
};

// Названия сущностей в именительном падеже (для fallback)
const entityNamesNominative: Record<string, string> = {
  application: "заявка",
  deal: "сделка",
  client: "клиент",
  calculation: "расчёт",
  contract: "контракт",
  todo: "задача",
  document: "документ",
};

// Названия статусов на русском
const statusLabels: Record<string, Record<string, string>> = {
  application: {
    forming: "Формируется",
    created: "Создана",
    rejected: "Отклонена",
    finished: "Завершена",
  },
  deal: {
    preparing_documents: "Подготовка документов",
    awaiting_funds: "Ожидание средств",
    awaiting_payment: "Ожидание оплаты",
    closing_documents: "Закрывающие документы",
    done: "Завершена",
    cancelled: "Отменена",
  },
};

function getStatusLabel(entityType: string, status: string): string {
  return statusLabels[entityType]?.[status] || status;
}

function getActionText(activity: Activity) {
  const entityType = activity.entityType;
  const action = activity.action;
  const title = activity.entityTitle || `#${activity.entityId}`;

  // Получаем текст действия с правильным падежом
  const actionText =
    actionEntityTexts[entityType]?.[action] ||
    `${fallbackActionTexts[action] || action} ${
      entityNamesNominative[entityType] || entityType
    }`;

  // Для изменения статуса показываем новый статус
  if (action === "status_change" && activity.metadata?.newStatus) {
    const newStatusLabel = getStatusLabel(
      entityType,
      activity.metadata.newStatus
    );
    return (
      <>
        {actionText} <span className="font-mono">{title}</span>
        <span className="text-muted-foreground"> → {newStatusLabel}</span>
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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch(`${API_BASE_URL}/activity-log?limit=10`, {
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          setActivities(json.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch activities:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchActivities();
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
      <div className="text-muted-foreground text-sm">Нет записей в журнале</div>
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
            {activity.user ? getInitials(activity.user.name) : "??"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate">
              <span className="font-medium">{activity.user?.name}</span>{" "}
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
