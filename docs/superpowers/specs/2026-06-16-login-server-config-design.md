# 登录页服务端地址配置 — 设计

日期：2026-06-16
状态：待审核

## 目标

让桌面端用户在登录页可以配置服务端地址（HTTP base URL），配置持久化到本地，所有 HTTP API 调用和 WebSocket 连接都使用该地址。

## 范围

包含：
- 登录页 AuthScreen 底部增加可折叠的"服务器设置"区域
- 新增 `serverConfig.ts` 负责 localStorage 读写与 URL 校验
- 改造 `api.ts` 和 `ws.ts` 的 base URL 来源，从编译期常量改为运行时读取
- i18n 键（zh / en）

不包含：
- 已登录后设置页（SettingsView）中的服务地址切换
- 服务发现、mDNS、健康监测守护进程等
- 多个服务端预设/切换 UI

## 涉及文件

| 文件 | 类型 | 内容 |
|------|------|------|
| `apps/desktop/src/services/serverConfig.ts` | 新增 | localStorage 读写、URL 校验、规范化 |
| `apps/desktop/src/services/api.ts` | 修改 | `BASE_URL` 常量改为 `getServerUrl()` 调用 |
| `apps/desktop/src/services/ws.ts` | 修改 | `import.meta.env.VITE_API_BASE_URL` 改为 `getServerUrl()` |
| `apps/desktop/src/App.tsx` | 修改 | AuthScreen 增加可折叠"服务器设置"区 |
| `apps/desktop/src/locales/zh.json` | 修改 | 新增中文文案 |
| `apps/desktop/src/locales/en.json` | 修改 | 新增英文文案 |

## 设计

### 1. `serverConfig.ts`（新模块）

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

/** 校验 URL；合法返回 null，不合法返回错误描述（用于 inline 提示） */
export function validateServerUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return "empty";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "invalid";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "protocol";
  }
  return null;
}

/** 去掉前后空白与尾部所有斜杠 */
export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}
```

**校验规则**：
- 不能为空
- 必须能被 `new URL()` 解析
- 协议必须为 `http:` 或 `https:`

**规范化规则**：
- `trim()`
- 去掉末尾所有 `/`

### 2. `api.ts` 修改

第 3 行：
```ts
// 原：
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
// 新：
import { getServerUrl } from "./serverConfig";
```

第 18 行（`request` 函数）：
```ts
const res = await fetch(`${getServerUrl()}${path}`, { ... });
```

第 39 行（`uploadFile` XHR）：
```ts
xhr.open("POST", `${getServerUrl()}/api/files/upload`);
```

### 3. `ws.ts` 修改

`doConnect()` 中：
```ts
// 原：
const httpBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const wsBase = httpBase.replace(/^http/, "ws");
this.ws = new WebSocket(`${wsBase}/api/ws`);

// 新：
import { getServerUrl } from "./serverConfig";
const httpBase = getServerUrl();
const wsBase = httpBase.replace(/^http/, "ws");
this.ws = new WebSocket(`${wsBase}/api/ws`);
```

WebSocket URL 派生规则不变：`http://` → `ws://`，`https://` → `wss://`，路径为 `/api/ws`。

### 4. `App.tsx` AuthScreen 修改

在 `</form>` 之后、`<p className="text-center mt-4 ...">` 之前，插入可折叠区域（使用浏览器原生 `<details>`，默认折叠）：

```tsx
<details className="text-sm border-t border-feiyu-border pt-3">
  <summary className="cursor-pointer text-feiyu-text-muted hover:text-feiyu-text select-none">
    {t("auth.serverSettings")}
  </summary>
  <div className="mt-2 space-y-2">
    <input
      type="text"
      value={serverUrl}
      onChange={(e) => setServerUrl(e.target.value)}
      onBlur={handleServerUrlBlur}
      placeholder={DEFAULT_SERVER_URL}
      className="w-full border border-feiyu-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-feiyu-primary"
    />
    {urlError && <p className="text-red-500 text-xs">{urlErrorMsg}</p>}
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleTestConnection}
        disabled={testState === "testing"}
        className="text-xs border border-feiyu-border rounded px-2 py-1 hover:bg-feiyu-bg disabled:opacity-50"
      >
        {testState === "testing" ? t("auth.testing") : t("auth.testConnection")}
      </button>
      {testState === "ok" && <span className="text-green-500 text-xs">✓ {t("auth.connectionOk")}</span>}
      {testState === "fail" && <span className="text-red-500 text-xs">✗ {t("auth.connectionFailed")}: {testMsg}</span>}
    </div>
  </div>
</details>
```

**新增 state**：
- `serverUrl: string` — 初始 `getServerUrl() || DEFAULT_SERVER_URL`
- `urlError: string | null` — 校验错误 i18n key（null 表示合法）
- `testState: "idle" | "testing" | "ok" | "fail"`
- `testMsg: string` — 测试失败时的具体原因（状态码 / timeout）

`<details>` 元素由浏览器原生管理展开/折叠，不在 React state 中跟踪。

**保存时机**：`onBlur` 触发 `handleServerUrlBlur`：
- 若 `validateServerUrl` 返回非 null：设 `urlError`，不保存
- 若返回 null：清空 `urlError`，调用 `setServerUrl(serverUrl)` 持久化

`onChange` 仅更新本地 state，不立即写 localStorage，避免输入过程中误保存。

`urlError` 是 i18n key（`"empty" | "invalid" | "protocol"`），显示时通过 `t(\`auth.urlError.${urlError}\`)` 查找。

**测试连接**：
```ts
async function handleTestConnection() {
  const err = validateServerUrl(serverUrl);
  if (err) { setUrlError(err); return; }
  setUrlError(null);
  setTestState("testing");
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${normalizeServerUrl(serverUrl)}/api/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) { setTestState("ok"); setTestMsg(""); }
    else { setTestState("fail"); setTestMsg(`${res.status}`); }
  } catch (e: any) {
    setTestState("fail");
    setTestMsg(e.name === "AbortError" ? "timeout" : (e.message || "network"));
  }
}
```

### 5. i18n 新增键

`zh.json`：
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

`en.json`：
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

## 数据流

1. 应用启动 → AuthScreen mount → `getServerUrl()` 读 localStorage，初始化 `serverUrl` state
2. 用户展开"服务器设置"区域，编辑地址
3. 失去焦点（onBlur） → 校验通过则 `setServerUrl()` 持久化
4. 用户点击"测试连接" → 调 `/api/health` 验证可达性
5. 用户提交登录表单 → `api.login()` → 内部 `getServerUrl()` → 拿到最新地址发请求
6. 登录成功 → `wsClient.connect(token)` → 内部 `getServerUrl()` → 派生 ws 地址建立连接

## 边界情况

- localStorage 中无 `serverUrl` 键 → 降级到 `http://localhost:3000`
- 输入地址含尾斜杠 → 保存时自动去除
- 输入 `ftp://...` 或非 http(s) 协议 → 校验失败，inline 提示
- localStorage 不可用（如隐私模式异常）→ `getServerUrl` 抛错时被调用方 try/catch 降级到默认（实现里包一层 try/catch，返回 DEFAULT_URL）
- 服务不可达 → 测试按钮显示 `connection failed: timeout` 或具体状态码
- 用户在已登录状态下想换地址 → 退出登录后即可在登录页修改（符合范围限制）

## 错误处理

- 格式校验失败：inline 红色文字，不阻止登录
- 测试连接失败：红色文字 + 错误描述
- `api.login()` 因地址错误失败：走原有 `authStore` 错误提示路径（已有）
- WebSocket 连接失败：走原有 `ConnectionBanner`（已有）

## 测试

- 打开登录页 → 展开"服务器设置" → 看到预填的 `http://localhost:3000`
- 输入 `not-a-url` → onBlur 后显示"地址格式无效"，localStorage 不变
- 输入 `http://localhost:9999`（无服务）→ 点击"测试连接" → 显示"连接失败: ..."，5s 内返回
- 输入 `http://localhost:3000`（假设后端在跑）→ 点击"测试连接" → 显示"连接成功"
- 保持 `http://localhost:3000`，输入邮箱密码登录 → DevTools Network 中请求发往 `http://localhost:3000/api/...`
- 改成 `http://192.168.1.10:3000` → 重新登录 → 请求发往新地址
- 关闭应用、重新打开 → 地址保留

## 不影响项

- 已登录用户的 token/user/localStorage 键位不变
- `vite.config.ts` 的开发期 proxy 保留（与运行时 URL 配置互不影响：生产 Tauri 构建不走 proxy；dev 模式下用户若使用 localhost 地址，proxy 仍存在但代码走的是绝对 URL）
- `authStore` / `chatStore` / `settingsStore` 等其他 store 不变
- 服务端代码（Rust）不变
