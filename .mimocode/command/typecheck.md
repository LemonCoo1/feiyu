---
description: 对飞鱼项目执行全量类型检查（Rust 后端 + TypeScript 前端）
---

对飞鱼项目执行前后端全量类型检查，验证代码变更无编译错误：

1. **Rust 后端编译检查**：
   ```bash
   cargo check -p feiyu-server 2>&1
   ```

2. **TypeScript 前端类型检查**：
   ```bash
   pnpm --filter @feiyu/desktop exec tsc --noEmit 2>&1
   ```

3. **（可选）Tauri 壳编译检查**：
   ```bash
   cargo check -p feiyu-desktop 2>&1
   ```

4. **（可选）共享类型检查**：
   ```bash
   pnpm --filter @feiyu/shared exec tsc --noEmit 2>&1
   ```

如果只改了后端，执行步骤 1 即可。如果只改了前端，执行步骤 2。全量验证时两步都跑。
