# 硬件原型平台真实化增强方案

## 📋 现状分析

### 当前平台特点
- ✅ 已有可视化交互界面（多视口、拖拽元件）
- ✅ 已有基础芯片数据库（chipdb.js）
- ✅ 已有代码生成框架（prd.js）
- ⚠️ 生成的代码较为抽象，缺乏真实项目结构
- ⚠️ 硬件映射不够精确（引脚、寄存器、中断等）

### 真实充电宝 SDK 特征（AW31N）
从 `/Users/linxiansheng/Desktop/研发ai优化项目/AW31N_sdk_release_v1.3.0_2026.01.15 V1/AW31N` 提取：

#### 1️⃣ **项目结构**
```
AW31N/
├── apps/
│   ├── app/bsp/           # 板级支持包
│   │   ├── cpu/           # 外设驱动（GPIO/ADC/I2C/PWM）
│   │   │   ├── gpadc.c
│   │   │   ├── gpio.c
│   │   │   └── ...
│   │   ├── common/        # 通用模块
│   │   │   ├── led/led_control.c      # LED指示灯状态机
│   │   │   └── power_manage/app_power_mg.c  # 电源管理
│   │   └── start/bd47/main.c
│   ├── demo/transfer/     # 应用模板
│   │   ├── app_main.c     # 主程序
│   │   ├── board/bd47/board_config.h  # 板级配置
│   │   └── include/app_config.h       # 应用配置
│   └── include_lib/       # SDK头文件
│       ├── cpu/gpio.h
│       ├── cpu/gpadc.h
│       ├── cpu/bd47/asm/power/p33/charge_hw.h
│       └── ...
├── tools/                 # 编译工具链
└── Makefile
```

#### 2️⃣ **真实代码模式**

**GPIO 初始化（led_control.c）**
```c
#define TCFG_LED_PIN1  IO_PORTA_02
#define LED1_INIT()    gpio_set_mode(IO_PORT_SPILT(TCFG_LED_PIN1), PORT_OUTPUT_LOW)
#define LED1_ON()      gpio_write(TCFG_LED_PIN1, 1)
#define LED1_OFF()     gpio_write(TCFG_LED_PIN1, 0)

static void led_operate(uint8_t state) {
    switch (state) {
    case LED_INIT:
        LED1_INIT();
        LED2_INIT();
        break;
    case LED_WAIT_CONNECT:
        led_timeout_count = (SOFT_OFF_TIME_MS / 1000) * 4;
        led_timer_start(250);  // 250ms闪烁
        led_io_flash = BIT(7) | BIT(0);
        break;
    }
}
```

**电源管理（app_power_mg.c）**
```c
#define POWEROFF_TONE_V  2500  // 2.5V低电告警
#define BATTERY_FULL_VALUE 4200

static void app_power_scan(void *priv) {
    uint16_t vol = gpadc_battery_get_voltage();
    if (vol <= LOW_POWER_VOL)  {
        low_power_cnt++;
        if (low_power_cnt == 5) {
            led_low_power(1);  // 开启低电LED闪烁
        }
        if (low_power_cnt == (LOW_POWER_SOFTOFF_TIME / LOW_POWER_CHECK_INTERVAL) + 1) {
            app_power_event_to_user(POWER_EVENT_POWER_LOW);
        }
    }
}

uint8_t app_power_get_vbat_percent(void) {
    uint16_t bat_val = app_power_get_vbat_level();
    return (uint32_t)bat_val * 100 / BATTERY_FULL_VALUE;
}
```

**充电控制（P33寄存器宏）**
```c
#define CHARGE_EN(en)       p33_fast_access(P3_CHG_CON0, BIT(0), en)
#define CHGGO_EN(en)        p33_fast_access(P3_CHG_CON0, BIT(1), en)
#define CHARGE_mA_SEL(a)    P33_CON_SET(P3_CHG_CON1, 0, 8, a)
```

#### 3️⃣ **配置文件结构**

**app_config.h**
```c
#define CONFIG_APP_LE_TRANS  1  // BLE透传应用
#define SYS_STACK_SIZE       0x600
#define BT_NK_RAM_SIZE       0x660
#define CONFIG_BT_GATT_SERVER_NUM  1
#define TCFG_LED_ENABLE      1
#define TCFG_SYS_LVD_EN      1  // 低电检测
```

**board_config.h**
```c
#define TCFG_LED_PIN1    IO_PORTA_02
#define TCFG_LED_PIN2    IO_PORTA_03
#define TCFG_UART0_BAUDRATE  1000000
#define TCFG_ADC_VBAT_CH_EN  1
```

---

## 🎯 增强目标

### 目标1：精确硬件映射
- [ ] 真实引脚分配（基于 GPIO 枚举）
- [ ] ADC 通道映射（区分 IO_PAx 和 PMU_VBAT）
- [ ] 中断优先级配置
- [ ] 内存布局（堆栈/堆/BT RAM）

### 目标2：真实项目结构
- [ ] 生成完整目录树（apps/app_main.c, board_config.h, Makefile）
- [ ] 分层架构（BSP层/应用层/配置层）
- [ ] 模块化设计（led_control.c, power_manage.c, charge.c）

### 目标3：生产级代码模板
- [ ] 状态机实现（LED 指示、充电状态）
- [ ] 定时器回调（sys_timer_add）
- [ ] 错误处理（低电保护、过温保护）
- [ ] 日志系统（LOG_TAG + log_info）

### 目标4：可编译验证
- [ ] 生成的代码可直接放入 AW31N SDK 编译
- [ ] 符合 SDK 代码规范（命名、注释、文件组织）
- [ ] 包含必要的头文件引用

---

## 🔧 实施方案

### Phase 1: 增强 chipdb.js

#### 添加真实硬件映射数据
```javascript
'AW313A': {
  // 🆕 引脚映射表
  gpio_pins: {
    PORTA: ['PA0', 'PA1', 'PA2', ...],  // IO_PORTA_00..15
    available_for_led: ['PA2', 'PA3', 'PA4'],  // 推荐LED引脚
    available_for_button: ['PA5', 'PA6'],      // 推荐按键引脚
    available_for_adc: ['PA1', 'PA7']          // ADC引脚
  },

  // 🆕 ADC通道
  adc_channels: {
    vbat: 'AD_CH_PMU_VBAT',     // 电池电压（必须用PMU通道）
    temp: 'AD_CH_IO_PA1',       // NTC温度（IO+分压）
    ntc_table: 'ntc_10k_b3950'  // NTC查表类型
  },

  // 🆕 中断优先级（从 app_main.c 提取）
  irq_priority: {
    IRQ_ADC_IP: 1,
    IRQ_TICKTMR_IP: 3,
    IRQ_BLE_EVENT_IP: 5
  },

  // 🆕 内存配置
  memory: {
    sys_stack: 0x600,
    usr_stack: 0x500,
    bt_nk_ram: 0x660,
    note: 'BLE应用总RAM约7KB'
  }
}
```

#### 添加真实外设驱动模板
```javascript
const DRIVER_TEMPLATES = {
  'led_state_machine': `
// LED状态机（仿 led_control.c）
typedef enum {
    LED_INIT,
    LED_WAIT_CONNECT,
    LED_CONNECTED,
    LED_LOW_POWER,
    LED_POWER_OFF
} led_state_t;

static uint8_t led_state = LED_INIT;
static uint32_t led_timer_id = 0;

static void led_timer_callback(void *priv) {
    // 闪烁逻辑
    if (led_io_flash & BIT(0)) {
        gpio_toggle_port(PORTA, PORT_PIN_2);
    }
    if (--led_timeout_count == 0) {
        led_operate(led_next_state);
    }
}
`,

  'power_manager': `
// 电源管理（仿 app_power_mg.c）
#define LOW_POWER_VOL        2500   // 2.5V
#define LOW_POWER_CHECK_INTERVAL  2000  // 2s扫描
#define BATTERY_FULL_VALUE   4200

static void app_power_scan(void *priv) {
    u16 vol = adc_get_voltage(AD_CH_PMU_VBAT);
    if (vol <= LOW_POWER_VOL) {
        low_power_cnt++;
        if (low_power_cnt >= 5) {
            // 触发低电告警
            led_low_power(1);
        }
    } else {
        low_power_cnt = 0;
    }
}

void app_power_init(void) {
    adc_add_sample_ch(AD_CH_PMU_VBAT);
    sys_timer_add(NULL, app_power_scan, LOW_POWER_CHECK_INTERVAL);
}
`
};
```

### Phase 2: 增强 prd.js 代码生成

#### 生成完整项目结构
```javascript
function generateProject(stateMachine) {
  return {
    'app_main.c': generateAppMain(stateMachine),
    'app_config.h': generateAppConfig(stateMachine),
    'board_config.h': generateBoardConfig(stateMachine),
    'bsp/led_control.c': generateLedDriver(stateMachine),
    'bsp/power_manage.c': generatePowerManager(stateMachine),
    'bsp/charge.c': generateChargeDriver(stateMachine),
    'Makefile': generateMakefile()
  };
}
```

#### 智能引脚分配
```javascript
function allocatePins(devices) {
  const pinMap = {};
  let ledIndex = 0, btnIndex = 0, adcIndex = 0;

  devices.forEach(dev => {
    if (dev.type === 'led') {
      pinMap[dev.id] = `IO_PORTA_0${2 + ledIndex}`;  // PA2, PA3...
      ledIndex++;
    } else if (dev.type === 'button') {
      pinMap[dev.id] = `IO_PORTA_0${5 + btnIndex}`;  // PA5, PA6...
      btnIndex++;
    } else if (dev.type === 'temp') {
      pinMap[dev.id] = `AD_CH_IO_PA1`;  // NTC固定PA1
    } else if (dev.type === 'battery') {
      pinMap[dev.id] = `AD_CH_PMU_VBAT`;  // VBAT必须用PMU通道
    }
  });
  return pinMap;
}
```

#### 生成真实 C 代码
```javascript
function generateAppMain(sm) {
  const pins = allocatePins(sm.devices);
  const inits = sm.devices.map(d => generateDeviceInit(d, pins[d.id]));
  const handlers = sm.bindings.map(b => generateEventHandler(b, pins));

  return `
#include "includes.h"
#include "app_config.h"
#include "app_main.h"
#include "gpio.h"
#include "gpadc.h"
#include "sys_timer.h"

#define LOG_TAG "[APP]"
#include "log.h"

// 设备初始化
${inits.join('\n')}

// 事件处理
${handlers.join('\n')}

void app_main(void) {
    log_info("app_main start\\n");
    
    // 硬件初始化
    ${sm.devices.map(d => `${d.id}_init();`).join('\n    ')}
    
    // 启动定时器
    sys_timer_add(NULL, app_power_scan, 2000);
    
    log_info("app init done\\n");
}
`;
}
```

### Phase 3: 添加真实硬件验证

#### 引脚冲突检测
```javascript
function validatePinAssignment(pinMap) {
  const used = new Set();
  const conflicts = [];
  
  Object.entries(pinMap).forEach(([devId, pin]) => {
    if (used.has(pin)) {
      conflicts.push(`${devId} 与其他设备共用 ${pin}`);
    }
    used.add(pin);
  });
  
  return { valid: conflicts.length === 0, conflicts };
}
```

#### 内存预算检查
```javascript
function estimateMemory(devices) {
  const ram = {
    sys_stack: 0x600,
    usr_stack: 0x500,
    bt_ram: 0xCC0,
    app_data: devices.length * 64,  // 每设备约64B
    buffers: 512
  };
  const total = Object.values(ram).reduce((a, b) => a + b);
  return { ram, total, available: 7168, enough: total < 7168 };
}
```

### Phase 4: 可视化增强

#### 在属性面板显示真实映射
```javascript
// 选中设备时显示
<div class="device-mapping">
  <h4>🔌 真实硬件映射</h4>
  <div>芯片: AW313A</div>
  <div>引脚: ${device.assignedPin}</div>
  <div>驱动: ${device.driverApi}</div>
  <div>头文件: ${device.header}</div>
</div>
```

#### 拓扑视图添加引脚标注
```svg
<!-- 设备节点显示引脚 -->
<text x="50" y="80" font-size="10" fill="#888">PA2</text>
```

---

## 📦 输出示例

### 输入：充电宝 PRD
```markdown
# 10000mAh 充电宝
- 1S锂电池 + CW2015电量计
- USB-C PD输入
- 4格电量指示灯
- 温度监控 NTC 10K
- 低电告警
```

### 输出：完整项目
```
powerbank_project/
├── app_main.c          # 主程序（含初始化、事件循环）
├── app_config.h        # 应用配置（RAM、BLE、定时器）
├── board_config.h      # 板级配置（引脚宏定义）
├── bsp/
│   ├── led_control.c   # LED状态机（4档显示）
│   ├── power_manage.c  # 电源管理（低电检测、SOC计算）
│   ├── charge.c        # 充电控制（P33寄存器操作）
│   └── cw2015.c        # I2C电量计驱动
├── Makefile           # 可直接编译
└── README.md          # 引脚映射说明、编译步骤
```

### 代码可编译性
```bash
# 复制到 AW31N SDK
cp -r powerbank_project/* AW31N/apps/app/

# 编译
cd AW31N
make

# 烧录
./tools/download.sh
```

---

## 🎯 核心价值

### 对比优化前后

| 维度 | 优化前 | 优化后 |
|------|--------|--------|
| **引脚** | 抽象 GPIO_PIN | `IO_PORTA_02` (真实枚举) |
| **API** | `gpio_init()` | `gpio_set_mode(IO_PORT_SPILT(IO_PORTA_02), PORT_OUTPUT_LOW)` |
| **结构** | 单文件伪代码 | 完整项目树（apps/bsp/config） |
| **可用性** | 需手动适配 | 可直接编译烧录 |
| **内存** | 不考虑 | 显示预算（7KB限制）|
| **验证** | 无 | 引脚冲突检测、内存检查 |

### 给 AI 的价值
当用户要求"生成充电宝代码"时，平台输出的不再是抽象伪代码，而是：
1. **可编译**的真实项目
2. 符合 **AW31N SDK 规范**
3. 包含**状态机、定时器、错误处理**等生产逻辑
4. 可作为 **TRD（技术需求文档）** 的精确蓝图

---

## 📌 实施优先级

### P0 核心（本次必做）
- [x] 增强 chipdb.js（真实引脚/ADC/中断/内存）
- [ ] 升级代码生成（完整项目结构）
- [ ] 智能引脚分配算法

### P1 重要（后续迭代）
- [ ] LED 状态机模板
- [ ] 电源管理模板
- [ ] 引脚冲突检测

### P2 优化（长期规划）
- [ ] 可视化显示引脚映射
- [ ] 导出可编译 Makefile
- [ ] 集成编译工具链

---

## 🚀 下一步行动

1. ✅ **读取 AW31N SDK 真实代码** → 提取模式
2. ⏳ **增强 chipdb.js** → 添加硬件细节
3. ⏳ **升级 prd.js** → 生成真实项目
4. ⏳ **测试验证** → 对比 SDK 示例代码

---

**目标：让平台输出的代码成为真实固件开发的起点，而非概念验证。**
