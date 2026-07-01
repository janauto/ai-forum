# PROTO//SIM 硬件原型联动验证平台

## 项目概述

**PROTO//SIM** 是一个从 PRD 到真实固件代码的交互式可视化原型工具，支持拖拽硬件元件、可交互仿真、自动生成状态机和基于真实 SDK 的固件骨架。

### 核心特性

- **真实芯片级拓扑**：显示实际产品中的芯片型号组合（AW313A + HUSB238 + CW2015）
- **可交互芯片组件**：主控/PD协商/电量计等芯片可实时操作
- **架构方案库**：内置基础款/旗舰款充电宝完整硬件方案（BOM + 拓扑 + 信号流）
- **智能代码生成**：引脚分配、内存预算、冲突检测、完整项目结构
- **多视口布局**：硬件板/手机APP/拓扑图同步显示
- **PRD 自动解析**：Markdown 需求文档自动生成硬件配置

---

## 项目结构

```
hardware-prototype-platform/
├── index.html              # 主页面（多视口布局）
├── styles.css              # 赛博朋克工业风样式（520行）
│
├── library.js              # 设备库（按键/LED/芯片等18种组件）
├── chipdb.js               # 真实芯片数据库（AW313A/IP5328规格）
├── architecture.js         # 产品架构方案库（BOM+拓扑+信号流）
├── engine.js               # 联动引擎（信号总线+事件分发）
├── prd.js                  # PRD解析+拓扑/状态机/代码生成
├── codegen_enhanced.js     # 增强代码生成器（引脚分配/冲突检测）
├── app.js                  # 主控制器（视口管理+渲染+交互）
│
├── .claude/
│   └── launch.json         # 预览服务器配置
│
└── docs/
    ├── AGENT.md            # 本文件（AI Agent 协作指南）
    └── CHANGELOG.md        # 版本更新日志
```

---

## 核心模块说明

### 1. **library.js** — 设备库（552行）

定义了 **18 种可交互组件**，分为 3 大类：

#### 硬件外设（13种）
- **peripheral**：按键、LED、蜂鸣器、电机、继电器
- **sensor**：温度、湿度、光照、运动（PIR）
- **display**：OLED、LCD、数码管
- **power**：电池组、USB-C、USB-A、4格电量灯

#### 真实芯片（4种）— 🆕 新增
- **chip_mcu**：主控芯片（AW313A/IP5328/IP5389可选）
- **chip_pd**：PD协商芯片（HUSB238，可触发电压协商）
- **chip_gauge**：电量计芯片（CW2015，显示SOC/电压）
- **chip_sensor**：通用传感器芯片（I2C/SPI接口）

#### 手机 APP 控件（5种）
- **app_gauge**：仪表盘（显示传感器数值）
- **app_toggle**：开关（远程控制硬件）
- **app_log**：事件日志
- **app_button**：操作按钮
- **app_status**：状态卡片

**每个组件包含**：
```javascript
{
  category: '分类',
  icon: '图标',
  name: '名称',
  size: { w, h },
  defaultProps: {},      // 默认属性（引脚/型号/参数）
  defaultState: {},      // 默认状态（开关/数值）
  events: [],            // 可发出的事件
  actions: {},           // 可接收的动作
  render(device) {}      // 渲染函数（返回HTML）
}
```

---

### 2. **chipdb.js** — 芯片数据库（409行）

存储**真实芯片规格**（从 SDK/Datasheet 提取），聚焦架构层而非寄存器细节。

#### 主控芯片库
```javascript
'AW313A': {
  vendor: 'JIELI 杰理',
  role: 'BLE SOC + 电源管理',
  
  // 架构接口（不涉及具体引脚）
  interfaces: {
    power_in: { type: 'USB-C', protocol: 'PD需外挂协商芯片' },
    battery: { method: '内置充电管理', gauge: '可选外挂I2C电量计' },
    display: { type: 'I2C', example: 'OLED SSD1306' }
  },

  // 典型外围芯片方案
  typical_peripherals: [
    { name: 'HUSB238', role: 'PD协商', interface: 'I2C' },
    { name: 'CW2015', role: '电量计', interface: 'I2C' }
  ],

  // 功能模块
  functional_blocks: {
    charge: { features: ['恒流', '恒压', '涓流', '满电检测'] },
    protection: { features: ['过充', '过放', '过流', '过温'] }
  }
}
```

#### 外围器件库
- **CW2015**：电量计（I2C 0x62）
- **NTC_10K**：温度传感器（ADC查表）
- **SSD1306**：OLED显示屏（I2C 128×64）
- **HUSB238**：PD协商芯片（I2C 0x08）
- **LED_BAR_4**：4格电量指示灯

---

### 3. **architecture.js** — 产品架构方案库（193行）🆕

定义**完整的硬件方案**（芯片组合 + 拓扑连接 + 信号流），不涉及底层寄存器。

#### 方案示例：基础款 10000mAh 充电宝
```javascript
{
  name: '基础款 10000mAh 充电宝',
  capacity: '10000mAh',

  // BOM 清单
  bom: [
    { id: 'mcu', name: 'AW313A', role: '主控+电源管理' },
    { id: 'pd_chip', name: 'HUSB238', role: 'PD协商芯片' },
    { id: 'gauge', name: 'CW2015', role: '电量计' },
    { id: 'battery', name: '18650锂电芯×2', role: '电池组(1S2P)' }
  ],

  // 拓扑节点 + 连接关系
  topology: {
    nodes: [
      { id: 'mcu', label: 'AW313A\n主控SOC', type: 'chip', x: 400, y: 300 },
      { id: 'pd_chip', label: 'HUSB238\nPD协商', type: 'chip', x: 150, y: 200 }
    ],
    edges: [
      { from: 'usb_c', to: 'pd_chip', protocol: 'USB PD', label: 'PD协商' },
      { from: 'pd_chip', to: 'mcu', protocol: 'I2C', label: '电压选择' },
      { from: 'mcu', to: 'battery', protocol: 'Charge', label: '恒流恒压充电' }
    ]
  },

  // 场景化信号流
  signal_flows: [
    {
      scenario: '充电流程',
      steps: [
        { step: 1, desc: 'USB-C插入', actors: ['usb_c'] },
        { step: 2, desc: 'HUSB238协商9V', actors: ['pd_chip'] },
        { step: 3, desc: '主控启动充电', actors: ['mcu', 'battery'] }
      ]
    }
  ]
}
```

---

### 4. **codegen_enhanced.js** — 增强代码生成器（430行）🆕

#### 核心功能
1. **智能引脚分配**：根据芯片推荐引脚自动分配，避免冲突
2. **引脚冲突检测**：检查多设备是否占用同一引脚
3. **内存预算估算**：计算应用RAM使用量（AW313A总RAM 7KB）
4. **生成完整项目**：board_config.h + app_config.h + app_main.c

#### 引脚分配策略
```javascript
// 基于芯片推荐引脚
recommend: {
  led: ['PA2', 'PA3', 'PA4', 'PA7'],
  button: ['PA5', 'PA6', 'PA8'],
  adc: ['PA1', 'PA9'],  // NTC/外部传感器
  i2c: ['PA10(SCL)', 'PA11(SDA)'],  // 硬件I2C0
  pwm: ['PA12', 'PA13']  // 蜂鸣器/呼吸灯
}
```

#### 生成的文件结构
```c
/* board_config.h */
#define TCFG_LED1_PIN       IO_PORTA_02      // PA2
#define TCFG_BUTTON1_PIN    IO_PORTA_05      // PA5
#define TCFG_NTC_ADC_CH     AD_CH_IO_PA1     // PA1

/* app_config.h */
#define SYS_STACK_SIZE      0x600
#define BT_NK_RAM_SIZE      0x660
#define LOW_POWER_VOL       2500  // mV

/* app_main.c */
void app_main(void) {
    led1_init();
    battery_init();
    sys_timer_add(NULL, app_power_scan, 2000);
}
```

---

### 5. **engine.js** — 联动引擎（156行）

实现设备间的**事件驱动信号总线**。

#### 核心机制
```javascript
// 注册绑定规则
Engine.addBinding({
  from: 'temp_sensor',     // 源设备
  event: 'change',         // 触发事件
  to: 'oled_display',      // 目标设备
  action: 'setText',       // 执行动作
  transform: '温度:{v}°C',  // 数据转换
  condition: '>45'         // 条件门（可选）
});

// 触发事件
Engine.emit('temp_sensor', 'change', 48);
// → 判断 48 > 45 → 执行 oled_display.setText('温度:48°C')
```

#### 条件门语法
- `>45` / `<20` / `>=100` / `<=0`
- 用于安全保护逻辑（过温/低电）

---

### 6. **prd.js** — PRD 解析器（377行）

#### 功能流程
```
PRD Markdown 文档
  ↓ 关键词匹配
设备清单 + 联动规则
  ↓ 实例化
project { viewports[], devices[], bindings[] }
  ↓ 导出
拓扑图 / 状态机 JSON / 固件代码
```

#### PRD 解析示例
输入：
```markdown
# 10000mAh 充电宝
- USB-C: PD输入
- 温度传感器: NTC 10K
- 4格电量灯
- OLED屏
```

输出：
- 硬件设备：USB-C、温度传感器、电池、电量灯、OLED
- 联动规则：温度>45°C → 停止充电 + 蜂鸣告警
- 拓扑图：芯片级连接关系
- 固件代码：完整项目结构

---

### 7. **app.js** — 主控制器（832行）

#### 职责
- **视口管理**：创建/删除/切换硬件板/手机/拓扑视口
- **拖拽交互**：从组件库拖拽设备到视口
- **设备渲染**：调用 `library.js` 的 `render()` 函数
- **属性编辑**：右侧面板修改设备参数
- **事件响应**：监听点击/拖动，触发 `Engine.emit()`

---

## 数据流架构

```
┌─────────────┐
│   PRD 文档   │ (Markdown)
└──────┬──────┘
       │ prd.js 解析
       ↓
┌─────────────────────────┐
│  设备清单 + 联动规则      │
└──────┬──────────────────┘
       │ 实例化
       ↓
┌─────────────────────────┐
│  project 对象            │
│  - viewports[]           │
│  - devices[]             │
│  - bindings[]            │
└──────┬──────────────────┘
       │ app.js 渲染
       ↓
┌─────────────────────────┐
│  DOM + 事件监听          │
└──────┬──────────────────┘
       │ 用户交互
       ↓
┌─────────────────────────┐
│  Engine.emit(事件)       │
└──────┬──────────────────┘
       │ 匹配规则
       ↓
┌─────────────────────────┐
│  执行动作 + 重新渲染      │
└──────┬──────────────────┘
       │ 导出
       ↓
┌─────────────────────────┐
│  拓扑图 / 状态机 / 代码   │
└─────────────────────────┘
```

---

## 核心概念

### 1. 设备（Device）
```javascript
{
  id: 'led1',              // 唯一标识
  type: 'led',             // 类型（对应 library.js）
  props: {                 // 属性（引脚/型号/参数）
    pin: 'PA2',
    color: '#00ff88'
  },
  state: {                 // 状态（开关/数值）
    on: false
  },
  x: 100, y: 150          // 坐标
}
```

### 2. 绑定（Binding）
```javascript
{
  from: 'button1',         // 源设备
  event: 'click',          // 触发事件
  to: 'led1',              // 目标设备
  action: 'toggle',        // 执行动作
  condition: '',           // 条件门（可选）
  transform: ''            // 数据转换（可选）
}
```

### 3. 视口（Viewport）
```javascript
{
  id: 'vp1',
  type: 'hardware',        // 类型：hardware / mobile / topology
  devices: [],             // 该视口内的设备
  style: 'pcb'             // 手机视口：ios / android / miniapp
}
```

---

## AI Agent 协作指南

### 适用场景

本平台适合以下协作场景：

#### 1️⃣ **产品需求转硬件方案**
- **输入**：用户提供充电宝/智能家居/工控设备 PRD
- **AI 任务**：
  1. 解析需求 → 识别硬件模块（电池/传感器/显示/通信）
  2. 选择芯片方案（基础款 vs 旗舰款）
  3. 生成 BOM 清单 + 拓扑图
  4. 输出架构设计文档

#### 2️⃣ **芯片选型与对比**
- **输入**：用户询问"AW313A 和 IP5389 有什么区别？"
- **AI 任务**：
  1. 从 `chipdb.js` 提取两款芯片规格
  2. 对比功能模块（AW313A 需外挂 PD 芯片，IP5389 内置）
  3. 推荐适用场景（AW313A 适合基础款，IP5389 适合旗舰款）

#### 3️⃣ **代码生成与验证**
- **输入**：用户要求"生成充电宝固件代码"
- **AI 任务**：
  1. 调用 `codegen_enhanced.js` 生成完整项目
  2. 检查引脚冲突、内存预算
  3. 输出可编译的 board_config.h + app_main.c
  4. 标注需要用户核对的部分（引脚/参数）

#### 4️⃣ **故障排查与优化**
- **输入**：用户反馈"温度传感器不工作"
- **AI 任务**：
  1. 检查拓扑连接（NTC → ADC → MCU）
  2. 检查绑定规则（事件/动作是否匹配）
  3. 检查引脚分配（是否冲突）
  4. 提供修复建议

### 协作原则

#### ✅ 应该做的
1. **基于真实芯片规格**：从 `chipdb.js` 和 `architecture.js` 提取数据
2. **架构层思考**：关注芯片组合、通信协议、信号流，而非寄存器细节
3. **验证可行性**：检查引脚冲突、内存预算、功能兼容性
4. **生成可执行代码**：确保代码符合目标 SDK（如 AW31N）规范

#### ❌ 不应该做的
1. ~~深入寄存器操作~~：平台聚焦架构层，不涉及 `P3_CHG_CON0` 等寄存器
2. ~~修改平台核心逻辑~~：除非用户明确要求，否则保持 `engine.js` 等核心模块稳定
3. ~~忽略硬件约束~~：必须考虑引脚数量、内存限制、通信接口

### 典型对话流程

```
用户: "我想做一个 20000mAh 双向快充充电宝"

AI: 
1. 【方案推荐】根据容量和双向快充需求，推荐旗舰方案：
   - 主控：IP5389（集成 PD 协议 + 电量计）
   - 显示：SSD1306 OLED（128×32）
   - 电池：21700 × 3（1S3P）
   
2. 【BOM 清单】
   | 器件 | 型号 | 角色 | 接口 |
   |------|------|------|------|
   | 主控 | IP5389 | SOC | - |
   | 屏幕 | SSD1306 | OLED | I2C |
   | 电池 | 21700×3 | 电池组 | - |

3. 【拓扑连接】
   USB-C1 ↔ IP5389 (PD双向) ↔ 电池组
   IP5389 ↔ SSD1306 (I2C)
   
4. 【信号流】
   充电：USB-C1 → PD协商60W → IP5389充电管理 → 电池
   放电：电池 → IP5389升压 → USB-C2输出100W
   显示：IP5389读SOC → OLED显示百分比

5. 【生成代码】已生成 board_config.h + app_main.c
   ⚠️ 请核对引脚分配（I2C地址 0x3C）

用户: "内存够用吗？"

AI: 
【内存预算】
- 系统栈：1536B (0x600)
- 用户栈：1280B (0x500)
- BT RAM：4896B
- 应用数据：384B（6个设备 × 64B）
- 总计：8096B / 7168B ⚠️ 超出 928B

建议：
1. 关闭 BLE 功能（节省 4896B）
2. 或切换到 RAM 更大的芯片
```

---

## 开发指南

### 添加新芯片

1. **在 `chipdb.js` 中定义**
```javascript
'ESP32-C3': {
  vendor: 'Espressif',
  role: 'WiFi + BLE SOC',
  interfaces: {
    power_in: { type: 'USB-C', voltage: '5V' },
    wireless: { type: 'WiFi 4 + BLE 5.0' }
  },
  typical_peripherals: [
    { name: 'CH340', role: 'USB转串口', interface: 'UART' }
  ]
}
```

2. **在 `library.js` 中添加组件**
```javascript
chip_esp32: {
  category: 'chip',
  name: 'ESP32-C3',
  defaultProps: { model: 'ESP32-C3' },
  render(d) { return `<div class="hw-chip">...</div>`; }
}
```

### 添加新产品方案

在 `architecture.js` 中定义：
```javascript
'smart_home_gateway': {
  name: '智能家居网关',
  bom: [...],
  topology: { nodes: [...], edges: [...] },
  signal_flows: [...]
}
```

### 调试技巧

```javascript
// 浏览器 Console
window.project                    // 查看当前项目对象
window.Engine.bindings            // 查看所有绑定规则
window.ProductArchitecture.listArchitectures()  // 列出所有方案
window.ChipDB.getChipSpec('AW313A')            // 查看芯片规格
```

---

## 版本历史

详见 [CHANGELOG.md](./CHANGELOG.md)

---

## 许可证

MIT License © 2026

---

## 联系方式

- **项目地址**：`/Users/linxiansheng/hardware-prototype-platform/`
- **参考 SDK**：AW31N SDK (`/Users/linxiansheng/Desktop/研发ai优化项目/AW31N_sdk_release_v1.3.0_2026.01.15 V1/AW31N`)
- **Obsidian 调研目录**：`/Users/linxiansheng/Library/Mobile Documents/iCloud~md~obsidian/Documents/OBVault/调研/`

---

**更新日期**：2026-06-25  
**文档版本**：v1.0.0
