# 硬件原型平台 — 真实拓扑增强方案（架构层）

## 🎯 核心目标

> **让拓扑图反映真实产品的硬件架构，而非停留在抽象概念**

### ❌ 不需要的（硬件底层细节）
- ~~具体寄存器地址（P3_CHG_CON0）~~
- ~~API 函数调用（gpio_write, adc_get_voltage）~~
- ~~引脚编号（IO_PORTA_02）~~
- ~~中断优先级配置~~

### ✅ 需要的（架构拓扑真实性）
- **真实芯片方案**：主控芯片 + 外围芯片的组合
- **模块层级关系**：哪些外设连到主控，哪些通过 I2C/SPI/ADC
- **信号流向**：数据如何在模块间传递
- **电源拓扑**：充电/放电路径
- **通信协议**：I2C/SPI/UART/ADC（不涉及具体命令）

---

## 📊 真实充电宝硬件拓扑示例

### 当前平台输出（抽象层）
```
[按键] --点击--> [LED]
[温度传感器] --change--> [OLED屏]
[电池] --电量--> [手机APP]
```

### 真实产品拓扑（架构层）
```
┌─────────────────────────────────────────────────────────────┐
│                      充电宝系统架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐                  ┌──────────────┐         │
│  │  USB-C 接口  │──PD协商──────────│  HUSB238     │         │
│  │  (输入/输出) │                  │  PD协商芯片   │         │
│  └──────┬───────┘                  └──────┬───────┘         │
│         │                                  │                 │
│         │ VBUS                            I2C               │
│         ↓                                  ↓                 │
│  ┌──────────────────────────────────────────────────┐       │
│  │                AW313A / IP5328                    │       │
│  │            主控 SOC (电源管理)                    │       │
│  │  ┌────────────────────────────────────────┐      │       │
│  │  │ 充电管理    │ 升压控制 │ 协议识别      │      │       │
│  │  └────────────────────────────────────────┘      │       │
│  │  ┌────────────────────────────────────────┐      │       │
│  │  │ GPIO × 8    │ ADC × 4  │ I2C × 2       │      │       │
│  │  └────────────────────────────────────────┘      │       │
│  └──────┬─────────┬─────────┬─────────┬─────────────┘       │
│         │         │         │         │                      │
│       GPIO       ADC       I2C      VOUT                     │
│         │         │         │         │                      │
│  ┌──────▼─────┐ ┌▼────┐  ┌─▼────────▼─┐  ┌────────┐        │
│  │ 4格LED指示 │ │NTC  │  │  CW2015    │  │ USB-A  │        │
│  │ (SOC映射)  │ │10K  │  │  电量计    │  │ 输出口 │        │
│  └────────────┘ │温度 │  │  (I2C)     │  └────────┘        │
│                 └─────┘  └────────────┘                     │
│                                │                             │
│                           I2C读取SOC/电压                    │
│                                │                             │
│                    ┌───────────▼───────────┐                │
│                    │   锂电池组 (1S/2S)    │                │
│                    │   10000mAh            │                │
│                    │   + BMS保护板          │                │
│                    └───────────────────────┘                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 实施方案

### Phase 1: 增强芯片数据库（架构层）

#### 目标：描述**芯片方案**，而非寄存器细节

```javascript
const CHIP_DATABASE = {
  'AW313A': {
    vendor: 'JIELI',
    role: 'BLE SOC + 电源管理',
    
    // 🆕 架构接口（不涉及具体引脚）
    interfaces: {
      power_in: { type: 'USB-C', protocol: 'PD需外挂协商芯片', voltage: '5-20V' },
      power_out: { type: 'USB-A', voltage: '5V', current: '2.4A' },
      battery: { type: '1S锂电', method: '内置充电管理', gauge: '可选外挂I2C电量计' },
      display: { type: 'I2C', example: 'OLED SSD1306' },
      indicator: { type: 'GPIO驱动LED', count: '4-8路' },
      sensors: { type: 'ADC', example: 'NTC温度/电流采样' }
    },

    // 🆕 典型外围芯片方案
    typical_peripherals: [
      { name: 'HUSB238', role: 'PD协商', interface: 'I2C', optional: false },
      { name: 'CW2015', role: '电量计', interface: 'I2C', optional: true },
      { name: 'NTC 10K', role: '温度监控', interface: 'ADC', optional: false }
    ],

    // 🆕 功能模块（不涉及寄存器）
    functional_blocks: {
      charge: { desc: '充电管理', features: ['恒流', '恒压', '涓流', '满电检测'] },
      boost: { desc: '升压输出', features: ['5V稳压', '负载检测', '过流保护'] },
      protection: { desc: '保护电路', features: ['过充', '过放', '过流', '过温', '短路'] }
    }
  },

  'IP5328': {
    vendor: 'Injoinic',
    role: '专用移动电源SOC',
    
    interfaces: {
      power_in: { type: 'USB-C', protocol: 'PD 3.0内置', voltage: '5-20V' },
      power_out: { type: 'USB-C + USB-A', voltage: '5-20V', current: '3A' },
      battery: { type: '1S锂电', method: '内置充电+电量计', gauge: '内置' },
      display: { type: 'GPIO数码管驱动', count: '4位' },
      indicator: { type: 'GPIO LED', count: '4路' }
    },

    typical_peripherals: [
      // 无需外挂PD芯片和电量计
    ],

    functional_blocks: {
      charge: { desc: '双向快充', features: ['PD双向', 'QC3.0', 'SCP', '自动协议识别'] },
      boost: { desc: '多电压输出', features: ['5V/9V/12V/20V', '智能功率分配'] },
      gauge: { desc: '内置电量计', features: ['库仑计', 'SOC算法', '温度补偿'] }
    }
  }
};
```

---

### Phase 2: 真实产品方案库

#### 描述**完整的硬件方案**（芯片组合 + 连接关系）

```javascript
const PRODUCT_ARCHITECTURES = {
  'powerbank_basic_10000': {
    name: '基础款 10000mAh 充电宝',
    capacity: '10000mAh',
    
    // 🆕 硬件BOM（Bill of Materials）
    bom: [
      { component: 'AW313A', role: '主控', qty: 1 },
      { component: 'HUSB238', role: 'PD协商', qty: 1 },
      { component: 'CW2015', role: '电量计', qty: 1 },
      { component: 'NTC 10K', role: '温度传感器', qty: 1 },
      { component: '18650 锂电芯', role: '电池', qty: 2, series: '1S2P' },
      { component: 'LED 0603', role: '电量指示', qty: 4 }
    ],

    // 🆕 拓扑连接（模块级，不涉及引脚）
    topology: {
      nodes: [
        { id: 'mcu', type: 'AW313A', x: 400, y: 300 },
        { id: 'pd_chip', type: 'HUSB238', x: 200, y: 200 },
        { id: 'gauge', type: 'CW2015', x: 600, y: 200 },
        { id: 'battery', type: '18650x2', x: 600, y: 400 },
        { id: 'ntc', type: 'NTC 10K', x: 700, y: 400 },
        { id: 'leds', type: 'LED×4', x: 400, y: 150 },
        { id: 'usb_c', type: 'USB-C接口', x: 100, y: 300 },
        { id: 'usb_a', type: 'USB-A接口', x: 700, y: 300 }
      ],
      edges: [
        { from: 'usb_c', to: 'pd_chip', type: 'VBUS', label: 'PD协商' },
        { from: 'pd_chip', to: 'mcu', type: 'I2C', label: '电压选择' },
        { from: 'usb_c', to: 'mcu', type: 'Power', label: '充电路径' },
        { from: 'mcu', to: 'battery', type: 'Charge', label: '恒流恒压' },
        { from: 'battery', to: 'gauge', type: 'VBAT', label: '电压检测' },
        { from: 'gauge', to: 'mcu', type: 'I2C', label: 'SOC读取' },
        { from: 'battery', to: 'ntc', type: 'Thermal', label: '温度贴合' },
        { from: 'ntc', to: 'mcu', type: 'ADC', label: '温度采样' },
        { from: 'mcu', to: 'leds', type: 'GPIO', label: 'SOC映射显示' },
        { from: 'mcu', to: 'usb_a', type: 'Boost', label: '5V升压输出' }
      ]
    },

    // 🆕 信号流（高层逻辑）
    signal_flows: [
      {
        scenario: '充电流程',
        steps: [
          'USB-C插入 → HUSB238协商电压(9V/12V)',
          'PD芯片通知主控 → 主控启动充电',
          '主控恒流充电 → 电池电压上升',
          'CW2015更新SOC → 主控读取显示',
          '充满检测 → 主控切断充电'
        ]
      },
      {
        scenario: '放电流程',
        steps: [
          'USB-A接入负载 → 主控检测负载',
          '主控启动升压 → 5V输出',
          '电池放电 → CW2015更新SOC',
          '主控读取温度 → 过热则断开输出'
        ]
      },
      {
        scenario: '过温保护',
        steps: [
          'NTC温度>45°C → 主控ADC采样',
          '主控判断过温 → 停止充电/放电',
          'LED闪烁红色 → 提示用户',
          '温度恢复 → 自动解除保护'
        ]
      }
    ]
  },

  'powerbank_premium_20000': {
    name: '旗舰款 20000mAh 双向快充',
    capacity: '20000mAh',
    
    bom: [
      { component: 'IP5389', role: '主控(集成PD+电量计)', qty: 1 },
      { component: 'SSD1306', role: 'OLED屏', qty: 1 },
      { component: '21700 锂电芯', role: '电池', qty: 3, series: '1S3P' },
      { component: 'NTC 10K', role: '温度传感器', qty: 2 }
    ],

    topology: {
      // 更简洁的拓扑（IP5389集成度高）
      nodes: [
        { id: 'mcu', type: 'IP5389', x: 400, y: 300 },
        { id: 'oled', type: 'SSD1306', x: 400, y: 150 },
        { id: 'battery', type: '21700x3', x: 600, y: 300 },
        { id: 'usb_c1', type: 'USB-C1(IN/OUT)', x: 200, y: 250 },
        { id: 'usb_c2', type: 'USB-C2(OUT)', x: 200, y: 350 },
        { id: 'usb_a', type: 'USB-A(OUT)', x: 600, y: 150 }
      ],
      edges: [
        { from: 'usb_c1', to: 'mcu', type: 'PD双向', label: '内置协议' },
        { from: 'usb_c2', to: 'mcu', type: 'PD输出', label: '100W' },
        { from: 'mcu', to: 'battery', type: 'Charge/Discharge', label: '双向管理' },
        { from: 'mcu', to: 'oled', type: 'I2C', label: '实时显示' },
        { from: 'mcu', to: 'usb_a', type: 'QC3.0', label: '18W' }
      ]
    },

    signal_flows: [
      {
        scenario: '给笔记本充电',
        steps: [
          'USB-C1连接笔记本 → PD协商20V/5A',
          'IP5389启动100W输出 → 电池放电',
          'OLED显示: "输出 20V 4.2A 84W"',
          '电池SOC实时更新 → 低于20%停止输出'
        ]
      }
    ]
  }
};
```

---

### Phase 3: 生成架构级拓扑图

#### 输出 SVG 拓扑 + 模块说明

```javascript
function generateArchitecturalTopology(productArch) {
  const svg = [];
  
  // 绘制芯片节点（带角色标注）
  productArch.topology.nodes.forEach(node => {
    const component = productArch.bom.find(b => b.component === node.type);
    const roleLabel = component ? component.role : node.type;
    
    svg.push(`
      <g class="chip-node" data-type="${node.type}">
        <rect x="${node.x}" y="${node.y}" width="120" height="80" />
        <text x="${node.x+60}" y="${node.y+30}">${node.type}</text>
        <text x="${node.x+60}" y="${node.y+50}" class="role">${roleLabel}</text>
      </g>
    `);
  });

  // 绘制连接线（带通信协议标注）
  productArch.topology.edges.forEach(edge => {
    const fromNode = productArch.topology.nodes.find(n => n.id === edge.from);
    const toNode = productArch.topology.nodes.find(n => n.id === edge.to);
    
    svg.push(`
      <g class="connection" data-protocol="${edge.type}">
        <line x1="${fromNode.x+60}" y1="${fromNode.y+40}" 
              x2="${toNode.x+60}" y2="${toNode.y+40}" />
        <text x="${(fromNode.x+toNode.x)/2}" y="${(fromNode.y+toNode.y)/2}">
          ${edge.type}: ${edge.label}
        </text>
      </g>
    `);
  });

  return svg.join('\n');
}
```

---

## 📦 输出示例

### 输入：充电宝 PRD
```markdown
# 10000mAh 充电宝
- 电池: 10000mAh
- USB-C: PD输入
- 4格电量灯
- 温度监控
```

### 输出：架构拓扑图 + BOM

```
┌─────────────────────────────────────────────────────────┐
│               硬件架构拓扑 (Architecture View)            │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [USB-C接口] ──PD协商──▶ [HUSB238] ──I2C──▶ [AW313A]    │
│       │                  PD协商芯片          主控SOC      │
│       │                                        │          │
│       └──VBUS──────────────────────────────────┤          │
│                                                │          │
│                                       充电管理 │          │
│                                                ↓          │
│                                        [18650×2] ─┬─▶ [CW2015]
│                                         电池组    │   电量计(I2C)
│                                                   │          │
│                                          [NTC] ───┘          │
│                                          温度(ADC)           │
│                                                              │
│  [LED×4] ◀──GPIO── [AW313A] ──Boost──▶ [USB-A接口]         │
│  电量指示                                5V输出              │
│                                                              │
└──────────────────────────────────────────────────────────────┘

【硬件BOM清单】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 芯片型号        角色              接口
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 AW313A         主控+电源管理      -
 HUSB238        PD协商            I2C→主控
 CW2015         电量计            I2C→主控
 NTC 10K        温度监控          ADC→主控
 18650×2        电池(1S2P)        -
 LED 0603×4     电量指示          GPIO←主控
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【信号流：充电流程】
1. USB-C插入 → HUSB238协商9V
2. PD芯片通知主控 → 启动充电
3. 主控恒流充电300mA → 电池升压
4. CW2015更新SOC → 主控读取
5. 充满检测 → 主控停充
```

---

## ✅ 核心价值

| 维度 | 当前（抽象） | 增强后（架构真实） |
|------|-------------|-------------------|
| **芯片** | "主控芯片" | AW313A + HUSB238 + CW2015 |
| **连接** | 箭头 | I2C/ADC/GPIO/VBUS（协议层） |
| **BOM** | 无 | 完整器件清单 |
| **信号流** | 事件绑定 | 充电/放电/保护完整流程 |
| **可替换性** | - | ✅ 芯片方案可切换，拓扑逻辑保留 |

---

## 🎯 实施步骤

1. ✅ **调整 chipdb.js**：删除寄存器细节，改为架构接口描述
2. ⏳ **添加产品方案库**：PRODUCT_ARCHITECTURES
3. ⏳ **升级拓扑生成**：显示芯片型号 + 通信协议 + BOM
4. ⏳ **UI增强**：点击节点显示芯片规格书链接、Datasheet

**让拓扑图成为产品选型和架构评审的工具，而非代码生成的中间产物。**
