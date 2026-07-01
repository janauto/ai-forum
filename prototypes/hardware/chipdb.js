/* ============================================================
 * chipdb.js — 真实芯片/元件参数数据库
 * 从真实 SDK/Datasheet 提取的硬件规格，用于生成精确的仿真与代码
 * ============================================================ */

/* ===== 主控芯片库 ===== */
const CHIP_DATABASE = {
  // 杰理 AW31N 系列（BLE SOC，可用于充电宝主控）
  'AW313A': {
    vendor: 'JIELI 杰理',
    core: 'BD47 (RISC)',
    freq: '160MHz (PLL)',
    package: 'QFN48/SOP28',
    features: ['BLE 5.x', 'GPADC', 'MCPWM', 'PWM_LED', '内置充电管理P33'],
    note: '真实定位为BLE SOC(鼠标/遥控器)，其P33电源/充电模块可作充电宝主控参考',

    // 🆕 真实引脚映射（从SDK gpio_hw.h提取）
    gpio_pins: {
      PORTA: ['PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA13', 'PA14', 'PA15'],
      PORTB: ['PB0', 'PB1', 'PB2', 'PB3', 'PB4', 'PB5', 'PB6', 'PB7'],
      PORTC: ['PC0', 'PC1', 'PC2', 'PC3', 'PC4', 'PC5'],
      enums: 'IO_PORTA_00..IO_PORTA_15, IO_PORTB_00..IO_PORTB_07, IO_PORTC_00..IO_PORTC_05',
      // 推荐分配（避免BLE/USB冲突）
      recommend: {
        led: ['PA2', 'PA3', 'PA4', 'PA7'],
        button: ['PA5', 'PA6', 'PA8'],
        adc: ['PA1', 'PA9'],  // NTC/外部传感器
        i2c: ['PA10(SCL)', 'PA11(SDA)'],  // 硬件I2C0
        pwm: ['PA12', 'PA13']  // 蜂鸣器/呼吸灯
      }
    },

    // 🆕 ADC通道（从SDK gpadc_hw.h提取）
    adc_channels: {
      io: ['AD_CH_IO_PA0', 'AD_CH_IO_PA1', 'AD_CH_IO_PA2', 'AD_CH_IO_PA3', 'AD_CH_IO_PA4', 'AD_CH_IO_PA5', 'AD_CH_IO_PA6', 'AD_CH_IO_PA7'],
      pmu: ['AD_CH_PMU_VBG', 'AD_CH_PMU_VBAT', 'AD_CH_PMU_VTEMP', 'AD_CH_PMU_LDO5V'],
      note: 'VBAT电池电压必须用AD_CH_PMU_VBAT，NTC温度传感器建议PA1+分压',
      resolution: '10bit(默认)/12bit(可配)',
      vref: '1.2V内部基准(VBG)'
    },

    // 🆕 中断优先级（从SDK app_main.c提取）
    irq_priority: {
      IRQ_ADC_IP: 1, IRQ_TICKTMR_IP: 3, IRQ_USB_IP: 3, IRQ_SD_IP: 3,
      IRQ_BT_TIMEBASE_IP: 6, IRQ_BLE_EVENT_IP: 5, IRQ_BLE_RX_IP: 5,
      IRQ_BTSTACK_MSG_IP: 4, IRQ_AES_IP: 3,
      note: '优先级0~7，数字越大优先级越高，BT相关中断需保持高优先级'
    },

    // 🆕 内存布局（从SDK app_config.h提取）
    memory: {
      sys_stack: '0x600 (1536B)',
      usr_stack: '0x500 (1280B)',
      sys_heap: '0x2C0 (704B)',
      bt_nk_ram: '0x660 (1632B)',
      bt_nv_ram: '0xCC0 (3264B)',
      total_ram: '~7KB',
      note: 'BLE应用需谨慎使用动态内存，栈溢出会导致死机'
    },

    peripherals: {
      gpio: {
        api: 'gpio_init(port,&cfg) / gpio_write(IO_PORTA_xx,v) / gpio_read(io)',
        modes: 'PORT_OUTPUT_LOW/HIGH, PORT_INPUT_PULLUP_10K/100K/1M, PORT_INPUT_PULLDOWN_10K…',
        drive: '2.4/8/24/64 mA (enum gpio_drive_strength)',
        macro: 'IO_PORT_SPILT(io) 展开为 port, pin',
        header: 'cpu/gpio.h'
      },
      adc: {
        resolution: '10bit(默认)/12bit(可配)',
        api: 'adc_get_voltage(ch)→mV / adc_get_value(ch) / adc_add_sample_ch(ch)',
        vref: 'VBG 1.2V内部基准',
        sample_mode: 'AD_MODE_DEFAULT(原始值) / AD_MODE_VOLTAGE(电压值mV)',
        header: 'cpu/gpadc.h'
      },
      uart: {
        count: 2,
        api: 'log_init(baud) / uart_init',
        baud: 'TCFG_UART0_BAUDRATE (常用1000000)',
        header: 'uart.h'
      },
      i2c: {
        api: 'iic_init(iic,cfg) / i2c_master_write_nbytes_to_device_reg(...) / i2c_master_read_nbytes_from_device_reg(...)',
        mode: '硬件IIC0/IIC1 + 软件IIC',
        speed: '100kHz/400kHz',
        header: 'cpu/iic_api.h'
      },
      spi: {
        api: 'spi_init / spi_dma_send',
        modes: 'Master/Slave, 4-Wire/3-Wire',
        header: 'cpu/spi.h'
      },
      pwm: {
        api: 'mcpwm_init(&cfg) / mcpwm_set_duty(id,duty) / mcpwm_set_frequency(id,align,hz)',
        led: 'pwm_led_hw_init() 呼吸灯',
        channels: 'pwm_ch0..pwm_ch7',
        duty_range: '0~10000 (0.01%精度)',
        header: 'cpu/bd47/mcpwm.h'
      },
      timer: {
        api: 'sys_timer_add(priv,func,ms) / sys_timeout_add(priv,func,ms)',
        header: 'sys_timer.h',
        note: 'sys_timer周期性，sys_timeout一次性'
      }
    },

    power: {
      vdd: 'DVDD_VOL_129V (clk_voltage_init)',
      charge: {
        regs: 'P3_CHG_CON0..4',
        en: 'CHARGE_EN(1)/CHGGO_EN(1)',
        current: 'CHARGE_mA_SEL(mA) // 0~1023mA',
        full_v: 'CHARGE_FULL_V_SEL(a) // 4.2V档位',
        full_ma: 'CHARGE_FULL_mA_SEL(a) // 截止电流档',
        full_flag: 'CHARGE_FULL_FLAG_GET()',
        trickle: 'CHG_TRICKLE_EN(1) // 预充使能',
        loops: 'CHG_CCLOOP_EN/CHG_VILOOP_EN // 恒流/恒压环',
        header: 'asm/power/p33/charge_hw.h'
      },
      ldo5v: {
        regs: 'P3_VPWR_CON0/1',
        en: 'L5V_LOAD_EN(1) // 5V输出使能',
        det: 'LDO5V_DET_GET() // 负载检测',
        note: '可用于驱动USB-A输出5V'
      },
      wdt: 'wdt_init(WDT_8S) // 看门狗8秒超时',
      soc_by: 'VBAT电压估算(无库仑计) 或外挂电量计(I2C CW2015)',
      lvd: {
        api: 'app_power_scan() // 低电检测',
        threshold: 'LOW_POWER_VOL 2500mV',
        header: 'app_power_mg.h'
      }
    },

    datasheet: 'doc/AW31N_规格书/AW313A Datasheet V1.2.pdf',
    schematic: 'doc/AW31N_原理图/',
    sdk: 'AW31N_sdk_release_v1.3.0_2026.01.15',
    sdk_path: '/Users/linxiansheng/Desktop/研发ai优化项目/AW31N_sdk_release_v1.3.0_2026.01.15 V1/AW31N',
    main_c: 'apps/app/bsp/start/bd47/main.c',
    app_template: 'apps/demo/transfer/'
  },

  // 通用充电宝主控芯片（参考型）
  'IP5328': {
    vendor: 'Injoinic 英集芯',
    type: '移动电源 SOC',
    features: ['PD 3.0', 'QC 3.0', 'SCP', 'AFC', '双向快充'],
    io: { typec: 1, usba: 2, led: 4, button: 1 },
    battery: { cells: '1S', capacity: '5000-20000mAh', protection: ['OVP', 'OCP', 'OTP', 'SCP'] },
    power: { input: '5-20V/3A', output: '5-20V/3A', efficiency: '93%' },
    datasheet: 'IP5328P_Datasheet.pdf'
  },

  'IP5389': {
    vendor: 'Injoinic 英集芯',
    type: '65W 双向快充移动电源 SOC',
    features: ['PD 3.1 140W', 'QC 4+', 'PPS', 'VOOC', '双 Type-C'],
    io: { typec: 2, usba: 1, led: 4, button: 1, oled: { res: '128x32', iface: 'I2C' } },
    battery: { cells: '2S/3S', capacity: '10000-30000mAh', protection: ['OVP', 'OCP', 'OTP', 'SCP', 'OLP'] },
    power: { input: '5-20V/3.25A', output: '5-20V/5A', efficiency: '95%' },
    gauge: { chip: 'CW2015', iface: 'I2C', addr: '0x62' },
    datasheet: 'IP5389_Datasheet.pdf'
  }
};

/* ===== 传感器/外设库 ===== */
const COMPONENT_DATABASE = {
  // 电池电量计
  'CW2015': {
    type: 'fuel_gauge',
    vendor: 'CellWise',
    iface: 'I2C',
    addr: '0x62',
    features: ['SOC 0-100%', '电压/电流/温度', '剩余容量 mAh'],
    registers: { soc: '0x04', vcell: '0x02', mode: '0x0A' },
    datasheet: 'CW2015_Datasheet.pdf'
  },

  // 温度传感器（SDK 中用 NTC + ADC）
  'NTC_10K': {
    type: 'temp_sensor',
    model: 'NTC 10K B3950',
    method: 'ADC + 查表',
    range: '-20~80°C',
    accuracy: '±1°C',
    connection: '分压电路 → ADC',
    sdk_impl: 'adc_get_voltage(AD_CH_PA1) → 查 NTC 表 → 温度'
  },

  // OLED 显示屏
  'SSD1306': {
    type: 'oled',
    vendor: 'Solomon',
    resolution: '128x64',
    color: '单色（白/蓝/黄蓝）',
    iface: 'I2C/SPI',
    addr: '0x3C/0x3D',
    driver: 'u8g2',
    datasheet: 'SSD1306_Datasheet.pdf'
  },

  // Type-C 接口芯片
  'HUSB238': {
    type: 'usb_pd',
    vendor: 'HYNETEK',
    features: ['PD Sink/Source', 'QC 3.0', '自动协商'],
    iface: 'I2C',
    addr: '0x08',
    voltages: ['5V', '9V', '12V', '15V', '20V'],
    datasheet: 'HUSB238_Datasheet.pdf'
  },

  // 4 格电量指示灯
  'LED_BAR_4': {
    type: 'led_indicator',
    leds: 4,
    control: 'GPIO × 4 或 74HC595 移位寄存器',
    colors: ['绿×4', '绿×3+黄×1', '绿×2+黄×1+红×1'],
    mapping: { '100-76': 4, '75-51': 3, '50-26': 2, '25-6': 1, '5-0': 0 }
  }
};

/* ===== 真实充电宝硬件方案参考 ===== */
const POWERBANK_REF_DESIGN = {
  'ANKER_A1287': {
    name: '安克 PowerCore 10000mAh',
    capacity: '10000mAh (37Wh)',
    battery: '2S 18650 锂电 × 2',
    chip: 'IP5328P + CW2015',
    ports: { typec: 1, usba: 1 },
    power: { input: '5V/2A 9V/2A', output: '5V/2.4A 9V/2A', max: '18W' },
    protection: ['过充', '过放', '过流', '短路', '过温 >60℃'],
    indicator: '4 LED (蓝色)',
    cert: 'CCC, CE, FCC, PSE'
  },

  'PISEN_TS-D399': {
    name: '品胜 TS-D399 快充移动电源',
    capacity: '20000mAh (74Wh)',
    battery: '3S 21700 锂电 × 3',
    chip: 'IP5389 + BQ27542',
    ports: { typec: 2, usba: 1 },
    power: { input: '5-20V/3A PD 60W', output: '5-20V/5A PD 100W', max: '100W' },
    display: 'OLED 128×32 (SSD1306)',
    features: ['双向快充', 'PD 3.0', 'QC 4+', 'PPS', '低电流模式'],
    protection: ['NTC 温度监控', 'BMS 3S 保护板', '输出限流 5A'],
    cert: '新国标 GB 4943.1-2022',
    sdk_ref: 'AW31N (可用 BD47 电源管理 + 外挂 IP5389)'
  }
};

/* ===== 代码生成模板映射（基于真实 AW31N SDK API，已核对头文件） ===== */
const CODE_GEN_TEMPLATES = {
  'gpio_init_aw31n': `
// GPIO 初始化 — 基于 AW31N SDK (cpu/gpio.h)
// 真实 API: gpio_init(port, &config) / gpio_write(io, v) / gpio_read(io)
#include "gpio.h"

void led_init(void) {
    struct gpio_config cfg = {
        .pin  = PORT_PIN_2,              // PA2
        .mode = PORT_OUTPUT_LOW,         // 输出低
        .hd   = PORT_DRIVE_STRENGT_8p0mA // 8mA 驱动
    };
    gpio_init(PORTA, &cfg);
}

void led_on(void)  { gpio_write(IO_PORTA_02, 1); }
void led_off(void) { gpio_write(IO_PORTA_02, 0); }
`,

  'adc_vbat_aw31n': `
// 电池/温度采集 — 基于 AW31N SDK (cpu/gpadc.h)
// 真实 API: adc_add_sample_ch(ch) / adc_get_voltage(ch) 单位 mV
#include "gpadc.h"

void sense_init(void) {
    adc_add_sample_ch(AD_CH_IO_PA1);     // PA1 接 NTC 分压(温度)
    adc_add_sample_ch(AD_CH_PMU_VBG);    // 内部基准
}

// 电池电压(经分压)→ SOC。本芯片无库仑计，用电压估算
u8 battery_soc_from_vbat(u32 vbat_mv) {
    if (vbat_mv >= 4200) return 100;     // 1S 锂电满电 4.2V
    if (vbat_mv <= 3000) return 0;
    return (u8)((vbat_mv - 3000) * 100 / 1200);
}

// NTC 温度: 读 PA1 电压 → 查 NTC_10K B3950 表
int read_battery_temp_c(void) {
    u32 mv = adc_get_voltage(AD_CH_IO_PA1);
    return ntc_10k_mv_to_celsius(mv);    // 查表实现
}
`,

  'charge_control_aw31n': `
// 充电控制 — 基于 AW31N SDK P33 模块 (asm/power/p33/charge_hw.h)
// 真实寄存器宏: CHARGE_EN / CHGGO_EN / CHARGE_mA_SEL / CHARGE_FULL_*
#include "asm/power/p33/charge_hw.h"

void charge_init(void) {
    CHARGE_EN(1);            // 使能充电模块 (P3_CHG_CON0 BIT0)
    CHARGE_mA_SEL(300);      // 恒流充电电流 300mA (P3_CHG_CON1/2)
    CHARGE_FULL_V_SEL(0);    // 满电电压档位 (P3_CHG_CON2[4:7])
    CHARGE_FULL_mA_SEL(1);   // 充满截止电流档 (P3_CHG_CON3)
    CHG_TRICKLE_EN(1);       // 涓流(预充)使能
    CHG_CCLOOP_EN(1);        // 恒流环使能
}

void charge_start(void) { CHGGO_EN(1); }  // 启动充电
void charge_stop(void)  { CHGGO_EN(0); }  // 停止充电(过充/过温保护时调用)

u8 is_charge_full(void) {
    return CHARGE_FULL_FLAG_GET();        // P3_ANA_READ BIT0
}
`,

  'ldo5v_output_aw31n': `
// 5V 输出/负载检测 — 基于 AW31N SDK P33 (asm/power/p33/charge_hw.h)
#include "asm/power/p33/charge_hw.h"

void output_5v_enable(u8 en) {
    L5V_LOAD_EN(en);                 // P3_VPWR_CON0 BIT0: 5V 负载开关
}
u8 is_output_loaded(void) {
    return LDO5V_DET_GET();           // 5V 负载检测
}
`,

  'i2c_oled_init': `
// OLED(SSD1306) I2C 初始化 — 基于 AW31N SDK (cpu/iic_api.h)
// 真实 API: iic_init / i2c_master_write_nbytes_to_device_reg
#include "iic_api.h"

#define OLED_IIC   0
#define OLED_ADDR  0x3C   // SSD1306 7bit 地址

void oled_init(void) {
    iic_init(OLED_IIC, NULL);
    static const u8 seq[] = {0xAE,0xD5,0x80,0xA8,0x3F,0xD3,0x00,
                             0x40,0x8D,0x14,0x20,0x00,0xA1,0xC8,0xAF};
    for (u8 i = 0; i < sizeof(seq); i++)
        i2c_master_write_nbytes_to_device_reg(OLED_IIC, OLED_ADDR, 0x00, 1, &seq[i], 1);
}
`,

  'pwm_buzzer_aw31n': `
// 蜂鸣器 PWM — 基于 AW31N SDK (cpu/bd47/mcpwm.h)
// 真实 API: mcpwm_init / mcpwm_set_frequency / mcpwm_set_duty
#include "mcpwm.h"

static int buz_id;
void buzzer_init(void) {
    struct mcpwm_config cfg = {0};
    cfg.pwm_ch  = pwm_ch0;
    cfg.frequency = 2000;          // 2kHz
    cfg.duty    = 5000;            // 50% (0~10000)
    buz_id = mcpwm_init(&cfg);
}
void buzzer_beep(u8 on) {
    if (on) mcpwm_start(buz_id);
    else    mcpwm_pause(buz_id);
}
`
};

/* ===== 导出接口 ===== */
function getChipSpec(chipModel) {
  return CHIP_DATABASE[chipModel] || null;
}

function getComponentSpec(partModel) {
  return COMPONENT_DATABASE[partModel] || null;
}

function getRefDesign(productModel) {
  return POWERBANK_REF_DESIGN[productModel] || null;
}

function getCodeTemplate(templateName) {
  return CODE_GEN_TEMPLATES[templateName] || '';
}

// 为设备生成真实的芯片映射
function mapDeviceToRealChip(deviceType) {
  const mapping = {
    battery: { chip: 'AW313A', peripheral: 'ADC(VBAT)', gauge: 'CW2015' },
    usb_c: { chip: 'HUSB238', protocol: 'PD 3.0' },
    usb_a: { chip: 'IP5328', port: 'VBUS_OUT' },
    temp: { sensor: 'NTC_10K', adc: 'AD_CH_PA1', chip: 'AW313A' },
    oled: { ic: 'SSD1306', iface: 'I2C', addr: '0x3C' },
    power_led: { type: 'LED_BAR_4', control: 'GPIO×4' },
    led: { control: 'GPIO', chip: 'AW313A' },
    buzzer: { control: 'PWM', chip: 'AW313A', freq: '2kHz' },
    button: { control: 'GPIO', chip: 'AW313A', mode: 'INPUT_PULLUP_10K' }
  };
  return mapping[deviceType] || { chip: 'Generic' };
}

window.ChipDB = {
  getChipSpec,
  getComponentSpec,
  getRefDesign,
  getCodeTemplate,
  mapDeviceToRealChip,
  CHIP_DATABASE,
  COMPONENT_DATABASE,
  POWERBANK_REF_DESIGN
};
