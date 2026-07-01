# 项目结构总览

```
hardware-prototype-platform/
├── 📄 核心文档
│   ├── README.md              # 项目主页（快速开始、使用指南）
│   ├── AGENT.md               # AI Agent 协作指南（详细文档）
│   └── CHANGELOG.md           # 版本更新日志
│
├── 🌐 前端页面
│   ├── index.html             # 主页面（160行）
│   └── styles.css             # 样式表（520行）
│
├── 🔧 核心模块（JavaScript）
│   ├── library.js             # 设备库（552行）- 18种组件定义
│   ├── chipdb.js              # 芯片数据库（409行）- 真实芯片规格
│   ├── architecture.js        # 方案库（193行）- 产品BOM+拓扑
│   ├── engine.js              # 联动引擎（156行）- 信号总线
│   ├── prd.js                 # PRD解析（377行）- 代码生成
│   ├── codegen_enhanced.js    # 增强生成器（430行）- 引脚分配
│   └── app.js                 # 主控制器（832行）- 视口管理
│
├── 📂 配置目录
│   └── .claude/
│       └── launch.json        # 预览服务器配置
│
├── 📚 文档目录
│   └── docs/
│       └── archive/           # 历史文档归档
│           ├── README.md      # 归档说明
│           ├── CHIP_COMPONENTS.md
│           ├── ENHANCEMENT_PLAN.md
│           ├── REFACTOR_PLAN.md
│           └── SUMMARY.md
│
└── 🔄 版本控制
    └── .git/                  # Git 仓库

总代码量：3629 行（纯原生 JS/CSS）
```

## 文件说明

### 核心文档（3个）
- **README.md** — 项目主页，快速开始、功能介绍
- **AGENT.md** — AI 协作指南，项目结构详解、模块说明、开发指南
- **CHANGELOG.md** — 版本更新日志，新增功能、改进优化

### 前端代码（2个）
- **index.html** — 主页面，多视口布局
- **styles.css** — 赛博朋克工业风样式

### JavaScript 模块（7个）
1. **library.js** — 设备库，定义18种组件（外设13+芯片4+APP控件5）
2. **chipdb.js** — 芯片数据库，存储真实芯片规格（AW313A/IP5328等）
3. **architecture.js** — 方案库，内置2个完整产品方案（基础款/旗舰款）
4. **engine.js** — 联动引擎，实现事件驱动信号总线
5. **prd.js** — PRD解析器，Markdown → 设备配置 → 代码
6. **codegen_enhanced.js** — 增强生成器，引脚分配+冲突检测+内存预算
7. **app.js** — 主控制器，视口管理+拖拽+渲染+交互

### 归档文档（4个，已移动到 docs/archive/）
- 历史设计文档，核心内容已合并到 AGENT.md 和 CHANGELOG.md

## 阅读顺序

### 快速了解
1. **README.md** — 5分钟了解项目（核心特性、快速开始）

### 深入学习
2. **AGENT.md** — 30分钟掌握架构（模块详解、数据流、协作指南）
3. **CHANGELOG.md** — 了解版本历史（v1.0.0 新增功能）

### 代码阅读
4. **library.js** → 查看18种组件定义
5. **architecture.js** → 查看真实产品方案
6. **engine.js** → 理解事件驱动机制
7. **app.js** → 理解视口管理和交互

## 文档合并说明

原有 5 份独立文档已合并为 2 份主文档：

**合并前**：
- README.md（原有）
- CHIP_COMPONENTS.md（芯片组件说明）
- ENHANCEMENT_PLAN.md（增强方案）
- REFACTOR_PLAN.md（重构方案）
- SUMMARY.md（总结文档）

**合并后**：
- **AGENT.md** ← 合并了所有技术细节和开发指南
- **CHANGELOG.md** ← 合并了所有功能更新和总结
- **README.md** ← 保留为项目主页

优势：
✅ 避免信息重复
✅ 便于维护更新
✅ 清晰的文档层次
