"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Phone,
  MapPin,
  FileText,
  Loader2,
} from "lucide-react";
import Link from "next/link";
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
  createdAt: string | null;
}

interface CustomerClientsResponse {
  data: Client[];
  total: number;
}

export default function CustomerClientsPage() {
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
          // If unauthorized or error, redirect to onboard
          router.push("/customer/onboard");
          return;
        }

        const data: CustomerClientsResponse = await response.json();

        if (data.total === 0) {
          router.push("/customer/onboard");
          return;
        }

        setClients(data.data);
      } catch (error) {
        console.error("Error fetching clients:", error);
        router.push("/customer/onboard");
      } finally {
        setLoading(false);
      }
    }

    fetchClients();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              Мои организации
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
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
          <Link href="/customer/onboard">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Добавить</span>
          </Link>
        </Button>
      </div>

      {/* Clients list */}
      <div className="space-y-3">
        {clients.map((client) => (
          <Card
            key={client.id}
            className="hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-5 w-5 text-primary shrink-0" />
                  <CardTitle className="text-base truncate">
                    {client.orgName}
                  </CardTitle>
                </div>
                {client.inn && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    ИНН: {client.inn}
                  </span>
                )}
              </div>
              {client.directorName && (
                <CardDescription className="text-sm mt-1">
                  {client.directorName}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {client.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{client.address}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info card */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />В разработке
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Редактирование данных организации
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Просмотр заявок по организации
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Документы организации
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
