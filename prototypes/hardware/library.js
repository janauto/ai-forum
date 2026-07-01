/* ============================================================
 * library.js — 设备库定义
 * 每种设备：实物渲染、可发出的事件(events)、可接收的动作(actions)
 * ============================================================ */

// 工具：HTML 转义
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ---------- 硬件设备（放置在 hardware 视口的 PCB 上） ---------- */
const HARDWARE_DEVICES = {
  button: {
    category: 'peripheral', icon: '⏺', name: '按键', desc: 'GPIO输入',
    size: { w: 88, h: 92 },
    defaultProps: { pin: 'GPIO0', mode: '上拉输入', label: 'KEY' },
    defaultState: { pressed: false },
    events: ['press', 'release', 'click'],
    actions: {},
    render(d) {
      return `
        <div class="hw-label">${esc(d.props.label || '按键')}</div>
        <button class="hw-button ${d.state.pressed ? 'pressed' : ''}"
                data-emit-down="press" data-emit-up="release" data-emit-click="click">
          <span class="hw-button-cap"></span>
        </button>
        <div class="hw-pin">${esc(d.props.pin)}</div>`;
    }
  },
  led: {
    category: 'peripheral', icon: '◉', name: 'LED', desc: 'GPIO输出',
    size: { w: 80, h: 92 },
    defaultProps: { pin: 'GPIO2', color: '#00ff88' },
    defaultState: { on: false },
    events: [],
    actions: {
      on:  (d) => d.state.on = true,
      off: (d) => d.state.on = false,
      toggle: (d) => d.state.on = !d.state.on,
      set: (d, v) => d.state.on = !!v,
      setColor: (d, v) => d.props.color = v
    },
    render(d) {
      const c = d.props.color || '#00ff88';
      return `
        <div class="hw-label">LED</div>
        <div class="hw-led ${d.state.on ? 'on' : ''}"
             style="--led-color:${esc(c)}"></div>
        <div class="hw-pin">${esc(d.props.pin)}</div>`;
    }
  },
  buzzer: {
    category: 'peripheral', icon: '♪', name: '蜂鸣器', desc: 'PWM输出',
    size: { w: 88, h: 92 },
    defaultProps: { pin: 'GPIO4', freq: 2000 },
    defaultState: { active: false },
    events: [],
    actions: {
      on: (d) => d.state.active = true,
      off: (d) => d.state.active = false,
      toggle: (d) => d.state.active = !d.state.active,
      beep: (d, v, dev) => { d.state.active = true; clearTimeout(d._t); d._t = setTimeout(() => { d.state.active = false; window.Engine && Engine.rerender(d.id); }, 600); }
    },
    render(d) {
      return `
        <div class="hw-label">蜂鸣器</div>
        <div class="hw-buzzer ${d.state.active ? 'active' : ''}">
          <span class="bz-core">♪</span>
          <span class="bz-wave"></span><span class="bz-wave"></span><span class="bz-wave"></span>
        </div>
        <div class="hw-pin">${esc(d.props.pin)}</div>`;
    }
  },
  motor: {
    category: 'peripheral', icon: '⚙', name: '电机', desc: 'PWM控制',
    size: { w: 88, h: 92 },
    defaultProps: { pin: 'GPIO5', speed: 0 },
    defaultState: { running: false, speed: 0 },
    events: [],
    actions: {
      start: (d) => { d.state.running = true; d.state.speed = d.state.speed || 60; },
      stop: (d) => { d.state.running = false; },
      toggle: (d) => { d.state.running = !d.state.running; if (d.state.running && !d.state.speed) d.state.speed = 60; },
      setSpeed: (d, v) => { d.state.speed = +v; d.state.running = +v > 0; }
    },
    render(d) {
      return `
        <div class="hw-label">电机</div>
        <div class="hw-motor ${d.state.running ? 'running' : ''}"
             style="--spin:${Math.max(0.2, 2 - (d.state.speed/100)*1.8)}s">⚙</div>
        <div class="hw-pin">${d.state.running ? d.state.speed + '%' : 'OFF'}</div>`;
    }
  },
  relay: {
    category: 'peripheral', icon: '⎍', name: '继电器', desc: '开关控制',
    size: { w: 88, h: 92 },
    defaultProps: { pin: 'GPIO12' },
    defaultState: { closed: false },
    events: ['switch'],
    actions: {
      on: (d) => d.state.closed = true,
      off: (d) => d.state.closed = false,
      toggle: (d) => d.state.closed = !d.state.closed,
      set: (d, v) => d.state.closed = !!v
    },
    render(d) {
      return `
        <div class="hw-label">继电器</div>
        <div class="hw-relay ${d.state.closed ? 'closed' : ''}">
          <span class="relay-state">${d.state.closed ? 'ON' : 'OFF'}</span>
        </div>
        <div class="hw-pin">${esc(d.props.pin)}</div>`;
    }
  },
  temp: {
    category: 'sensor', icon: '🌡', name: '温度传感器', desc: 'I2C/OneWire',
    size: { w: 120, h: 110 },
    defaultProps: { iface: 'I2C', addr: '0x48', unit: '°C' },
    defaultState: { value: 25 },
    events: ['change'],
    actions: { set: (d, v) => d.state.value = +v },
    render(d) {
      return `
        <div class="hw-label">温度</div>
        <div class="hw-sensor-value">${(+d.state.value).toFixed(1)}<small>${esc(d.props.unit)}</small></div>
        <input type="range" class="hw-slider" min="-10" max="60" step="0.5"
               value="${d.state.value}" data-emit-input="change">
        <div class="hw-pin">${esc(d.props.iface)} ${esc(d.props.addr)}</div>`;
    }
  },
  humidity: {
    category: 'sensor', icon: '💧', name: '湿度传感器', desc: 'I2C',
    size: { w: 120, h: 110 },
    defaultProps: { iface: 'I2C', addr: '0x40', unit: '%' },
    defaultState: { value: 50 },
    events: ['change'],
    actions: { set: (d, v) => d.state.value = +v },
    render(d) {
      return `
        <div class="hw-label">湿度</div>
        <div class="hw-sensor-value">${(+d.state.value).toFixed(0)}<small>${esc(d.props.unit)}</small></div>
        <input type="range" class="hw-slider" min="0" max="100" step="1"
               value="${d.state.value}" data-emit-input="change">
        <div class="hw-pin">${esc(d.props.iface)} ${esc(d.props.addr)}</div>`;
    }
  },
  light: {
    category: 'sensor', icon: '☀', name: '光照传感器', desc: 'ADC/I2C',
    size: { w: 120, h: 110 },
    defaultProps: { iface: 'ADC', pin: 'GPIO34', unit: 'lux' },
    defaultState: { value: 500 },
    events: ['change'],
    actions: { set: (d, v) => d.state.value = +v },
    render(d) {
      return `
        <div class="hw-label">光照</div>
        <div class="hw-sensor-value">${(+d.state.value).toFixed(0)}<small>${esc(d.props.unit)}</small></div>
        <input type="range" class="hw-slider" min="0" max="2000" step="10"
               value="${d.state.value}" data-emit-input="change">
        <div class="hw-pin">${esc(d.props.iface)}</div>`;
    }
  },
  motion: {
    category: 'sensor', icon: '↯', name: '运动传感器', desc: 'PIR/GPIO',
    size: { w: 100, h: 100 },
    defaultProps: { pin: 'GPIO13' },
    defaultState: { detected: false },
    events: ['detected'],
    actions: {},
    render(d) {
      return `
        <div class="hw-label">PIR运动</div>
        <button class="hw-pir ${d.state.detected ? 'detected' : ''}" data-emit-pulse="detected">
          ↯
        </button>
        <div class="hw-pin">触发检测</div>`;
    }
  },
  oled: {
    category: 'display', icon: '▭', name: 'OLED屏', desc: 'I2C 128×64',
    size: { w: 180, h: 120 },
    defaultProps: { iface: 'I2C', addr: '0x3C', res: '128x64' },
    defaultState: { text: 'READY', line2: '' },
    events: [],
    actions: {
      setText: (d, v) => d.state.text = String(v),
      setLine2: (d, v) => d.state.line2 = String(v),
      clear: (d) => { d.state.text = ''; d.state.line2 = ''; }
    },
    render(d) {
      return `
        <div class="hw-label">OLED</div>
        <div class="hw-oled">
          <div class="oled-text">${esc(d.state.text)}</div>
          <div class="oled-line2">${esc(d.state.line2 || '')}</div>
        </div>
        <div class="hw-pin">${esc(d.props.addr)}</div>`;
    }
  },
  lcd: {
    category: 'display', icon: '▬', name: 'LCD屏', desc: 'SPI 彩屏',
    size: { w: 200, h: 150 },
    defaultProps: { iface: 'SPI', res: '240x320' },
    defaultState: { text: 'HELLO', color: '#00d9ff' },
    events: [],
    actions: {
      setText: (d, v) => d.state.text = String(v),
      setColor: (d, v) => d.state.color = v,
      clear: (d) => d.state.text = ''
    },
    render(d) {
      return `
        <div class="hw-label">LCD</div>
        <div class="hw-lcd" style="--lcd-color:${esc(d.state.color)}">
          <div class="lcd-text">${esc(d.state.text)}</div>
        </div>
        <div class="hw-pin">${esc(d.props.res)}</div>`;
    }
  },
  seg7: {
    category: 'display', icon: '⚏', name: '数码管', desc: 'GPIO 4位',
    size: { w: 140, h: 92 },
    defaultProps: { pin: 'GPIO16' },
    defaultState: { value: '0000' },
    events: [],
    actions: {
      setValue: (d, v) => d.state.value = String(v).slice(0, 4).padStart(4, '0'),
      clear: (d) => d.state.value = '0000'
    },
    render(d) {
      const digits = String(d.state.value).slice(0, 4).padStart(4, '0');
      return `
        <div class="hw-label">数码管</div>
        <div class="hw-seg7">${[...digits].map(n => `<span class="seg-digit">${esc(n)}</span>`).join('')}</div>
        <div class="hw-pin">${esc(d.props.pin)}</div>`;
    }
  },

  /* ---------- 真实芯片组件（可交互的IC芯片） ---------- */
  chip_mcu: {
    category: 'chip', icon: '⬛', name: '主控芯片', desc: '可选型号',
    size: { w: 160, h: 120 },
    defaultProps: { model: 'AW313A', vendor: 'JIELI', package: 'QFN48' },
    defaultState: { status: 'idle', temp: 25 },
    events: ['overheat', 'ready'],
    actions: {
      setModel: (d, v) => d.props.model = v,
      powerOn: (d) => d.state.status = 'running',
      powerOff: (d) => d.state.status = 'idle'
    },
    render(d) {
      const statusColor = d.state.status === 'running' ? '#10b981' : '#6b7280';
      return `
        <div class="hw-label">${esc(d.props.model || 'MCU')}</div>
        <div class="hw-chip" style="border-color: ${statusColor}">
          <div class="chip-body">
            <div class="chip-pins chip-pins-left"></div>
            <div class="chip-pins chip-pins-right"></div>
            <div class="chip-label">${esc(d.props.model || 'MCU')}</div>
            <div class="chip-status">${d.state.status === 'running' ? '●' : '○'}</div>
          </div>
        </div>
        <div class="hw-pin">${esc(d.props.vendor)} ${esc(d.props.package)}</div>`;
    }
  },

  chip_pd: {
    category: 'chip', icon: '⬛', name: 'PD协商芯片', desc: 'USB-C快充',
    size: { w: 140, h: 100 },
    defaultProps: { model: 'HUSB238', addr: '0x08' },
    defaultState: { voltage: 5, negotiated: false },
    events: ['negotiate', 'voltage_change'],
    actions: {
      negotiate: (d, v) => { d.state.voltage = +v || 9; d.state.negotiated = true; },
      reset: (d) => { d.state.voltage = 5; d.state.negotiated = false; }
    },
    render(d) {
      return `
        <div class="hw-label">${esc(d.props.model)}</div>
        <div class="hw-chip hw-chip-small" style="border-color: ${d.state.negotiated ? '#8b5cf6' : '#6b7280'}">
          <div class="chip-body">
            <div class="chip-label">PD</div>
            <div class="chip-value">${d.state.voltage}V</div>
          </div>
        </div>
        <div class="hw-pin">I2C: ${esc(d.props.addr)}</div>`;
    }
  },

  chip_gauge: {
    category: 'chip', icon: '⬛', name: '电量计', desc: 'I2C接口',
    size: { w: 140, h: 100 },
    defaultProps: { model: 'CW2015', addr: '0x62' },
    defaultState: { soc: 100, voltage: 4200 },
    events: ['soc_change'],
    actions: {
      updateSOC: (d, v) => d.state.soc = Math.max(0, Math.min(100, +v)),
      updateVoltage: (d, v) => d.state.voltage = +v
    },
    render(d) {
      const socColor = d.state.soc > 20 ? '#10b981' : '#ef4444';
      return `
        <div class="hw-label">${esc(d.props.model)}</div>
        <div class="hw-chip hw-chip-small" style="border-color: ${socColor}">
          <div class="chip-body">
            <div class="chip-label">电量计</div>
            <div class="chip-value">${d.state.soc}%</div>
            <div class="chip-voltage">${d.state.voltage}mV</div>
          </div>
        </div>
        <div class="hw-pin">I2C: ${esc(d.props.addr)}</div>`;
    }
  },

  chip_sensor: {
    category: 'chip', icon: '⬛', name: '传感器芯片', desc: 'I2C/SPI',
    size: { w: 120, h: 100 },
    defaultProps: { model: 'Generic', iface: 'I2C', addr: '0x00' },
    defaultState: { value: 0, unit: '' },
    events: ['change'],
    actions: {
      setValue: (d, v) => d.state.value = v,
      setUnit: (d, v) => d.state.unit = v
    },
    render(d) {
      return `
        <div class="hw-label">${esc(d.props.model)}</div>
        <div class="hw-chip hw-chip-small">
          <div class="chip-body">
            <div class="chip-value">${d.state.value}${d.state.unit}</div>
          </div>
        </div>
        <div class="hw-pin">${esc(d.props.iface)}: ${esc(d.props.addr)}</div>`;
    }
  }
};

/* ---------- 手机 APP 控件（放置在 mobile 视口内） ---------- */
const APP_WIDGETS = {
  app_status: {
    category: 'app', icon: '▦', name: '状态卡片', desc: '显示数值/状态',
    defaultProps: { title: '状态', unit: '' },
    defaultState: { value: '--' },
    events: [],
    actions: { set: (d, v) => d.state.value = v, setText: (d, v) => d.state.value = v },
    render(d) {
      return `
        <div class="app-card">
          <div class="app-card-title">${esc(d.props.title)}</div>
          <div class="app-card-value">${esc(d.state.value)}<small>${esc(d.props.unit||'')}</small></div>
        </div>`;
    }
  },
  app_button: {
    category: 'app', icon: '⬚', name: '控制按钮', desc: '点击发信号',
    defaultProps: { label: '执行' },
    defaultState: {},
    events: ['tap'],
    actions: {},
    render(d) {
      return `<button class="app-btn" data-emit-click="tap">${esc(d.props.label)}</button>`;
    }
  },
  app_toggle: {
    category: 'app', icon: '⊜', name: '开关', desc: '切换发信号',
    defaultProps: { label: '开关' },
    defaultState: { on: false },
    events: ['change', 'on', 'off'],
    actions: { set: (d, v) => d.state.on = !!v, toggle: (d) => d.state.on = !d.state.on },
    render(d) {
      return `
        <div class="app-toggle-row">
          <span>${esc(d.props.label)}</span>
          <button class="app-toggle ${d.state.on ? 'on' : ''}" data-emit-toggle="change">
            <span class="app-toggle-knob"></span>
          </button>
        </div>`;
    }
  },
  app_gauge: {
    category: 'app', icon: '◎', name: '仪表盘', desc: '环形数值',
    defaultProps: { title: '数值', min: 0, max: 100, unit: '' },
    defaultState: { value: 0 },
    events: [],
    actions: { set: (d, v) => d.state.value = +v },
    render(d) {
      const min = +d.props.min, max = +d.props.max;
      const pct = Math.max(0, Math.min(1, ((+d.state.value) - min) / (max - min || 1)));
      const deg = Math.round(pct * 360);
      return `
        <div class="app-gauge">
          <div class="gauge-ring" style="--deg:${deg}deg">
            <div class="gauge-center">
              <span class="gauge-val">${(+d.state.value).toFixed(0)}</span>
              <span class="gauge-unit">${esc(d.props.unit||'')}</span>
            </div>
          </div>
          <div class="gauge-title">${esc(d.props.title)}</div>
        </div>`;
    }
  },
  app_log: {
    category: 'app', icon: '☰', name: '事件日志', desc: '滚动消息',
    defaultProps: { title: '事件' },
    defaultState: { lines: [] },
    events: [],
    actions: {
      push: (d, v) => { d.state.lines = [...(d.state.lines||[]), String(v)].slice(-6); },
      clear: (d) => d.state.lines = []
    },
    render(d) {
      const lines = d.state.lines || [];
      return `
        <div class="app-log">
          <div class="app-log-title">${esc(d.props.title)}</div>
          <div class="app-log-body">
            ${lines.length ? lines.map(l => `<div class="app-log-line">› ${esc(l)}</div>`).join('') : '<div class="app-log-empty">暂无事件</div>'}
          </div>
        </div>`;
    }
  }
};

/* ---------- 上位机平台（拖入后创建一个新的 mobile 视口） ---------- */
const PLATFORMS = {
  ios:     { icon: '📱', name: 'iOS 应用', desc: 'BLE/WiFi', style: 'ios' },
  android: { icon: '📲', name: 'Android 应用', desc: 'BLE/WiFi', style: 'android' },
  miniapp: { icon: '◫', name: '微信小程序', desc: '网络API', style: 'miniapp' }
};

/* ---------- 电源/充电类元件（新国标充电宝场景） ---------- */
const POWER_DEVICES = {
  battery: {
    category: 'power', icon: '🔋', name: '电池组', desc: 'BMS/SOC',
    size: { w: 158, h: 124 },
    defaultProps: { capacity: '10000mAh', cells: '2S锂电', label: '电池' },
    defaultState: { soc: 60, charging: false, discharging: false },
    events: ['levelChange', 'low', 'full'],
    actions: {
      charge(d) {
        if (d.state.soc >= 100) { if (window.Engine) Engine.emit(d.id, 'full', 100, 1); return; }
        d.state.charging = true; d.state.discharging = false; d._low = false;
        clearInterval(d._t);
        d._t = setInterval(() => {
          d.state.soc = Math.max(0, Math.min(100, d.state.soc + 4));
          window.Engine && Engine.rerender(d.id);
          window.Engine && Engine.emit(d.id, 'levelChange', Math.round(d.state.soc), 1);
          if (d.state.soc >= 100) { clearInterval(d._t); d.state.charging = false; window.Engine && Engine.rerender(d.id); window.Engine && Engine.emit(d.id, 'full', 100, 1); }
        }, 650);
      },
      discharge(d) {
        if (d.state.soc <= 0) return;
        d.state.discharging = true; d.state.charging = false;
        clearInterval(d._t);
        d._t = setInterval(() => {
          d.state.soc = Math.max(0, Math.min(100, d.state.soc - 4));
          window.Engine && Engine.rerender(d.id);
          window.Engine && Engine.emit(d.id, 'levelChange', Math.round(d.state.soc), 1);
          if (d.state.soc < 20 && !d._low) { d._low = true; window.Engine && Engine.emit(d.id, 'low', Math.round(d.state.soc), 1); }
          if (d.state.soc >= 20) d._low = false;
          if (d.state.soc <= 0) { clearInterval(d._t); d.state.discharging = false; window.Engine && Engine.rerender(d.id); }
        }, 650);
      },
      stop(d) { clearInterval(d._t); d.state.charging = false; d.state.discharging = false; window.Engine && Engine.rerender(d.id); },
      set(d, v) { d.state.soc = Math.max(0, Math.min(100, +v)); }
    },
    render(d) {
      const soc = Math.round(d.state.soc);
      const color = soc > 50 ? '#10b981' : soc > 20 ? '#fbbf24' : '#ef4444';
      const cls = d.state.charging ? 'charging' : d.state.discharging ? 'discharging' : '';
      return `
        <div class="hw-label">${esc(d.props.label || '电池')} · ${esc(d.props.capacity || '')}</div>
        <div class="battery ${cls}">
          <div class="battery-body">
            <div class="battery-fill" style="width:${soc}%;background:${color}"></div>
            <div class="battery-pct">${soc}%</div>
            ${d.state.charging ? '<div class="battery-bolt">⚡</div>' : ''}
            ${d.state.discharging ? '<div class="battery-bolt out">▼</div>' : ''}
          </div>
          <div class="battery-cap"></div>
        </div>
        <input type="range" class="hw-slider" min="0" max="100" step="1" value="${soc}" data-emit-input="levelChange" data-state-key="soc">`;
    }
  },
  usb_c: {
    category: 'power', icon: '🔌', name: 'USB-C口', desc: 'PD 输入/输出',
    size: { w: 110, h: 100 },
    defaultProps: { power: '65W', role: '输入(充电)', label: 'Type-C' },
    defaultState: { plugged: false },
    events: ['plugIn', 'plugOut'],
    actions: { plug(d) { d.state.plugged = true; }, unplug(d) { d.state.plugged = false; } },
    render(d) {
      return `
        <div class="hw-label">${esc(d.props.label || 'Type-C')}</div>
        <button class="usb-port usb-c ${d.state.plugged ? 'plugged' : ''}" data-emit-plug="1" title="点击插拔">
          <span class="usb-slot"></span>
        </button>
        <div class="usb-meta">${esc(d.props.power || '')} <span class="usb-mode ${d.state.plugged ? 'on' : ''}">${d.state.plugged ? '● 已连接' : '○ 未接'}</span></div>`;
    }
  },
  usb_a: {
    category: 'power', icon: '🔋', name: 'USB-A口', desc: '输出(放电)',
    size: { w: 110, h: 100 },
    defaultProps: { power: '5V/2.4A', label: 'USB-A' },
    defaultState: { plugged: false },
    events: ['plugIn', 'plugOut'],
    actions: { plug(d) { d.state.plugged = true; }, unplug(d) { d.state.plugged = false; } },
    render(d) {
      return `
        <div class="hw-label">${esc(d.props.label || 'USB-A')}</div>
        <button class="usb-port usb-a ${d.state.plugged ? 'plugged' : ''}" data-emit-plug="1" title="点击插拔负载">
          <span class="usb-slot-a"></span>
        </button>
        <div class="usb-meta">${esc(d.props.power || '')} <span class="usb-mode ${d.state.plugged ? 'on' : ''}">${d.state.plugged ? '● 带载' : '○ 空载'}</span></div>`;
    }
  },
  power_led: {
    category: 'power', icon: '▰', name: '电量指示灯', desc: '4格LED',
    size: { w: 124, h: 84 },
    defaultProps: { label: '电量' },
    defaultState: { level: 60 },
    events: [],
    actions: { setLevel(d, v) { d.state.level = Math.max(0, Math.min(100, +v)); }, set(d, v) { d.state.level = Math.max(0, Math.min(100, +v)); } },
    render(d) {
      const lv = Math.round(d.state.level || 0);
      const bars = Math.max(0, Math.min(4, Math.ceil(lv / 25)));
      let dots = '';
      for (let i = 0; i < 4; i++) {
        const on = i < bars;
        const cl = on ? (bars <= 1 ? 'on low' : bars === 2 ? 'on mid' : 'on') : '';
        dots += `<span class="pl-bar ${cl}"></span>`;
      }
      return `<div class="hw-label">${esc(d.props.label || '电量')}</div><div class="power-led">${dots}</div><div class="hw-pin">${lv}%</div>`;
    }
  }
};
Object.assign(HARDWARE_DEVICES, POWER_DEVICES);

// 统一查表
function getDef(type) {
  return HARDWARE_DEVICES[type] || APP_WIDGETS[type] || null;
}
function isPlatform(type) { return !!PLATFORMS[type]; }
function isAppWidget(type) { return !!APP_WIDGETS[type]; }

// 左侧组件库分组（用于渲染面板）
const LIBRARY_GROUPS = [
  { id: 'peripheral', title: '外设模块', types: ['button', 'led', 'buzzer', 'motor', 'relay'] },
  { id: 'sensor', title: '传感器', types: ['temp', 'humidity', 'light', 'motion'] },
  { id: 'display', title: '显示设备', types: ['oled', 'lcd', 'seg7'] },
  { id: 'power', title: '电源/充电', types: ['battery', 'usb_c', 'usb_a', 'power_led'] },
  { id: 'app', title: 'APP控件', types: ['app_status', 'app_button', 'app_toggle', 'app_gauge', 'app_log'] },
  { id: 'host', title: '上位机', types: ['ios', 'android', 'miniapp'] }
];
