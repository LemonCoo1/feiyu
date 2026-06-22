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

### Phase 6: 桌面端打包（2026-06-12）
- [x] Task 1: GitHub Actions CI/CD — 推送 tag 时自动构建 macOS (.dmg) 和 Windows (.msi/.exe) 安装包
- [x] Task 2: 本地打包脚本 — scripts/build-desktop.sh 一键构建当前平台安装包

### Phase 7: 群聊群主与个人信息面板（2026-06-13）
- [x] Task 1: 群聊群主管理权限 — 数据库迁移(owner_id/role) + 服务层(添加/移除成员/设管理员) + API + 前端角色标签与权限控制
- [x] Task 2: 个人信息面板 — 点击侧边栏头像弹出悬浮卡片（含状态/邮箱/编辑资料/退出登录）

### Phase 8: 完整设置系统（2026-06-13）
- [x] Task 1: 设置页面框架 — 两栏布局（左侧分类导航 + 右侧内容），替换内联 SettingsView
- [x] Task 2: 后端 user_settings — 数据库迁移 + 模型 + 服务(get/update/change_password) + API
- [x] Task 3: P0 账号资料与外观主题 — 昵称编辑、深色/浅色主题切换（CSS 变量 + 全组件 dark 适配）
- [x] Task 4: P1 通知/隐私/聊天/语言设置 — 通知开关/声音/桌面通知/免打扰、添加好友权限/在线状态/已读回执、发送快捷键(Enter/Ctrl+Enter)、字体大小、语言切换
- [x] Task 5: P2 存储/快捷键/关于/账号安全 — 缓存管理、快捷键一览、关于页面、修改密码/两步验证
- [x] Task 6: 设置功能接通 — useTheme 主题 hook、WebSocket 通知过滤(免打扰/通知开关)、已读回执按设置发送、MessageInput 快捷键适配、消息气泡字体大小

### Phase 9: 国际化 i18n（2026-06-14）
- [x] Task 1: 安装 i18next + react-i18next + i18next-browser-languagedetector
- [x] Task 2: 创建中英文翻译文件 (zh.json / en.json)
- [x] Task 3: 初始化 i18n 配置，与 settingsStore 语言设置同步，实现热切换
- [x] Task 4: 替换所有组件中的硬编码中文文案为 t() 调用
- [x] Task 5: 日期时间格式化跟随语言设置，EmojiPicker 动态切换语言
- [x] Task 6: 通知文案国际化

### Phase 10: 断线重连与存储管理（2026-06-15）
- [x] Task 1: WsClient 增强 — 指数退避重连、心跳检测、连接状态事件、发送队列
- [x] Task 2: 数据库新增缓存表 — cached_conversations、cached_contacts、cached_channels
- [x] Task 3: ConnectionBanner 顶部横幅组件 — 红/橙/绿三态显示，集成连接状态监听
- [x] Task 4: 断连时禁用消息输入框，显示等待连接提示
- [x] Task 5: cacheService 扩展 — 会话/联系人/频道缓存读写函数
- [x] Task 6: cacheService 详细统计与分类清理 — DetailedCacheStats、5 类独立清理、自动清理策略
- [x] Task 7: chatStore 会话列表本地优先加载 + 实时同步缓存
- [x] Task 8: contactStore 联系人本地优先加载
- [x] Task 9: channelStore 频道列表本地优先加载
- [x] Task 10: settingsStore 扩展分类缓存统计和清理 action
- [x] Task 11: 设置页存储管理改为分组展示，支持分类清理
- [x] Task 12: App 启动时自动清理过期缓存 + i18n 翻译

### Phase 11: 登录页服务端地址配置（2026-06-16）
- [x] Task 1: 新增 serverConfig 模块 — localStorage 读写、URL 校验与规范化
- [x] Task 2: api/ws 改用运行时服务端地址 — 移除编译期常量，改为 getServerUrl()
- [x] Task 3: 登录页 UI — 可折叠"服务器设置"区域 + 校验 + 测试连接 + 中英文 i18n
- [x] Task 4: 修复 — AbortController 竞态、类型安全、testState 重置、提交前持久化

### Phase 12: 消息增强功能（2026-06-22）
- [x] Task 1: 表情回应 (Reactions) — 数据库迁移、模型、服务、API、WS 协议、客户端回应显示与 emoji 选择器
- [x] Task 2: 消息转发 — 右键菜单转发到其他会话、ForwardModal 会话选择器
- [x] Task 3: 文件拖拽发送 — ChatWindow 拖拽 overlay、sendFile 复用
- [x] Task 4: 群公告 — 数据库迁移、模型、服务、API、GroupInfoPanel 公告区域
- [x] Task 5: 用户头像上传 — 服务端 MinIO 上传 API、设置页点击头像上传
- [x] Task 6: 消息撤回 — 数据库 recalled 字段、WS 协议、2 分钟限制、客户端撤回菜单与已撤回显示
