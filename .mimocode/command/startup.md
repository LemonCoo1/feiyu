---
description: 启动飞鱼完整开发环境（Docker 基础设施 + Rust 后端 + Tauri 桌面端）
---

启动飞鱼项目的完整本地开发环境，按顺序执行以下步骤：

1. **启动 Docker 基础设施**（PostgreSQL、Redis、MinIO）：
   ```bash
   docker compose up -d
   ```
   等待容器就绪后用 `docker compose ps` 确认状态。

2. **启动 Rust 后端服务**（后台运行）：
   ```bash
   cargo run -p feiyu-server 2>&1 &
   sleep 4
   curl -s http://localhost:3000/api/health
   ```
   确认返回 `OK` 后继续。

3. **启动 Tauri 桌面端**（后台运行）：
   ```bash
   cd apps/desktop && pnpm tauri dev 2>&1 &
   ```

如果需要重启后端（例如修改了 CORS 或环境变量），先 `pkill -f "feiyu-server"` 再重新启动。
