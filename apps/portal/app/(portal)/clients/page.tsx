"use client";

import { Building2, FileText, Loader2, MapPin, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { API_BASE_URL } from "@/lib/constants";

interface Client {
  id: number;
  orgName: string;
  inn: string | null;
  directorName: string | null;
  phone: string | null;
  address: string | null;
}

interface CustomerClientsResponse {
  data: Client[];
  total: number;
}

export default function PortalClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClients() {
      try {
        const response = await fetch(`${API_BASE_URL}/customer/clients`, {
          credentials: "include",
        });

        if (!response.ok) {
          router.push("/onboard");
          return;
        }

        const data: CustomerClientsResponse = await response.json();

        if (data.total === 0) {
          router.push("/onboard");
          return;
        }

        setClients(data.data);
      } catch (error) {
        console.error("Error fetching clients:", error);
        router.push("/onboard");
      } finally {
        setLoading(false);
      }
    }

    void fetchClients();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Мои организации</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {clients.length}{" "}
              {clients.length === 1
                ? "организация"
                : clients.length < 5
                  ? "организации"
                  : "организаций"}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href="/onboard">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Добавить</span>
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {clients.map((client) => (
          <Card key={client.id} className="transition-colors hover:bg-muted/50">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-5 w-5 shrink-0 text-primary" />
                  <CardTitle className="truncate text-base">{client.orgName}</CardTitle>
                </div>
                {client.inn ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    ИНН: {client.inn}
                  </span>
                ) : null}
              </div>
              {client.directorName ? (
                <CardDescription className="mt-1 text-sm">
                  {client.directorName}
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {client.phone ? (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{client.phone}</span>
                  </div>
                ) : null}
                {client.address ? (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{client.address}</span>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            В разработке
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Редактирование данных организации</li>
            <li>Просмотр заявок по организации</li>
            <li>Документы организации</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
