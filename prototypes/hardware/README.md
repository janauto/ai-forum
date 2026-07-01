# PROTO//SIM — 硬件原型联动验证平台

> **从 PRD 到真实固件代码的交互式可视化原型工具**  
> 拖拽硬件元件 → 可交互仿真 → 自动生成状态机 + 基于真实 SDK 的固件骨架

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Web](https://img.shields.io/badge/Platform-Web-green.svg)]()
[![Version: v1.0.0](https://img.shields.io/badge/Version-v1.0.0-purple.svg)]()

---

## 🎯 核心特性

### **真实芯片级拓扑**
- 显示实际产品中的芯片型号组合（AW313A + HUSB238 + CW2015）
- 标注通信协议（I2C、ADC、USB PD）
- 输出完整 BOM 清单

### **可交互芯片组件**
- 主控芯片：可切换型号（AW313A/IP5328/IP5389）
- PD协商芯片：触发电压协商（5V/9V/12V/20V）
- 电量计芯片：实时显示 SOC 和电压
- 传感器芯片：通用配置（I2C/SPI）

### **产品架构方案库**
- 基础款 10000mAh 充电宝（AW313A 方案）
- 旗舰款 20000mAh 双向快充（IP5389 方案）
- 包含 BOM + 拓扑连接 + 信号流

### **智能代码生成**
- 引脚自动分配（基于芯片推荐引脚）
- 冲突检测（避免多设备占用同一引脚）
- 内存预算（AW313A 总 RAM 7KB，自动估算）
- 完整项目结构（board_config.h + app_config.h + app_main.c）

---

## 🚀 快速开始

### 1. 克隆仓库
```bash
cd /Users/linxiansheng/hardware-prototype-platform
```

### 2. 启动本地服务器
```bash
python3 -m http.server 8080
# 或
npx serve .
```

### 3. 打开浏览器
访问 `http://localhost:8080`

### 4. 体验 Demo
- **方式1**：点击底部紫色按钮 **🔋 充电宝Demo** → 自动加载完整原型
- **方式2**：点击「载入示例」→「解析PRD」→ 自动构建
- **方式3**：从左侧组件库拖拽元件到视口，手动构建

---

## 🎬 使用流程

### 📝 Step 1: 编写 PRD
在「PRD」标签页输入需求文档（Markdown格式）：
```markdown
# 新国标充电宝 PRD

## 硬件模块
- 电池组：10000mAh
- USB-C：65W PD 输入
- USB-A：5V/2.4A 输出
- 温度传感器：过温保护
- OLED屏：显示电量/状态
- 4格电量指示灯

## 上位机
- iOS App：远程监控电量/温度/告警

## 交互流程
1. USB-C接入 → 充电，OLED显示"CHARGING"
2. 温度>45℃ → 过温保护，切断输出，蜂鸣告警
3. 电量<20% → 低电告警
4. 手机App远程开关输出
```

### ⚡ Step 2: 解析 PRD
点击「⚡ 解析PRD」→ 自动生成：
- **硬件视口**：电池/USB-C/USB-A/温度/OLED/蜂鸣器/按键/LED
- **手机视口**：电量仪表盘/温度仪表盘/状态卡片/远程开关/告警日志
- **联动规则**：自动推断事件绑定（含条件触发）

### 🎮 Step 3: 交互测试
- **充电**：点击 USB-C 接口 → 电池充电动画 + 状态灯橙 + 手机显示"充电中"
- **过温保护**：拖动温度滑块到 46℃ → 蜂鸣 + 电池停止 + 状态灯红 + 手机告警
- **放电**：点击 USB-A → 电池放电 + 状态灯青
- **远程控制**：点击手机开关 → 硬件响应

### 🔌 Step 4: 拖拽真实芯片
从左侧「芯片」分类拖拽到硬件视口：
- **chip_mcu**：主控芯片（AW313A）
- **chip_pd**：PD协商芯片（HUSB238）
- **chip_gauge**：电量计（CW2015）

点击芯片可交互：
- PD芯片 → 触发电压协商（9V/12V）
- 电量计 → 更新 SOC 百分比
- 主控 → 切换运行状态

### ↓ Step 5: 导出代码
点击「↓ 导出代码」→ 生成：
- **引脚分配表**：设备 → 引脚 → 枚举
- **内存报告**：总量/使用率/告警
- **完整项目**：board_config.h + app_config.h + app_main.c
- **BOM 清单**：芯片型号 + 角色说明

---

## 📦 项目结构

```
hardware-prototype-platform/
├── index.html              # 主页面（多视口布局）
├── styles.css              # 赛博朋克工业风样式
│
├── library.js              # 设备库（18种组件：外设+芯片+APP控件）
├── chipdb.js               # 真实芯片数据库（AW313A/IP5328规格）
├── architecture.js         # 产品架构方案库（BOM+拓扑+信号流）
├── engine.js               # 联动引擎（信号总线+条件触发）
├── prd.js                  # PRD解析+拓扑/状态机/代码生成
├── codegen_enhanced.js     # 增强代码生成器（引脚分配/冲突检测）
├── app.js                  # 主控制器（视口管理+渲染+交互）
│
├── docs/
│   ├── AGENT.md            # AI Agent 协作指南（项目结构详解）
│   ├── CHANGELOG.md        # 版本更新日志
│   └── archive/            # 历史文档归档
│
├── .claude/
│   └── launch.json         # 预览服务器配置
│
└── README.md               # 本文件
```

**总代码量**：3629 行（纯原生 JS/CSS，无外部依赖）

---

## 🌟 核心亮点

### v1.0.0 — 架构级真实化

| 维度 | 优化前（抽象层） | 优化后（架构层） |
|------|----------------|-----------------|
| **设备** | 按键、LED、传感器 | + 真实芯片（AW313A, HUSB238） |
| **拓扑** | 简单箭头 | 芯片级连接 + 协议标注（I2C/ADC） |
| **BOM** | 无 | ✅ 完整器件清单 |
| **方案** | 单一抽象 | ✅ 可选基础款/旗舰款 |
| **代码** | 绑定寄存器 | ✅ 架构骨架（可移植） |
| **交互** | 按键/LED | ✅ 芯片可操作（协商电压/更新SOC） |

### 真实产品参考

- **基础方案**：安克 PowerCore 10000mAh（AW313A + HUSB238 + CW2015）
- **旗舰方案**：品胜 TS-D399 20000mAh（IP5389 集成方案）

---

## 🛠️ 技术架构

### 前端框架
- 纯原生 JavaScript（无框架依赖）
- CSS3 动画（赛博朋克风格 + 拟物化元件）
- SVG 动态拓扑图

### 核心模块
| 模块 | 职责 | 文件 | 代码量 |
|------|------|------|--------|
| 设备库 | 元件定义（外观/事件/动作） | library.js | 552行 |
| 芯片库 | 真实硬件参数/架构接口 | chipdb.js | 409行 |
| 方案库 | 产品BOM+拓扑+信号流 | architecture.js | 193行 |
| 引擎 | 信号总线 + 条件触发 | engine.js | 156行 |
| PRD解析 | 自然语言 → 设备配置 | prd.js | 377行 |
| 代码生成 | 引脚分配 + 冲突检测 | codegen_enhanced.js | 430行 |
| 视口管理 | 拖放/渲染/交互 | app.js | 832行 |

---

## 📖 文档

- **[AGENT.md](./AGENT.md)** — AI Agent 协作指南（项目结构、模块详解、协作流程）
- **[CHANGELOG.md](./CHANGELOG.md)** — 版本更新日志（新增功能、改进优化）
- **[README.md](./README.md)** — 本文件（快速开始、使用指南）

---

## 🎓 适用场景

### ✅ 适合
- 产品需求 → 硬件架构方案
- 芯片选型与对比（AW313A vs IP5389）
- BOM 清单生成
- 信号流可视化（充电/放电/保护）
- 架构级代码生成（可移植到不同 SDK）

### ❌ 不适合
- 寄存器级调试
- 驱动程序开发
- 实时固件仿真

---

## 🔮 扩展方向

- [ ] 更多主控芯片（ESP32/STM32/Nordic nRF）
- [ ] 更多传感器（加速度/陀螺仪/GPS）
- [ ] 通信模块（LoRa/Zigbee/WiFi）
- [ ] 拓扑视口可视化（渲染 architecture.js 的拓扑图）
- [ ] 预设方案按钮（一键加载基础款/旗舰款）
- [ ] 实时波形图（示波器模式）
- [ ] 接入真实硬件（Web Serial API）

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 添加新芯片
1. 在 `chipdb.js` 中定义架构接口
2. 在 `library.js` 中添加 `chip_xxx` 组件
3. 在 `architecture.js` 中创建新产品方案

详见 [AGENT.md - 开发指南](./AGENT.md#开发指南)

---

## 📄 许可证

MIT License © 2026

---

## 🌟 致谢

- **AW31N SDK**：杰理科技（JIELI）
- **字体**：Google Fonts (Orbitron, JetBrains Mono)
- **灵感来源**：Rhino 多视口布局、Figma 组件系统、Arduino IDE

---

## 📞 联系方式

- **项目地址**：`/Users/linxiansheng/hardware-prototype-platform/`
- **参考 SDK**：AW31N SDK v1.3.0
- **版本**：v1.0.0
- **更新日期**：2026-06-25

---

<div align="center">
  <img src="https://img.shields.io/badge/Made%20with-♥-red.svg" alt="Made with love"/>
  <img src="https://img.shields.io/badge/PRD→Firmware-Automated-blue.svg" alt="Automated"/>
  <img src="https://img.shields.io/badge/Chip-Real-purple.svg" alt="Real Chip"/>
</div>

### 1️⃣ **多视口 Rhino 式布局**
- **硬件视口**：PCB 板，可拖拽真实外观的硬件元件（按键/LED/传感器/电池/USB接口/OLED等）
- **手机 APP 视口**：iOS/Android/小程序风格，可添加 APP 控件（仪表盘/开关/日志）
- **拓扑视口**：自动生成逻辑拓扑图，信号流向可视化
- 支持 1/2/4 视口布局切换、视口最大化、自由新增/关闭

### 2️⃣ **真实可交互的硬件元件**（拟物化设计）
| 类别 | 元件 | 交互 | 视觉效果 |
|------|------|------|----------|
| **外设** | 按键 | 点击按下/抬起 | 3D 按压动画 |
| | LED | 开/关/颜色 | 霓虫光晕 + 阴影 |
| | 蜂鸣器 | 鸣响 | 声波扩散动画（3层波纹） |
| | 电机 | 转速可调 | 旋转动画 |
| | 继电器 | 开关 | ON/OFF 状态显示 |
| **传感器** | 温湿度/光照 | 拖动滑块调值 | 实时数值 + 事件触发 |
| | 运动(PIR) | 点击触发 | 橙色脉冲高亮 |
| **显示** | OLED/LCD | 动态显示文本 | 霓虹发光效果 |
| | 数码管 | 4位数字 | 7段LED仿真 |
| **电源** | 电池组 | 充/放电 | 电量条动画 + ⚡闪电图标 |
| | USB-C/A | 插拔 | 连接状态高亮 + 光晕 |
| | 4格电量灯 | SOC映射 | 绿/黄/红渐变 |

### 3️⃣ **跨视口信号联动引擎**
- **事件 → 绑定规则 → 动作**：硬件事件自动触发 APP 响应
- **条件门**：支持安全保护逻辑（如 `>45` 触发过温保护）
- **数据变换**：模板(`{v}`)、算术(`*2 +10`)、条件(`>30?高温:正常`)
- **实时仿真**：传感器自然漂移，拓扑连线高亮显示信号传播

### 4️⃣ **PRD 智能解析 → 一键构建原型**
输入 Markdown 格式的产品需求文档，自动识别：
- 硬件模块：电池/USB-C/传感器/显示屏/蜂鸣器等
- 上位机：iOS/Android/小程序
- 交互流程：自动推断联动规则（按键→灯、传感器→屏幕→手机）

**示例**：输入充电宝 PRD → 自动生成 10 硬件 + 5 APP控件 + 42 条联动规则

### 5️⃣ **真实芯片映射 + 固件代码生成**
#### **芯片数据库** (`chipdb.js`)
内置真实硬件参数，从实际 SDK/Datasheet 提取：
- **主控芯片**：
  - `AW313A` (杰理 BD47核)：GPIO/ADC/I2C/PWM/P33充电管理模块
  - `IP5328/IP5389` (英集芯)：PD快充协议、电量计接口
- **传感器/外设**：
  - `CW2015` 电量计 (I2C 0x62)
  - `NTC_10K` 温度传感器 (ADC查表)
  - `SSD1306` OLED (I2C 128×64)
  - `HUSB238` PD协商芯片

#### **代码生成**
基于 **真实 AW31N SDK** API（已核对头文件）：
```c
// GPIO 初始化（cpu/gpio.h）
gpio_init(PORTA, &cfg);
gpio_write(IO_PORTA_02, 1);

// ADC 电池采样（cpu/gpadc.h）
adc_add_sample_ch(AD_CH_IO_PA1);
u32 mv = adc_get_voltage(AD_CH_IO_PA1);

// P33 充电控制（asm/power/p33/charge_hw.h）
CHARGE_EN(1);
CHARGE_mA_SEL(300);  // 真实寄存器宏
CHGGO_EN(1);         // 启动充电

// I2C OLED（cpu/iic_api.h）
i2c_master_write_nbytes_to_device_reg(0, 0x3C, 0x00, 1, data, len);
```

**状态机 JSON**：包含设备、事件、动作、条件门，可喂给 AI 生成 TRD
**固件骨架**：类 C 语言，引脚定义 + 初始化 + 事件分发 + 主循环

---

## 📦 项目结构

```
hardware-prototype-platform/
├── index.html          # 主页面（多视口布局）
├── styles.css          # 赛博朋克工业风样式（拟物化元件）
├── library.js          # 设备库（13种硬件 + 5种APP控件）
├── chipdb.js           # 🆕 真实芯片/元件数据库（AW31N SDK参数）
├── engine.js           # 联动引擎（信号总线 + 条件触发）
├── prd.js              # PRD解析 + 拓扑/状态机/固件生成
├── app.js              # 主控制器（视口管理 + 渲染 + 交互）
└── .claude/launch.json # 预览服务器配置
```

---

## 🚀 快速开始

### 1. 克隆仓库
```bash
git clone https://github.com/yourusername/proto-sim.git
cd proto-sim
```

### 2. 启动本地服务器
```bash
python3 -m http.server 8080
# 或
npx serve .
```

### 3. 打开浏览器
访问 `http://localhost:8080`

### 4. 体验 Demo
- **方式1**：点击底部紫色按钮 **🔋 充电宝Demo** → 自动加载完整原型
- **方式2**：点击「载入示例」→「解析PRD」→ 自动构建
- **方式3**：从左侧组件库拖拽元件到视口，手动构建

---

## 🎬 使用流程

### 📝 **Step 1: 编写 PRD**
在「PRD」标签页输入需求文档（Markdown格式）：
```markdown
# 新国标充电宝 PRD

## 硬件模块
- 电池组：10000mAh
- USB-C：65W PD 输入
- USB-A：5V/2.4A 输出
- 温度传感器：过温保护
- OLED屏：显示电量/状态
- 4格电量指示灯

## 上位机
- iOS App：远程监控电量/温度/告警

## 交互流程
1. USB-C接入 → 充电，OLED显示"CHARGING"
2. 温度>45℃ → 过温保护，切断输出，蜂鸣告警
3. 电量<20% → 低电告警
4. 手机App远程开关输出
```

### ⚡ **Step 2: 解析 PRD**
点击「⚡ 解析PRD」→ 自动生成：
- **硬件视口**：电池/USB-C/USB-A/温度/OLED/蜂鸣器/按键/LED
- **手机视口**：电量仪表盘/温度仪表盘/状态卡片/远程开关/告警日志
- **42条联动规则**（含7条条件触发）

### 🎮 **Step 3: 交互测试**
- **充电**：点击 USB-C 接口 → 电池充电动画 + 状态灯橙 + 手机显示"充电中 65W"
- **过温保护**：拖动温度滑块到 46℃ → 蜂鸣 + 电池停止 + 状态灯红 + 手机告警"🔥电池过温"
- **放电**：点击 USB-A → 电池放电 + 状态灯青
- **远程控制**：点击手机开关 → 硬件响应

### ▶ **Step 4: 运行仿真**
点击「▶ 运行模拟」→ 传感器自然漂移，触发联动，拓扑连线实时高亮

### 📊 **Step 5: 生成拓扑**
点击「◈ 生成拓扑」→ 自动布局逻辑拓扑图（SVG），显示设备节点和信号流向

### ↓ **Step 6: 导出代码**
点击「↓ 导出代码」→ 生成：
- **状态机 JSON**：设备/事件/动作/条件，可喂给 AI 生成 TRD
- **固件骨架**：基于真实 AW31N SDK API 的 C 代码
- 自动下载 `proto-statemachine.json`

---

## 🆕 充电宝 Demo 亮点

### ✅ **新国标安全逻辑**（条件触发）
- **过充保护**：电池充满 100% → 停止充电 + 蜂鸣 + 状态灯绿
- **过放保护**：电量 < 20% → 蜂鸣 + APP 告警
- **过温保护**：温度 > 45℃ → 切断输出 + 状态灯红 + 蜂鸣 + APP 告警
- **条件门语法**：`condition: ">45"` 只在温度超阈值时触发

### ✅ **真实硬件映射**
选中任意元件 → 「属性」面板显示：
```
▣ 真实硬件映射
chip:      AW313A
peripheral: ADC(VBAT)
gauge:     CW2015
datasheet: AW313A Datasheet V1.2.pdf
```

### ✅ **固件代码真实可用**
生成的代码包含真实 API（已核对 AW31N SDK 头文件）：
```c
// 充电控制（P33 模块寄存器）
CHARGE_EN(1);           // P3_CHG_CON0 BIT0
CHARGE_mA_SEL(300);     // P3_CHG_CON1/2
CHGGO_EN(1);            // 启动充电

// 过温保护判断
if (ev_type == EV_CHANGE && value > 45) {
    电池组_stop();        // 停充
    状态LED_setColor("#ef4444"); // 红色
}
```

---

## 🛠️ 技术架构

### **前端框架**
- 纯原生 JavaScript（无框架依赖）
- CSS3 动画（赛博朋克风格 + 拟物化元件）
- SVG 动态拓扑图

### **核心模块**
| 模块 | 职责 | 文件 |
|------|------|------|
| **设备库** | 元件定义（外观/事件/动作/渲染） | `library.js` |
| **芯片库** | 真实硬件参数/API/代码模板 | `chipdb.js` |
| **引擎** | 信号总线 + 条件触发 + 仿真 | `engine.js` |
| **PRD解析** | 自然语言 → 设备配置 + 联动规则 | `prd.js` |
| **视口管理** | 拖放/渲染/交互/属性编辑 | `app.js` |

### **数据流**
```
PRD 文档
  ↓ 解析 (关键词匹配)
设备清单 + 联动规则
  ↓ 实例化
project { viewports[], devices[], bindings[] }
  ↓ 渲染
多视口 DOM + 事件监听
  ↓ 交互
Engine.emit(deviceId, event, payload)
  ↓ 匹配
bindings.filter(条件门) → 执行动作
  ↓ 导出
状态机 JSON + 固件骨架
```

---

## 📚 真实硬件参考

### **AW31N SDK** (杰理科技)
- **路径**：`/Users/linxiansheng/Desktop/研发ai优化项目/AW31N_sdk_release_v1.3.0_2026.01.15 V1/AW31N`
- **核心**：BD47 RISC 核，160MHz，BLE 5.x
- **外设**：GPIO/ADC/I2C/SPI/PWM/UART/Timer
- **电源管理**：P33 模块（充电控制/LDO5V/VBAT检测）
- **主程序**：`apps/app/bsp/start/bd47/main.c`
- **驱动头文件**：`apps/include_lib/cpu/*.h`

### **充电宝参考方案**
| 型号 | 容量 | 芯片 | 功率 | 特性 |
|------|------|------|------|------|
| 安克 A1287 | 10000mAh | IP5328P + CW2015 | 18W | PD/QC |
| 品胜 TS-D399 | 20000mAh | IP5389 + BQ27542 | 100W | PD 3.0 双向 |

---

## 🎨 设计亮点

### **赛博朋克工业风**
- 深色 PCB 背景（绿色电路纹理）
- 霓虹青色强调 + 紫色点缀
- Orbitron 未来感标题 + JetBrains Mono 代码字体
- 脉冲动画、浮动效果、贝塞尔曲线连线

### **交互体验**
- 元件拖拽有抓手光标切换
- 按键按下有物理深度动画
- LED 发光有光晕扩散 + 阴影
- 所有动作有脉冲高亮反馈
- 拓扑连线实时高亮信号传播

---

## 📖 扩展能力

### ✅ **已实现**
- [x] 13种硬件元件（外设/传感器/显示/电源）
- [x] 5种 APP 控件（仪表/开关/日志/按钮/卡片）
- [x] 条件触发引擎（安全保护逻辑）
- [x] 真实芯片数据库（AW31N SDK）
- [x] 固件代码生成（基于真实 API）
- [x] PRD 解析 + 自动构建
- [x] 多视口 + 拓扑可视化
- [x] 完整充电宝 Demo

### 🔮 **可扩展方向**
- [ ] 更多主控芯片（ESP32/STM32/Nordic nRF）
- [ ] 更多传感器（加速度/陀螺仪/GPS）
- [ ] 通信模块（LoRa/Zigbee/WiFi）
- [ ] 3D 元件模型（Three.js）
- [ ] 实时波形图（示波器模式）
- [ ] 接入真实硬件（Web Serial API）
- [ ] AI 优化联动规则（GPT-4 推荐）
- [ ] 云端协同（多人共建原型）

### 🧩 **添加新元件**
在 `library.js` 中定义：
```javascript
HARDWARE_DEVICES['your_device'] = {
  category: 'sensor',
  icon: '🔬',
  name: '新传感器',
  size: { w: 100, h: 100 },
  defaultProps: { pin: 'GPIO5', range: '0-100' },
  defaultState: { value: 0 },
  events: ['change'],
  actions: { set: (d, v) => d.state.value = v },
  render(d) { return `<div>${d.state.value}</div>`; }
};
```

### 🧩 **添加新芯片**
在 `chipdb.js` 中定义：
```javascript
CHIP_DATABASE['ESP32-C3'] = {
  vendor: 'Espressif',
  core: 'RISC-V 32bit',
  freq: '160MHz',
  peripherals: { gpio: {...}, adc: {...}, i2c: {...} },
  datasheet: 'esp32-c3_datasheet_en.pdf'
};
```

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程
1. Fork 本仓库
2. 创建特性分支：`git checkout -b feat/your-feature`
3. 提交改动：`git commit -m 'Add: your feature'`
4. 推送分支：`git push origin feat/your-feature`
5. 提交 PR

### 代码规范
- JS：遵循 ESLint + Prettier
- CSS：BEM 命名规范
- 注释：函数头部注释 + 关键逻辑行内注释

---

## 📄 许可证

MIT License © 2026

---

## 🌟 致谢

- **AW31N SDK**：杰理科技（JIELI）
- **字体**：Google Fonts (Orbitron, JetBrains Mono)
- **图标**：Emoji + Unicode 符号
- **灵感来源**：Rhino 多视口布局、Figma 组件系统、Arduino IDE

---

## 📞 联系方式

- **作者**：Kiro AI
- **项目地址**：[GitHub - proto-sim](https://github.com/yourusername/proto-sim)
- **在线演示**：[proto-sim.demo](https://your-demo-url.com)

---

<div align="center">
  <img src="https://img.shields.io/badge/Made%20with-♥-red.svg" alt="Made with love"/>
  <img src="https://img.shields.io/badge/PRD→Firmware-Automated-blue.svg" alt="Automated"/>
</div>
