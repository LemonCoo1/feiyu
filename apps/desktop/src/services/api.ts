import { debugLog } from "../utils/debugLog";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

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

async function uploadFile(file: File): Promise<{ url: string; filename: string }> {
  const token = localStorage.getItem("token");

  debugLog(`[API] uploadFile 请求: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)}KB)`);

  // 使用 XHR 代替 fetch — WebKit 的 fetch 对大文件 FormData 上传会抛出 TypeError: Load failed
  const result = await new Promise<{ url: string; filename: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/api/files/upload`);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.onload = () => {
      debugLog(`[API] uploadFile 响应: status=${xhr.status}`);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          debugLog(`[API] uploadFile 成功: url=${data.url}`);
          resolve(data);
        } catch (e) {
          debugLog(`[API] uploadFile 解析响应失败: ${xhr.responseText}`, "error");
          reject(new Error("Failed to parse upload response"));
        }
      } else {
        debugLog(`[API] uploadFile 失败: ${xhr.status} ${xhr.responseText}`, "error");
        reject(new Error(`${xhr.status}: ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => {
      debugLog(`[API] uploadFile 网络错误 (文件: ${file.name}, 大小: ${(file.size / 1024).toFixed(1)}KB)`, "error");
      reject(new Error("Network error during file upload"));
    };

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = ((e.loaded / e.total) * 100).toFixed(0);
        debugLog(`[API] uploadFile 进度: ${pct}% (${(e.loaded / 1024).toFixed(0)}KB / ${(e.total / 1024).toFixed(0)}KB)`);
      }
    };

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });

  return result;
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

  getMessages: (conversationId: string, limit = 50, before?: string, since?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set("before", before);
    if (since) params.set("since", since);
    return request<any[]>(`/api/conversations/${conversationId}/messages?${params}`);
  },

  createDirectConversation: (user1Id: string, user2Id: string) =>
    request<any>("/api/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ user1_id: user1Id, user2_id: user2Id }),
    }),

  createGroupConversation: (name: string, memberIds: string[]) =>
    request<any>("/api/conversations/group", {
      method: "POST",
      body: JSON.stringify({ name, member_ids: memberIds }),
    }),

  getContacts: () =>
    request<any[]>("/api/contacts"),

  addContact: (contactId: string) =>
    request<void>("/api/contacts", {
      method: "POST",
      body: JSON.stringify({ contact_id: contactId }),
    }),

  removeContact: (contactId: string) =>
    request<void>("/api/contacts", {
      method: "DELETE",
      body: JSON.stringify({ contact_id: contactId }),
    }),

  searchUsers: (query: string) =>
    request<any[]>(`/api/users/search?q=${encodeURIComponent(query)}`),

  getUser: (userId: string) =>
    request<any>(`/api/users/${userId}`),

  updateProfile: (data: { display_name?: string; avatar_url?: string }) =>
    request<any>("/api/users/profile", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getChannels: () =>
    request<any[]>("/api/channels"),

  createChannel: (name: string, description?: string) =>
    request<any>("/api/channels", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),

  joinChannel: (channelId: string) =>
    request<void>(`/api/channels/${channelId}/join`, {
      method: "POST",
    }),

  getChannelMessages: (channelId: string, limit = 50, before?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set("before", before);
    return request<any[]>(`/api/channels/${channelId}/messages?${params}`);
  },

  uploadFile,

  searchMessages: (query: string, limit = 20) =>
    request<any[]>(`/api/messages/search?q=${encodeURIComponent(query)}&limit=${limit}`),

  getConversationMembers: (conversationId: string) =>
    request<any[]>(`/api/conversations/${conversationId}/members`),

  updateConversation: (conversationId: string, data: { name?: string }) =>
    request<any>(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  addConversationMember: (conversationId: string, userId: string) =>
    request<void>(`/api/conversations/${conversationId}/members`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),

  removeConversationMember: (conversationId: string, userId: string) =>
    request<void>(`/api/conversations/${conversationId}/members/${userId}`, {
      method: "DELETE",
    }),

  assignAdmin: (conversationId: string, userId: string) =>
    request<void>(`/api/conversations/${conversationId}/members/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ user_id: userId }),
    }),

  getSettings: () =>
    request<any>("/api/users/settings"),

  updateSettings: (data: Record<string, any>) =>
    request<any>("/api/users/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  changePassword: (oldPassword: string, newPassword: string) =>
    request<void>("/api/users/change-password", {
      method: "POST",
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    }),
};
