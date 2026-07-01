/* ============================================================
 * prd.js — PRD 解析 + 拓扑/状态机/代码生成
 * 规则解析（可替换为真实大模型调用）。
 * 解析结果是一个 plan，由 app.js 实例化为视口/设备/绑定。
 * ============================================================ */

const PRD = (function () {

  // 关键词 → 硬件类型
  const HW_KEYWORDS = [
    [/按键|按钮|key\b|button|开关(?!电源)/i, 'button'],
    [/led|指示灯|状态灯|信号灯/i, 'led'],
    [/蜂鸣器|buzzer|鸣叫|提示音|响铃|报警声/i, 'buzzer'],
    [/电机|马达|motor|风扇|水泵/i, 'motor'],
    [/继电器|relay/i, 'relay'],
    [/温度|temperature|temp\b/i, 'temp'],
    [/湿度|humidity/i, 'humidity'],
    [/光照|光强|照度|light\s*sensor|环境光/i, 'light'],
    [/运动|人体|红外|pir|移动侦测|动作传感/i, 'motion'],
    [/oled/i, 'oled'],
    [/lcd|彩屏|液晶|tft/i, 'lcd'],
    [/数码管|七段|seg/i, 'seg7'],
    [/电池|电芯|bms|锂电|移动电源/i, 'battery'],
    [/usb-?c|type-?c|pd快充|pd输入/i, 'usb_c'],
    [/usb-?a/i, 'usb_a'],
    [/电量指示|电量灯|电量显示/i, 'power_led']
  ];
  const PLAT_KEYWORDS = [
    [/ios|苹果|iphone/i, 'ios'],
    [/android|安卓/i, 'android'],
    [/小程序|微信|wechat|mini\s*program/i, 'miniapp']
  ];

  /* ---------- 主解析入口 ---------- */
  function parse(text) {
    const found = {};   // type -> count
    HW_KEYWORDS.forEach(([re, type]) => {
      const matches = text.match(new RegExp(re, 'gi'));
      if (matches) found[type] = Math.max(found[type] || 0, Math.min(matches.length, 4));
    });

    const platforms = [];
    PLAT_KEYWORDS.forEach(([re, style]) => {
      if (re.test(text)) platforms.push(style);
    });

    // 构造 plan
    const plan = { hardware: [], platforms: [], bindings: [], summary: {} };
    let keySeq = 0;
    const k = () => 'k' + (++keySeq);

    // 硬件设备
    const hwIndex = {};
    Object.entries(found).forEach(([type, count]) => {
      hwIndex[type] = [];
      const n = Math.max(1, count);
      for (let i = 0; i < n; i++) {
        const def = getDef(type);
        const key = k();
        const props = JSON.parse(JSON.stringify(def.defaultProps));
        // 编号 label/pin
        if (props.label) props.label = (type === 'button' ? 'K' : '') + (props.label) + (n > 1 ? (i + 1) : '');
        plan.hardware.push({ key, type, props });
        hwIndex[type].push(key);
      }
    });

    // 至少要有点东西
    if (plan.hardware.length === 0) {
      ['button', 'led'].forEach(type => {
        const key = k();
        plan.hardware.push({ key, type, props: JSON.parse(JSON.stringify(getDef(type).defaultProps)) });
        (hwIndex[type] = hwIndex[type] || []).push(key);
      });
    }

    // 上位机视口 + APP 控件（镜像传感器与控制）
    const platSet = platforms.length ? [...new Set(platforms)] : (/手机|app|应用|蓝牙|wifi|联动|远程|推送/i.test(text) ? ['ios'] : []);
    platSet.forEach(style => {
      const widgets = [];
      const wkeyByRole = {};
      // 传感器 → 仪表/状态卡
      ['temp', 'humidity', 'light'].forEach(t => {
        if (hwIndex[t]) {
          const wk = k();
          const titleMap = { temp: '温度', humidity: '湿度', light: '光照' };
          const unitMap = { temp: '°C', humidity: '%', light: 'lux' };
          const maxMap = { temp: 60, humidity: 100, light: 2000 };
          widgets.push({ key: wk, type: 'app_gauge', props: { title: titleMap[t], min: 0, max: maxMap[t], unit: unitMap[t] } });
          wkeyByRole['gauge_' + t] = wk;
        }
      });
      // 控制类 → 开关
      if (hwIndex.led || hwIndex.relay || hwIndex.motor) {
        const wk = k();
        widgets.push({ key: wk, type: 'app_toggle', props: { label: hwIndex.relay ? '继电器' : (hwIndex.motor ? '电机' : '指示灯') } });
        wkeyByRole['toggle_ctrl'] = wk;
      }
      // 事件日志
      const logk = k();
      widgets.push({ key: logk, type: 'app_log', props: { title: '设备事件' } });
      wkeyByRole['log'] = logk;

      plan.platforms.push({ key: k(), style, widgets, _roles: wkeyByRole });
    });

    // ---------- 推断绑定规则 ----------
    const firstLed = (hwIndex.led || [])[0];
    const firstBuzzer = (hwIndex.buzzer || [])[0];
    const firstRelay = (hwIndex.relay || [])[0];
    const firstMotor = (hwIndex.motor || [])[0];
    const firstOled = (hwIndex.oled || [])[0];
    const firstLcd = (hwIndex.lcd || [])[0];
    const display = firstOled || firstLcd;

    // 按键 → 点灯/蜂鸣
    (hwIndex.button || []).forEach((btn, i) => {
      const target = firstLed || firstRelay || firstMotor;
      if (target) plan.bindings.push({ from: btn, event: 'click', to: target, action: 'toggle' });
      if (firstBuzzer) plan.bindings.push({ from: btn, event: 'press', to: firstBuzzer, action: 'beep' });
    });

    // 运动 → 蜂鸣 + 灯 + 屏
    (hwIndex.motion || []).forEach(m => {
      if (firstBuzzer) plan.bindings.push({ from: m, event: 'detected', to: firstBuzzer, action: 'beep' });
      if (firstLed) plan.bindings.push({ from: m, event: 'detected', to: firstLed, action: 'on' });
      if (display) plan.bindings.push({ from: m, event: 'detected', to: display, action: 'setText', transform: '检测到运动!' });
    });

    // 传感器 → 屏显示
    ['temp', 'humidity', 'light'].forEach(t => {
      (hwIndex[t] || []).forEach(s => {
        const unit = { temp: 'C', humidity: '%', light: 'lux' }[t];
        const nameZh = { temp: '温度', humidity: '湿度', light: '光照' }[t];
        if (display) plan.bindings.push({ from: s, event: 'change', to: display, action: 'setText', transform: `${nameZh}:{v}${unit}` });
      });
    });

    // 传感器/控制 → 手机 APP
    plan.platforms.forEach(p => {
      const roles = p._roles;
      ['temp', 'humidity', 'light'].forEach(t => {
        if (roles['gauge_' + t] && hwIndex[t]) {
          plan.bindings.push({ from: hwIndex[t][0], event: 'change', to: roles['gauge_' + t], action: 'set' });
        }
      });
      // 手机开关 → 控制硬件
      if (roles['toggle_ctrl']) {
        const target = firstRelay || firstLed || firstMotor;
        if (target) plan.bindings.push({ from: roles['toggle_ctrl'], event: 'change', to: target, action: 'set' });
      }
      // 按键事件 → 手机日志
      (hwIndex.button || []).forEach(btn => {
        plan.bindings.push({ from: btn, event: 'click', to: roles['log'], action: 'push', transform: '按键被按下' });
      });
      (hwIndex.motion || []).forEach(m => {
        plan.bindings.push({ from: m, event: 'detected', to: roles['log'], action: 'push', transform: '运动告警' });
      });
      delete p._roles;
    });

    // 摘要
    plan.summary = {
      hardware: plan.hardware.length,
      platforms: plan.platforms.length,
      bindings: plan.bindings.length,
      types: Object.keys(found)
    };
    return plan;
  }

  /* ---------- 拓扑数据（节点 + 边） ---------- */
  function topology(project) {
    const nodes = [];
    const edges = [];
    project.viewports.forEach(vp => {
      vp.devices.forEach(d => {
        const def = getDef(d.type);
        nodes.push({ id: d.id, label: (d.props.label || d.props.title || def.name), type: d.type, group: def.category });
      });
    });
    project.bindings.forEach(b => {
      edges.push({ from: b.from, to: b.to, label: `${b.event}→${b.action}` });
    });
    return { nodes, edges };
  }

  /* ---------- 状态机 JSON（喂给 AI） ---------- */
  function stateMachine(project) {
    const devices = [];
    project.viewports.forEach(vp => vp.devices.forEach(d => {
      const def = getDef(d.type);
      devices.push({
        id: d.id, type: d.type, role: def.category,
        location: vp.type === 'mobile' ? `mobile:${vp.style}` : vp.type,
        props: d.props,
        emits: def.events || [],
        accepts: Object.keys(def.actions || {})
      });
    }));
    return {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      devices,
      transitions: project.bindings.map(b => ({
        on: { device: b.from, event: b.event },
        ...(b.condition ? { when: b.condition } : {}),
        do: { device: b.to, action: b.action, ...(b.arg ? { arg: b.arg } : {}), ...(b.transform ? { transform: b.transform } : {}) }
      })),
      meta: {
        note: '此状态机描述硬件原型的设备与联动逻辑，可投喂给大模型生成技术需求文档(TRD)或嵌入式代码。'
      }
    };
  }

  /* ---------- 嵌入式固件骨架（增强版：集成 CodeGenEnhanced） ---------- */
  function firmware(project) {
    const sm = stateMachine(project);

    // 🆕 使用增强代码生成器
    if (window.CodeGenEnhanced) {
      const enhanced = window.CodeGenEnhanced.generateEnhancedCode(sm, project.name || 'Powerbank');

      // 拼接所有文件为一个输出（用分隔符）
      let output = '';
      output += '/* ============================================================\n';
      output += ' * 完整项目代码 — 由 PROTO//SIM 增强代码生成器自动生成\n';
      output += ` * 项目: ${project.name || 'Powerbank'}\n`;
      output += ` * 生成时间: ${new Date().toISOString()}\n`;
      output += ' * 目标平台: JIELI AW31N SDK (AW31N_sdk_release_v1.3.0)\n';
      output += ' * 可直接复制到 apps/demo/ 目录编译\n';
      output += ' * ============================================================ */\n\n';

      // 添加引脚分配报告
      if (enhanced.report.pins.assignments.length > 0) {
        output += '/* ---- 引脚分配表 ---- */\n';
        output += '/*\n';
        enhanced.report.pins.assignments.forEach(({ devId, pin, enumName, type }) => {
          output += ` * ${devId.padEnd(20)} ${pin.padEnd(10)} ${enumName.padEnd(20)} (${type})\n`;
        });
        output += ' */\n\n';
      }

      // 添加内存报告
      if (enhanced.report.memory) {
        const mem = enhanced.report.memory;
        output += '/* ---- 内存预算 ---- */\n';
        output += '/*\n';
        output += ` * 系统栈:   ${mem.base.sys_stack} (0x${mem.base.sys_stack.toString(16).toUpperCase()})\n`;
        output += ` * 用户栈:   ${mem.base.usr_stack} (0x${mem.base.usr_stack.toString(16).toUpperCase()})\n`;
        output += ` * 堆:       ${mem.base.sys_heap} (0x${mem.base.sys_heap.toString(16).toUpperCase()})\n`;
        output += ` * BT RAM:   ${mem.base.bt_nk_ram + mem.base.bt_nv_ram}\n`;
        output += ` * 应用数据: ${mem.app_data}B\n`;
        output += ` * 总计:     ${mem.total}B / ${mem.available}B (${mem.usage_percent}%)\n`;
        output += ` * 状态:     ${mem.enough ? '✓ 内存充足' : '✗ 内存不足！'}\n`;
        output += ' */\n\n';
      }

      // 添加警告
      if (enhanced.report.warnings.length > 0) {
        output += '/* ⚠️  警告 ⚠️ */\n';
        output += '/*\n';
        enhanced.report.warnings.forEach(w => {
          output += ` * ${w}\n`;
        });
        output += ' */\n\n';
      }

      // 生成的文件内容
      Object.entries(enhanced.files).forEach(([filename, content]) => {
        output += `/* ============================================================\n`;
        output += ` * FILE: ${filename}\n`;
        output += ` * ============================================================ */\n\n`;
        output += content;
        output += '\n\n';
      });

      return output;
    }

    // 🔻 以下为后备方案（原有代码）
    const hw = sm.devices.filter(d => !String(d.location).startsWith('mobile') && d.role !== 'app');
    const CD = window.ChipDB;
    const has = t => hw.some(d => d.type === t);

    let out = '';
    out += '/* ============================================================\n';
    out += ' * 充电宝原型固件骨架 — 由 PROTO//SIM 自动生成\n';
    out += ' * 目标平台: JIELI AW31N (BD47核) — 参考 AW31N_sdk_release_v1.3.0\n';
    out += ' * 参考主程序: apps/app/bsp/start/bd47/main.c\n';
    out += ' * 注意: 以下 API 取自真实 SDK 头文件，引脚/参数需按实际原理图核对\n';
    out += ' * ============================================================ */\n\n';

    // 头文件
    out += '#include "gpio.h"          // cpu/gpio.h\n';
    if (has('battery') || has('temp')) out += '#include "gpadc.h"         // cpu/gpadc.h — ADC采集VBAT/NTC\n';
    if (has('battery') || has('usb_c') || has('usb_a')) out += '#include "asm/power/p33/charge_hw.h"  // P33充电/5V输出寄存器\n';
    if (has('oled')) out += '#include "iic_api.h"       // cpu/iic_api.h — OLED(SSD1306)\n';
    if (has('buzzer')) out += '#include "mcpwm.h"         // cpu/bd47/mcpwm.h — 蜂鸣器PWM\n';
    out += '#include "sys_timer.h"     // 软件定时器\n\n';

    // 引脚定义（从设备 props 推断）
    out += '/* ---- 引脚/参数定义（请按原理图修改） ---- */\n';
    hw.forEach(d => {
      const map = CD ? CD.mapDeviceToRealChip(d.type) : {};
      const nm = devName(d);
      if (d.type === 'led') out += `#define ${nm.toUpperCase()}_IO        IO_PORTA_02   // ${getDef(d.type).name} (${map.control||'GPIO'})\n`;
      else if (d.type === 'button') out += `#define ${nm.toUpperCase()}_IO       IO_PORTB_01   // ${getDef(d.type).name} (${map.mode||'输入上拉'})\n`;
      else if (d.type === 'temp') out += `#define NTC_ADC_CH       AD_CH_IO_PA1  // ${getDef(d.type).name} NTC_10K分压\n`;
      else if (d.type === 'oled') out += `#define OLED_IIC  0\n#define OLED_ADDR ${d.props.addr || '0x3C'}      // SSD1306\n`;
      else if (d.type === 'buzzer') out += `#define BUZ_FREQ  ${d.props.freq || 2000}        // ${getDef(d.type).name} PWM频率Hz\n`;
      else if (d.type === 'battery') out += `#define BAT_FULL_MV   4200      // ${d.props.capacity||''} 1S满电\n#define BAT_EMPTY_MV  3000\n#define OVER_TEMP_C   45        // 过温保护阈值(新国标)\n`;
    });

    // 初始化
    out += '\n/* ---- 外设初始化 ---- */\n';
    out += 'void board_periph_init(void) {\n';
    if (has('led')) out += '    struct gpio_config led = { .pin=PORT_PIN_2, .mode=PORT_OUTPUT_LOW, .hd=PORT_DRIVE_STRENGT_8p0mA };\n    gpio_init(PORTA, &led);\n';
    if (has('button')) out += '    struct gpio_config key = { .pin=PORT_PIN_1, .mode=PORT_INPUT_PULLUP_10K, .hd=PORT_DRIVE_STRENGT_2p4mA };\n    gpio_init(PORTB, &key);\n';
    if (has('temp')) out += '    adc_add_sample_ch(NTC_ADC_CH);\n';
    if (has('battery') || has('usb_c')) out += '    charge_init();           // 见下方 P33 充电配置\n';
    if (has('oled')) out += '    oled_init();\n';
    if (has('buzzer')) out += '    buzzer_init();\n';
    out += '}\n';

    // 充电模块（真实寄存器）
    if (has('battery') || has('usb_c')) {
      out += '\n/* ---- P33 充电控制（真实寄存器宏，charge_hw.h） ---- */\n';
      out += 'void charge_init(void) {\n    CHARGE_EN(1);          // 使能充电模块\n    CHARGE_mA_SEL(300);    // 恒流 300mA\n    CHARGE_FULL_V_SEL(0);  // 满电电压档\n    CHARGE_FULL_mA_SEL(1); // 截止电流档\n    CHG_TRICKLE_EN(1);     // 涓流\n}\n';
      out += 'void charge_start(void){ CHGGO_EN(1); }\nvoid charge_stop(void) { CHGGO_EN(0); }\nu8   is_full(void)     { return CHARGE_FULL_FLAG_GET(); }\n';
    }
    if (has('usb_a')) {
      out += '\n/* ---- 5V 输出（USB-A放电） ---- */\n';
      out += 'void output_5v(u8 en){ L5V_LOAD_EN(en); }\n';
    }

    // 事件分发（来自联动绑定）
    out += '\n/* ---- 事件→动作 状态机（来自联动拓扑） ---- */\n';
    out += 'void on_event(u16 src_id, u16 ev_type, int value) {\n';
    const bySrc = {};
    sm.transitions.forEach(t => { (bySrc[t.on.device] = bySrc[t.on.device] || []).push(t); });
    Object.entries(bySrc).forEach(([src, trans]) => {
      const sd = sm.devices.find(x => x.id === src); const sname = sd ? devName(sd) : src;
      out += `    if (src_id == ID_${sname.toUpperCase()}) {\n`;
      trans.forEach(t => {
        const td = sm.devices.find(x => x.id === t.do.device);
        const guard = t.when ? ` && value ${t.when}` : '';
        const comment = t.when ? '   // 条件保护' : '';
        out += `        if (ev_type == EV_${String(t.on.event).toUpperCase()}${guard}) ${actionCall(td, t.do)};${comment}\n`;
      });
      out += '    }\n';
    });
    out += '}\n';

    // 主循环
    out += '\n/* ---- 主循环（裸机轮询，参考 main.c 风格） ---- */\n';
    out += 'void app_main_loop(void) {\n    board_periph_init();\n    while (1) {\n';
    if (has('battery')) out += '        u32 vbat = adc_get_voltage(AD_CH_PMU_VBG); // 实际接VBAT分压通道\n        u8  soc  = battery_soc_from_vbat(vbat);\n        on_event(ID_BATTERY, EV_LEVELCHANGE, soc);\n';
    if (has('temp')) out += '        int tc = ntc_10k_mv_to_celsius(adc_get_voltage(NTC_ADC_CH));\n        on_event(ID_TEMP, EV_CHANGE, tc);   // tc>45 触发过温保护\n';
    out += '        wdt_clear();\n        delay_ms(100);\n    }\n}\n';

    return out;
  }

  function devName(d) {
    const raw = (d.props && (d.props.label || d.props.title)) || d.type;
    return String(raw).replace(/[^a-zA-Z0-9_]/g, '_');
  }
  function actionCall(td, act) {
    const n = td ? devName(td) : 'dev';
    const arg = act.transform ? JSON.stringify(act.transform) : (act.arg !== undefined && act.arg !== '' ? JSON.stringify(act.arg) : '');
    return `${n}_${act.action}(${arg})`;
  }

  return { parse, topology, stateMachine, firmware };
})();
window.PRD = PRD;
