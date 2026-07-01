/* ============================================================
 * codegen_enhanced.js — 基于真实 AW31N SDK 的增强代码生成器
 * 生成可直接编译的完整项目结构
 * ============================================================ */

const CodeGenEnhanced = (function () {

  /* ========== 智能引脚分配器 ========== */
  function allocatePins(devices) {
    const chipSpec = window.ChipDB?.getChipSpec('AW313A');
    if (!chipSpec?.gpio_pins?.recommend) {
      console.warn('芯片引脚推荐配置缺失，使用默认分配');
      return allocatePinsDefault(devices);
    }

    const recommend = chipSpec.gpio_pins.recommend;
    const pinMap = {};
    const pinAssignments = [];  // 用于冲突检测

    let ledIdx = 0, btnIdx = 0, adcIdx = 0, pwmIdx = 0;

    devices.forEach(dev => {
      let pin = null;
      let enumName = null;

      switch (dev.type) {
        case 'led':
          if (ledIdx < recommend.led.length) {
            pin = recommend.led[ledIdx];
            enumName = pinToEnum(pin);
            ledIdx++;
          }
          break;

        case 'button':
          if (btnIdx < recommend.button.length) {
            pin = recommend.button[btnIdx];
            enumName = pinToEnum(pin);
            btnIdx++;
          }
          break;

        case 'temp':
        case 'humidity':
        case 'light':
          // ADC传感器
          if (adcIdx < recommend.adc.length) {
            pin = recommend.adc[adcIdx];
            enumName = `AD_CH_IO_${pin}`;
            adcIdx++;
          }
          break;

        case 'battery':
          // 电池电压必须用PMU通道
          enumName = 'AD_CH_PMU_VBAT';
          pin = 'VBAT(PMU)';
          break;

        case 'buzzer':
          // PWM蜂鸣器
          if (pwmIdx < recommend.pwm.length) {
            pin = recommend.pwm[pwmIdx];
            enumName = pinToEnum(pin);
            pwmIdx++;
          }
          break;

        case 'oled':
        case 'lcd':
          // I2C显示屏
          pin = 'I2C0';
          enumName = 'PA10(SCL)/PA11(SDA)';
          break;

        default:
          pin = 'N/A';
          enumName = 'N/A';
      }

      pinMap[dev.id] = { pin, enumName, type: dev.type };
      if (pin !== 'N/A') {
        pinAssignments.push({ devId: dev.id, pin, enumName, type: dev.type });
      }
    });

    return { pinMap, assignments: pinAssignments };
  }

  function pinToEnum(pin) {
    // PA2 -> IO_PORTA_02
    const match = pin.match(/P([ABC])(\d+)/);
    if (!match) return pin;
    const port = match[1];
    const num = match[2].padStart(2, '0');
    return `IO_PORT${port}_${num}`;
  }

  function allocatePinsDefault(devices) {
    // 后备方案
    const pinMap = {};
    let idx = 2;
    devices.forEach(dev => {
      pinMap[dev.id] = {
        pin: `PA${idx}`,
        enumName: `IO_PORTA_${idx.toString().padStart(2, '0')}`,
        type: dev.type
      };
      idx++;
    });
    return { pinMap, assignments: [] };
  }

  /* ========== 引脚冲突检测 ========== */
  function validatePins(assignments) {
    const used = new Map();
    const conflicts = [];

    assignments.forEach(({ devId, pin, enumName }) => {
      if (pin === 'N/A' || pin === 'I2C0' || pin.includes('PMU')) return;  // 跳过特殊情况

      if (used.has(pin)) {
        conflicts.push({
          pin,
          devices: [used.get(pin), devId],
          message: `引脚 ${pin} (${enumName}) 被多个设备占用`
        });
      } else {
        used.set(pin, devId);
      }
    });

    return { valid: conflicts.length === 0, conflicts };
  }

  /* ========== 内存预算估算 ========== */
  function estimateMemory(devices) {
    const chipSpec = window.ChipDB?.getChipSpec('AW313A');
    const mem = chipSpec?.memory || {};

    const baseRam = {
      sys_stack: parseInt(mem.sys_stack) || 0x600,
      usr_stack: parseInt(mem.usr_stack) || 0x500,
      sys_heap: parseInt(mem.sys_heap) || 0x2C0,
      bt_nk_ram: parseInt(mem.bt_nk_ram) || 0x660,
      bt_nv_ram: parseInt(mem.bt_nv_ram) || 0xCC0
    };

    const appData = devices.length * 64;  // 每设备约64B
    const buffers = 512;  // 缓冲区
    const total = Object.values(baseRam).reduce((a, b) => a + b, 0) + appData + buffers;
    const available = 7168;  // 7KB总RAM

    return {
      base: baseRam,
      app_data: appData,
      buffers,
      total,
      available,
      usage_percent: Math.round(total / available * 100),
      enough: total < available
    };
  }

  /* ========== 生成 board_config.h ========== */
  function generateBoardConfig(pinMap, projectName) {
    const lines = [
      `#ifndef BOARD_CONFIG_H`,
      `#define BOARD_CONFIG_H`,
      ``,
      `/* ============================================================`,
      ` * ${projectName} — 板级配置`,
      ` * 自动生成于 ${new Date().toISOString()}`,
      ` * ============================================================ */`,
      ``,
      `// 引脚定义`
    ];

    Object.entries(pinMap).forEach(([devId, info]) => {
      const macro = devId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      if (info.enumName && info.enumName !== 'N/A') {
        lines.push(`#define TCFG_${macro}_PIN    ${info.enumName}  // ${info.pin}`);
      }
    });

    lines.push(``);
    lines.push(`// 功能使能`);
    lines.push(`#define TCFG_LED_ENABLE           1`);
    lines.push(`#define TCFG_ADC_VBAT_CH_EN       1`);
    lines.push(`#define TCFG_SYS_LVD_EN           1  // 低电检测`);
    lines.push(`#define TCFG_UART0_BAUDRATE       1000000`);
    lines.push(``);
    lines.push(`#endif // BOARD_CONFIG_H`);

    return lines.join('\n');
  }

  /* ========== 生成 app_config.h ========== */
  function generateAppConfig(memEstimate) {
    const mem = memEstimate.base;
    return `#ifndef APP_CONFIG_H
#define APP_CONFIG_H

#include "board_config.h"

/* 内存配置 */
#define SYS_STACK_SIZE    0x${mem.sys_stack.toString(16).toUpperCase()}
#define USR_STACK_SIZE    0x${mem.usr_stack.toString(16).toUpperCase()}
#define SYS_HEAP_SIZE     0x${mem.sys_heap.toString(16).toUpperCase()}
#define BT_NK_RAM_SIZE    0x${mem.bt_nk_ram.toString(16).toUpperCase()}
#define BT_NV_RAM_SIZE    0x${mem.bt_nv_ram.toString(16).toUpperCase()}

/* BLE 配置 */
#define CONFIG_BT_GATT_SERVER_NUM  1
#define CONFIG_BT_GATT_CLIENT_NUM  0

/* 定时器配置 */
#define LOW_POWER_CHECK_INTERVAL   2000  // ms
#define LOW_POWER_VOL              2500  // mV

/* 电池配置 */
#define BATTERY_FULL_VALUE         4200  // mV (1S锂电4.2V)

#endif // APP_CONFIG_H
`;
  }

  /* ========== 生成设备初始化代码 ========== */
  function generateDeviceInit(device, pinInfo) {
    const { type } = device;
    const macro = device.id.toUpperCase().replace(/[^A-Z0-9]/g, '_');

    switch (type) {
      case 'led':
        return `
// LED初始化 (${device.id})
#define ${macro}_INIT()  gpio_set_mode(IO_PORT_SPILT(TCFG_${macro}_PIN), PORT_OUTPUT_LOW)
#define ${macro}_ON()    gpio_write(TCFG_${macro}_PIN, 1)
#define ${macro}_OFF()   gpio_write(TCFG_${macro}_PIN, 0)

static void ${device.id}_init(void) {
    ${macro}_INIT();
    log_info("${device.id} initialized on %s\\n", "${pinInfo.pin}");
}`;

      case 'button':
        return `
// 按键初始化 (${device.id})
static void ${device.id}_init(void) {
    gpio_set_mode(IO_PORT_SPILT(TCFG_${macro}_PIN), PORT_INPUT_PULLUP_10K);
    log_info("${device.id} initialized on %s\\n", "${pinInfo.pin}");
}

static u8 ${device.id}_read(void) {
    return gpio_read(TCFG_${macro}_PIN) == 0;  // 低电平按下
}`;

      case 'battery':
        return `
// 电池监控初始化 (${device.id})
static void ${device.id}_init(void) {
    adc_add_sample_ch(AD_CH_PMU_VBAT);
    log_info("${device.id} ADC initialized\\n");
}

static u16 ${device.id}_get_voltage_mv(void) {
    return adc_get_voltage(AD_CH_PMU_VBAT);
}

static u8 ${device.id}_get_soc_percent(void) {
    u16 vbat = ${device.id}_get_voltage_mv();
    if (vbat >= BATTERY_FULL_VALUE) return 100;
    if (vbat <= 3000) return 0;
    return (u8)((vbat - 3000) * 100 / (BATTERY_FULL_VALUE - 3000));
}`;

      case 'temp':
        return `
// 温度传感器初始化 (${device.id})
static void ${device.id}_init(void) {
    adc_add_sample_ch(${pinInfo.enumName});
    log_info("${device.id} initialized on %s\\n", "${pinInfo.pin}");
}

static int ${device.id}_read_celsius(void) {
    u32 mv = adc_get_voltage(${pinInfo.enumName});
    // NTC 10K B3950 查表（简化线性估算）
    // TODO: 实现精确查表
    return 25 + (mv - 2500) / 20;
}`;

      case 'buzzer':
        return `
// 蜂鸣器初始化 (${device.id})
static int ${device.id}_pwm_id = -1;

static void ${device.id}_init(void) {
    struct mcpwm_config cfg = {0};
    cfg.pwm_ch = pwm_ch0;
    cfg.frequency = 2000;  // 2kHz
    cfg.duty = 5000;       // 50%
    ${device.id}_pwm_id = mcpwm_init(&cfg);
    log_info("${device.id} PWM initialized\\n");
}

static void ${device.id}_beep(u8 on) {
    if (${device.id}_pwm_id < 0) return;
    if (on) mcpwm_start(${device.id}_pwm_id);
    else mcpwm_pause(${device.id}_pwm_id);
}`;

      default:
        return `// ${device.id} (${type}) — 待实现`;
    }
  }

  /* ========== 生成 app_main.c ========== */
  function generateAppMain(stateMachine, pinAlloc) {
    const { devices } = stateMachine;
    const { pinMap } = pinAlloc;

    const deviceInits = devices.map(d => generateDeviceInit(d, pinMap[d.id])).join('\n');
    const deviceInitCalls = devices.map(d => `    ${d.id}_init();`).join('\n');

    return `/* ============================================================
 * app_main.c — 应用主程序
 * 自动生成于 ${new Date().toISOString()}
 * ============================================================ */

#include "includes.h"
#include "app_config.h"
#include "app_main.h"
#include "gpio.h"
#include "gpadc.h"
#include "sys_timer.h"
#include "mcpwm.h"

#define LOG_TAG "[APP]"
#include "log.h"

/* ========== 设备初始化 ========== */
${deviceInits}

/* ========== 电源管理 ========== */
static u16 low_power_cnt = 0;

static void app_power_scan(void *priv) {
    // 检测低电
    u16 vbat = adc_get_voltage(AD_CH_PMU_VBAT);
    if (vbat <= LOW_POWER_VOL) {
        low_power_cnt++;
        log_info("Low power detected: %d mV (cnt=%d)\\n", vbat, low_power_cnt);

        if (low_power_cnt >= 5) {
            // TODO: 触发低电告警（LED闪烁/蜂鸣）
        }
    } else {
        low_power_cnt = 0;
    }
}

/* ========== 主程序 ========== */
void app_main(void) {
    log_info("========================================\\n");
    log_info("  Application Started\\n");
    log_info("  Generated by Proto//Sim Platform\\n");
    log_info("========================================\\n");

    // 初始化所有设备
${deviceInitCalls}

    // 启动电源监控定时器
    sys_timer_add(NULL, app_power_scan, LOW_POWER_CHECK_INTERVAL);

    log_info("App initialization complete\\n");
}
`;
  }

  /* ========== 主导出函数 ========== */
  function generateEnhancedCode(stateMachine, projectName = 'Powerbank') {
    const { devices } = stateMachine;

    // 1. 引脚分配
    const pinAlloc = allocatePins(devices);
    const pinValidation = validatePins(pinAlloc.assignments);

    // 2. 内存估算
    const memEstimate = estimateMemory(devices);

    // 3. 生成文件
    const files = {
      'board_config.h': generateBoardConfig(pinAlloc.pinMap, projectName),
      'app_config.h': generateAppConfig(memEstimate),
      'app_main.c': generateAppMain(stateMachine, pinAlloc)
    };

    // 4. 生成报告
    const report = {
      pins: {
        assignments: pinAlloc.assignments,
        validation: pinValidation
      },
      memory: memEstimate,
      files: Object.keys(files),
      warnings: []
    };

    if (!pinValidation.valid) {
      report.warnings.push(...pinValidation.conflicts.map(c => c.message));
    }
    if (!memEstimate.enough) {
      report.warnings.push(`内存不足！预计使用 ${memEstimate.total}B，可用 ${memEstimate.available}B`);
    }

    return { files, report };
  }

  /* ========== 导出接口 ========== */
  return {
    generateEnhancedCode,
    allocatePins,
    validatePins,
    estimateMemory
  };

})();

// 全局导出
window.CodeGenEnhanced = CodeGenEnhanced;
