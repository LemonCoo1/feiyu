# 登录页服务端地址配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让桌面端登录页支持配置并持久化服务端地址，并让所有 HTTP / WebSocket 连接在运行时读取该地址。

**Architecture:** 在 `apps/desktop/src/services/` 新增一个轻量 `serverConfig` 模块管理 localStorage，再将 `api.ts` 与 `ws.ts` 的 base URL 从编译期环境变量改为运行时读取。UI 仅在登录页 `AuthScreen` 增加一个原生 `<details>` 可折叠区域，保持现有 store 结构不变。

**Tech Stack:** React 18 + TypeScript、Vite、Zustand、原生浏览器 `<details>`、localStorage

---

### Task 1: 新增 serverConfig 模块并验证核心逻辑

**Files:**
- Create: `apps/desktop/src/services/serverConfig.ts`

- [ ] **Step 1: 创建 serverConfig 模块**

```ts
const KEY = "serverUrl";
const DEFAULT_URL = "http://localhost:3000";

export function getServerUrl(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

export function setServerUrl(url: string): void {
  localStorage.setItem(KEY, normalizeServerUrl(url));
}

export function getDefaultServerUrl(): string {
  return DEFAULT_URL;
}

export function validateServerUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return "empty";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "protocol";
    }
    return null;
  } catch {
    return "invalid";
  }
}

export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}
```

- [ ] **Step 2: 手动检查模块边界**

1. 打开 `apps/desktop/src/services/serverConfig.ts`。
2. 确认所有导出函数均存在且 `DEFAULT_URL` 保持 `http://localhost:3000`。
3. 浏览文件顶部 import（后续会被 `api.ts` / `ws.ts` 引用）。

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/services/serverConfig.ts
git commit -m "feat: 新增 serverConfig 模块管理服务端地址"
```

---

### Task 2: 让 HTTP / WebSocket 使用运行时地址

**Files:**
- Modify: `apps/desktop/src/services/api.ts:3,18,39`
- Modify: `apps/desktop/src/services/ws.ts:66`

- [ ] **Step 1: 改造 api.ts 使用 getServerUrl()**

用以下内容替换 `api.ts` 中相关片段：

```ts
// ... existing imports
import { getServerUrl } from "./serverConfig";

// remove `const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";`

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

  const res = await fetch(`${getServerUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }

  return res.json();
}

// uploadFile 里：
xhr.open("POST", `${getServerUrl()}/api/files/upload`);
```

保留 `debugLog` 和其它现有逻辑不变。

- [ ] **Step 2: 改造 ws.ts 使用 getServerUrl()**

```ts
// 顶部新增
import { getServerUrl } from "./serverConfig";

// doConnect() 内替换原有：
const httpBase = getServerUrl();
const wsBase = httpBase.replace(/^http/, "ws");
this.ws = new WebSocket(`${wsBase}/api/ws`);
```

保留心跳、重连、队列等现有逻辑。

- [ ] **Step 3: 代码检查**

1. 检查 `api.ts` 中所有调用 `BASE_URL` 的地方已改为 `getServerUrl()`。
2. 确认 `ws.ts` 中 `getServerUrl()` 仅在 `doConnect` 内部使用，保持函数级副作用。

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/services/api.ts apps/desktop/src/services/ws.ts
git commit -m "refactor: api/ws 改用运行时服务端地址"
```

---

### Task 3: 更新登录页 UI 与 i18n

**Files:**
- Modify: `apps/desktop/src/App.tsx:95-183`
- Modify: `apps/desktop/src/locales/zh.json`
- Modify: `apps/desktop/src/locales/en.json`

- [ ] **Step 1: 在 AuthScreen 增加可折叠服务器设置区**

在 `App.tsx` 的 `AuthScreen` 中：

1. 在 state 区域新增：

```ts
const [serverUrl, setServerUrlState] = useState<string>(getServerUrl());
const [urlError, setUrlError] = useState<string | null>(null);
const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "fail">("idle");
const [testMsg, setTestMsg] = useState<string>("");
```

2. import `getServerUrl`、`setServerUrl`、`validateServerUrl`、`normalizeServerUrl`、`getDefaultServerUrl`。

3. 添加处理函数：

```ts
const handleServerUrlBlur = () => {
  const err = validateServerUrl(serverUrl);
  if (err) {
    setUrlError(err);
    return;
  }
  setUrlError(null);
  setServerUrl(serverUrl);
};

const handleTestConnection = async () => {
  const err = validateServerUrl(serverUrl);
  if (err) {
    setUrlError(err);
    return;
  }
  setUrlError(null);
  setTestState("testing");
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${normalizeServerUrl(serverUrl)}/api/health`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      setTestState("ok");
      setTestMsg("");
    } else {
      setTestState("fail");
      setTestMsg(`${res.status}`);
    }
  } catch (e: any) {
    setTestState("fail");
    setTestMsg(e?.name === "AbortError" ? "timeout" : e?.message || "network");
  }
};
```

4. 在 `</form>` 与“还没有账号”段落之间插入：

```tsx
<details className="text-sm border-t border-feiyu-border pt-3">
  <summary className="cursor-pointer text-feiyu-text-muted hover:text-feiyu-text select-none">
    {t("auth.serverSettings")}
  </summary>
  <div className="mt-2 space-y-2">
    <input
      type="text"
      value={serverUrl}
      onChange={(e) => setServerUrlState(e.target.value)}
      onBlur={handleServerUrlBlur}
      placeholder={getDefaultServerUrl()}
      className="w-full border border-feiyu-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-feiyu-primary"
    />
    {urlError && (
      <p className="text-red-500 text-xs">{t(`auth.urlError.${urlError}`)}</p>
    )}
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleTestConnection}
        disabled={testState === "testing"}
        className="text-xs border border-feiyu-border rounded px-2 py-1 hover:bg-feiyu-bg disabled:opacity-50"
      >
        {testState === "testing" ? t("auth.testing") : t("auth.testConnection")}
      </button>
      {testState === "ok" && (
        <span className="text-green-500 text-xs">✓ {t("auth.connectionOk")}</span>
      )}
      {testState === "fail" && (
        <span className="text-red-500 text-xs">
          ✗ {t("auth.connectionFailed")}
          {testMsg ? `: ${testMsg}` : ""}
        </span>
      )}
    </div>
  </div>
</details>
```

5. 确保组件顶部继续使用 `useAuthStore` 等现有逻辑，不引入额外状态管理。

- [ ] **Step 2: 添加 i18n 文案**

在 `apps/desktop/src/locales/zh.json` 的 `auth` 对象中追加：

```json
"serverSettings": "服务器设置",
"testConnection": "测试连接",
"testing": "测试中...",
"connectionOk": "连接成功",
"connectionFailed": "连接失败",
"urlError": {
  "empty": "地址不能为空",
  "invalid": "地址格式无效",
  "protocol": "必须以 http:// 或 https:// 开头"
}
```

在 `apps/desktop/src/locales/en.json` 的 `auth` 对象中追加：

```json
"serverSettings": "Server Settings",
"testConnection": "Test Connection",
"testing": "Testing...",
"connectionOk": "Connected",
"connectionFailed": "Connection failed",
"urlError": {
  "empty": "URL cannot be empty",
  "invalid": "Invalid URL format",
  "protocol": "Must start with http:// or https://"
}
```

- [ ] **Step 3: UI 检查**

1. `pnpm dev`（或 `cd apps/desktop && pnpm dev`）。
2. 打开登录页，确认“服务器设置”区域默认折叠。
3. 展开后检查 placeholder 为 `http://localhost:3000`。
4. 输入非法地址并 blur，确认提示 `地址格式无效`。
5. 输入可达地址并点击“测试连接”，确认成功状态。
6. 登录后确认请求发往配置的地址（DevTools Network）。

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/App.tsx apps/desktop/src/locales/zh.json apps/desktop/src/locales/en.json
git commit -m "feat: 登录页支持服务端地址配置并本地持久化"
```
