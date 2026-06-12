# 飞鱼 (Feiyu) 任务进度

本文档记录项目的开发进度，每次完成任务后需同步更新。

## 进行中

暂无进行中的任务。

## 已完成

### Phase 1: 基础框架（2026-06-12）
- [x] Task 1: 初始化 Monorepo 与 Git
- [x] Task 2: Docker 基础设施（PostgreSQL、Redis、MinIO）
- [x] Task 3: 后端 Axum 服务骨架
- [x] Task 4: 用户模型与认证服务（注册/登录）
- [x] Task 5: Tauri 桌面应用骨架
- [x] Task 6: 共享类型包
- [x] Task 7: 整体验证与最终提交

### Phase 2: 核心 IM（2026-06-12）
- [x] Task 1: 协议与模型定义 — conversation/message 模型、WebSocket 协议
- [x] Task 2: WebSocket Hub — 连接管理、消息路由、认证
- [x] Task 3: 会话与消息服务 + REST API — CRUD API、JWT 认证中间件
- [x] Task 4: 前端状态管理与 API 服务 — authStore、chatStore、WS 客户端
- [x] Task 5: 聊天 UI 组件 — 三栏布局、会话列表、消息气泡、输入框
- [x] Task 6: 端到端集成测试 — 注册/创建会话/WS 发送消息/消息持久化验证通过

### Phase 3: 用户体系（2026-06-12）
- [x] Task 1: 后端 — 用户 API 扩展 — 搜索、资料编辑、状态更新
- [x] Task 2: 后端 — 联系人 API — 添加、列表、删除、在线状态广播
- [x] Task 3: 前端 — 通讯录页面 — contactStore、ContactList、AddContact
- [x] Task 4: 前端 — 在线状态集成 — WS presence 广播
- [x] Task 5: 端到端验证 — 搜索/添加联系人/更新资料/重复添加验证通过

### Phase 4: 频道功能（2026-06-12）
- [x] Task 1: 后端 — 频道模型与服务 — Channel/ChannelMessage 模型、CRUD
- [x] Task 2: 后端 — 频道 REST API 与 WebSocket — 创建/加入/消息/WS 频道消息广播
- [x] Task 3: 前端 — 频道 Store 与 API — channelStore、频道 API
- [x] Task 4: 前端 — 频道 UI 组件 — ChannelList、ChannelView
- [x] Task 5: 端到端验证 — 创建频道/加入/WS 发送/消息持久化验证通过

### Phase 5: 完善与优化（2026-06-12）
- [x] Task 1: 群聊功能 — create_group 服务 + API + 前端创建群聊 UI
- [x] Task 2: 文件/图片消息 — 文件上传服务 + API + 前端上传与渲染
- [x] Task 3: 消息搜索 — PostgreSQL ILIKE 搜索 + API + 前端搜索栏
- [x] Task 4: 通知提醒 — Tauri notification 插件 + 浏览器通知
- [x] Task 5: UI 打磨 — 飞书风格主题、时间分隔线、自动高度输入框、滚动按钮、骨架屏
- [x] Task 6: 最终集成与验收 — 全量编译通过
