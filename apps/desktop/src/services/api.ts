const BASE_URL = "http://localhost:3000";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }

  return res.json();
}

export const api = {
  register: (data: {
    username: string;
    email: string;
    password: string;
    display_name?: string;
  }) => request<{ token: string; user: any }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  }),

  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getConversations: () =>
    request<any[]>(`/api/conversations`),

  getMessages: (conversationId: string, limit = 50, before?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set("before", before);
    return request<any[]>(`/api/conversations/${conversationId}/messages?${params}`);
  },

  createDirectConversation: (user1Id: string, user2Id: string) =>
    request<any>("/api/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ user1_id: user1Id, user2_id: user2Id }),
    }),
};
