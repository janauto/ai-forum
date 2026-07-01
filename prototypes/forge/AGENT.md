# AGENT.md · 砺 / Forge AI 研发工作空间

Claude Code 与本项目协作的上下文指南。

---

## 项目概要

这是一个**面向研发团队的 AI 工作助手**原型，代号「砺 / Forge」。
- **形态**：单文件 HTML 原型 + Node.js 本地后端
- **岗位**：嵌入式软件工程师、产品经理（可扩展）
- **核心红线**：AI 是见证者不是裁判——AI 只陈述事实，最终判断由人做

---

## 关键文件

| 文件 | 说明 |
|------|------|
| `AI研发工作空间_员工端_原型_v1.html` | 前端原型主文件（约 80KB，单文件，含所有 JS/CSS）|
| `server.js` | 本地后端：① 伺服 HTML；② 代理 `/api/chat` 到 MiMo（流式 SSE）|
| `.env` | 运行时配置（含 API Key，不提交，见 `.env.example`）|
| `2026_06_AI研发提效产品理念思维册子.md` | 16 条设计信条，所有功能的北极星 |
| `2026_06_AI研发工作空间_员工端_原型需求文档_v1.md` | 员工端主 PRD（含 AI 会议 5 步流程）|

---

## 本地运行

```bash
# 确保 .env 已配置 MIMO_API_KEY
node server.js
# 然后浏览器打开 http://localhost:8787
```

**不要**直接用 `file://` 打开 HTML，AI 对话需要后端代理。

---

## 前端原型结构（HTML 文件内）

```
DATA = { embedded: {...}, pm: {...} }   // 两种角色的种子数据
  └─ projects[]                          // 项目列表
  └─ detail[projectId]                   // 每个项目的详情
       ├─ goal / stage / blocker         // 上下文（注入系统提示）
       ├─ todos / decisions / outputs    // 项目记忆
       ├─ chat[]                         // 静态演示对话脚本
       └─ dialogue[]                     // AI 会议对话脚本

全局状态：
  role    // 'embedded' | 'pm'，角色切换
  cur     // 当前项目 ID
  CONVO[] // 实时对话历史（每次切换项目会重置）
```

### 核心函数

| 函数 | 说明 |
|------|------|
| `applyRole()` | 切换角色，重新渲染所有面板 |
| `renderCenter()` | 渲染中央工作台（项目详情、对话框）|
| `sysPrompt()` | 生成注入项目上下文的系统提示 |
| `callMiMo(messages, onToken)` | 流式调用后端 `/api/chat`，逐 token 回调 |
| `sendChat()` | 发送对话，流式更新气泡，写入 `CONVO` |
| `mdLite(s)` | 轻量 Markdown 渲染（先 XSS 转义，再处理粗体/列表）|
| `ic(name, size)` | 渲染 SVG 图标（图标路径存于常量 `P`）|

---

## 后端代理逻辑（server.js）

- `POST /api/chat`：接收 `{ messages }` → 转发到 MiMo SSE 流 → 剥离 `reasoning_content`，只透传 `content` → 以 `data: {"t": "token"}` 格式发回浏览器
- `GET /*`：返回 HTML 原型文件
- MiMo 是 reasoning 模型，会先输出内部思考（`reasoning_content`），服务端已过滤，浏览器只收到正式回答

---

## AI 功能设计红线（每次修改 AI 相关功能必读）

1. **AI 输出须标注「事实·无判断」** —— 不能让 AI 直接给出"应该做 A"的定论
2. **每条建议须有「由[负责人]确认」确认栏** —— UI 上体现人工确认门
3. **AI 会议拆解结果标注「初判·待 FDE 审理」** —— 经 FDE 工程师审理后才能分发
4. **搜索结果分三区呈现**：已验证 / 预研中 / 技术空白 —— 不混淆置信度

完整信条见 `2026_06_AI研发提效产品理念思维册子.md`

---

## 开发注意事项

- **原型是单文件**：所有 CSS、JS、数据都在 `AI研发工作空间_员工端_原型_v1.html` 内。修改时注意行数，文件约 80KB/2500 行，Read 前建议先 grep 定位。
- **无构建工具**：直接改 HTML，刷新即生效（需通过 localhost 访问）。
- **图标系统**：新增图标需在 `P` 对象里加 SVG path，再用 `ic('name', size)` 调用。
- **角色数据隔离**：`DATA.embedded` 和 `DATA.pm` 是独立数据集，切换角色时重新渲染，`cur` 和 `CONVO` 同步重置。
- **AI 会议**目前步骤 1（对话）使用静态脚本数据（`detail.dialogue`），尚未接入真实 MiMo。
