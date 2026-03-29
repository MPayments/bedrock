"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@bedrock/sdk-ui/components/card";
import { ScrollText } from "lucide-react";
import { DashboardTodo } from "@/components/dashboard/dashboard-todo";
import { DashboardApplications } from "@/components/dashboard/dashboard-applications";
import { DashboardDeals } from "@/components/dashboard/dashboard-deals";
import { DashboardChart } from "@/components/dashboard/dashboard-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardInbox } from "@/components/dashboard/dashboard-inbox";
import { WidthProvider, Responsive, type Layouts } from "react-grid-layout";

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const defaultLayouts = useMemo<Layouts>(
    () => ({
      lg: [
        { i: "todo", x: 0, y: 0, w: 16, h: 20, minW: 4, minH: 6 },
        { i: "chart", x: 16, y: 0, w: 8, h: 20, minW: 3, minH: 6 },
        { i: "inbox", x: 0, y: 20, w: 4, h: 20, minW: 3, minH: 6 },
        { i: "applications", x: 4, y: 20, w: 4, h: 20, minW: 2, minH: 6 },
        { i: "deals", x: 8, y: 20, w: 8, h: 20, minW: 4, minH: 6 },
        { i: "log", x: 16, y: 10, w: 8, h: 20, minW: 3, minH: 6 },
      ],
    }),
    []
  );

  const STORAGE_KEY = "rgl:dashboard-layouts";

  const [layouts, setLayouts] = useState<Layouts>(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Layouts;
          if (parsed && typeof parsed === "object") return parsed;
        }
      }
    } catch {
      // ignore
    }
    return defaultLayouts;
  });

  const handleLayoutChange = useCallback((_: unknown, all: Layouts) => {
    setLayouts(all);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // ignore
    }
  }, []);

  if (!mounted) return null;

  return (
    <ResponsiveGridLayout
      className="layout select-none"
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 24, md: 12, sm: 12, xs: 12, xxs: 12 }}
      rowHeight={8}
      margin={[16, 16]}
      containerPadding={[0, 0]}
      compactType="vertical"
      draggableHandle="[data-slot='card-header']"
      resizeHandles={["se"]}
      onLayoutChange={handleLayoutChange}
    >
      <div key="todo">
        <DashboardTodo className="h-full" />
      </div>
      <div key="inbox">
        <DashboardInbox className="h-full" />
      </div>
      <div key="chart">
        <DashboardChart className="h-full" />
      </div>
      <div key="applications">
        <DashboardApplications className="h-full" />
      </div>
      <div key="deals">
        <DashboardDeals className="h-full" />
      </div>
      <div key="log">
        <Card className="h-full flex flex-col">
          <CardHeader className="shrink-0">
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-muted-foreground" />
              Журнал
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-auto">
            <ActivityFeed />
          </CardContent>
        </Card>
      </div>
    </ResponsiveGridLayout>
  );
}
