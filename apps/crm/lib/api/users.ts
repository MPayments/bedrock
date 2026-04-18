import { API_BASE_URL } from "@/lib/constants";

type AssignableUser = {
  email: string;
  id: string;
  isAdmin: boolean;
  name: string;
};

type UsersListResponse = {
  data?: Array<{
    email: string;
    id: string;
    name: string;
    role: string;
  }>;
};

export async function listAssignableUsers(): Promise<AssignableUser[]> {
  const searchParams = new URLSearchParams({
    banned: "false",
    limit: "200",
    offset: "0",
    sortBy: "name",
    sortOrder: "asc",
  });

  searchParams.append("role", "admin");
  searchParams.append("role", "agent");
  searchParams.append("role", "user");

  const response = await fetch(`${API_BASE_URL}/users?${searchParams.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Ошибка загрузки: ${response.status}`);
  }

  const payload = (await response.json()) as UsersListResponse;

  return (payload.data ?? []).map((user) => ({
    email: user.email,
    id: user.id,
    isAdmin: user.role === "admin",
    name: user.name,
  }));
}
