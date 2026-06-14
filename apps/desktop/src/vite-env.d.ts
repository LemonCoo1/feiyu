/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端服务地址，如 http://localhost:3000 */
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
