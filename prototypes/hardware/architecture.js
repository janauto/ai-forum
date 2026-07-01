/* ============================================================
 * architecture.js — 真实产品架构方案库（芯片级拓扑）
 * 描述硬件模块组合、通信协议、信号流向（不涉及底层寄存器）
 * ============================================================ */

const ProductArchitecture = (function () {

  /* ===== 产品架构方案库 ===== */
  const ARCHITECTURES = {

    /* ---------- 基础款 10000mAh 充电宝 ---------- */
    'powerbank_basic_10000': {
      name: '基础款 10000mAh 充电宝',
      capacity: '10000mAh',
      power: { input: '5V/2A, 9V/2A', output: '5V/2.4A' },

      // 硬件BOM（器件清单）
      bom: [
        { id: 'mcu', name: 'AW313A', role: '主控+电源管理', vendor: 'JIELI', note: 'BLE SOC，内置充电管理' },
        { id: 'pd_chip', name: 'HUSB238', role: 'PD协商芯片', vendor: 'HYNETEK', note: 'PD Sink，支持5V/9V/12V' },
        { id: 'gauge', name: 'CW2015', role: '电量计', vendor: 'CellWise', note: 'I2C接口，SOC算法' },
        { id: 'ntc', name: 'NTC 10K B3950', role: '温度传感器', vendor: 'Generic', note: 'β值3950，分压+ADC采样' },
        { id: 'battery', name: '18650锂电芯×2', role: '电池组', vendor: 'Generic', note: '1S2P并联，10000mAh' },
        { id: 'leds', name: 'LED 0603×4', role: '电量指示灯', vendor: 'Generic', note: '4档显示：25%/50%/75%/100%' },
        { id: 'usb_c', name: 'USB-C母座', role: '输入接口', vendor: 'Generic', note: '支持PD协议' },
        { id: 'usb_a', name: 'USB-A母座', role: '输出接口', vendor: 'Generic', note: '5V/2.4A' }
      ],

      // 拓扑节点（芯片级）
      topology: {
        nodes: [
          { id: 'mcu', label: 'AW313A\n主控SOC', type: 'chip', x: 400, y: 300, color: '#3b82f6' },
          { id: 'pd_chip', label: 'HUSB238\nPD协商', type: 'chip', x: 150, y: 200, color: '#8b5cf6' },
          { id: 'gauge', label: 'CW2015\n电量计', type: 'chip', x: 650, y: 200, color: '#8b5cf6' },
          { id: 'battery', label: '18650×2\n电池组', type: 'power', x: 650, y: 400, color: '#10b981' },
          { id: 'ntc', label: 'NTC 10K\n温度', type: 'sensor', x: 750, y: 400, color: '#f59e0b' },
          { id: 'leds', label: 'LED×4\n电量指示', type: 'indicator', x: 400, y: 150, color: '#ef4444' },
          { id: 'usb_c', label: 'USB-C\n输入', type: 'connector', x: 50, y: 300, color: '#6b7280' },
          { id: 'usb_a', label: 'USB-A\n输出', type: 'connector', x: 750, y: 300, color: '#6b7280' }
        ],

        // 连接关系（协议层）
        edges: [
          { from: 'usb_c', to: 'pd_chip', protocol: 'USB PD', label: 'PD协商', color: '#8b5cf6' },
          { from: 'pd_chip', to: 'mcu', protocol: 'I2C', label: '电压选择', color: '#3b82f6' },
          { from: 'usb_c', to: 'mcu', protocol: 'Power', label: 'VBUS充电路径', color: '#ef4444', thickness: 3 },
          { from: 'mcu', to: 'battery', protocol: 'Charge', label: '恒流恒压充电', color: '#10b981', thickness: 3 },
          { from: 'battery', to: 'gauge', protocol: 'Analog', label: 'VBAT检测', color: '#10b981' },
          { from: 'gauge', to: 'mcu', protocol: 'I2C', label: 'SOC读取', color: '#3b82f6' },
          { from: 'battery', to: 'ntc', protocol: 'Thermal', label: '温度贴合', color: '#f59e0b', style: 'dashed' },
          { from: 'ntc', to: 'mcu', protocol: 'ADC', label: '温度采样', color: '#f59e0b' },
          { from: 'mcu', to: 'leds', protocol: 'GPIO', label: 'SOC映射显示', color: '#ef4444' },
          { from: 'mcu', to: 'usb_a', protocol: 'Boost', label: '5V升压输出', color: '#10b981', thickness: 3 }
        ]
      },

      // 信号流（场景化描述）
      signal_flows: [
        {
          scenario: '充电流程',
          steps: [
            { step: 1, desc: 'USB-C插入', actors: ['usb_c'], highlight: ['usb_c'] },
            { step: 2, desc: 'HUSB238协商电压(9V)', actors: ['pd_chip'], highlight: ['usb_c', 'pd_chip'] },
            { step: 3, desc: 'PD芯片通知主控(I2C)', actors: ['pd_chip', 'mcu'], highlight: ['pd_chip', 'mcu'] },
            { step: 4, desc: '主控启动充电', actors: ['mcu'], highlight: ['mcu', 'battery'] },
            { step: 5, desc: 'CW2015监控SOC', actors: ['gauge', 'battery'], highlight: ['gauge', 'battery'] },
            { step: 6, desc: '主控读取SOC并更新LED', actors: ['mcu', 'leds'], highlight: ['mcu', 'gauge', 'leds'] },
            { step: 7, desc: '充满检测，停止充电', actors: ['mcu'], highlight: ['mcu', 'battery'] }
          ]
        },
        {
          scenario: '放电流程',
          steps: [
            { step: 1, desc: 'USB-A接入负载', actors: ['usb_a'], highlight: ['usb_a'] },
            { step: 2, desc: '主控启动升压(5V)', actors: ['mcu'], highlight: ['mcu', 'usb_a'] },
            { step: 3, desc: '电池放电', actors: ['battery'], highlight: ['battery', 'mcu'] },
            { step: 4, desc: 'CW2015更新SOC', actors: ['gauge'], highlight: ['gauge', 'battery'] },
            { step: 5, desc: '主控监控温度', actors: ['mcu', 'ntc'], highlight: ['ntc', 'mcu'] },
            { step: 6, desc: '过热则断开输出', actors: ['mcu'], highlight: ['mcu', 'usb_a'] }
          ]
        },
        {
          scenario: '过温保护',
          trigger: 'NTC温度>45°C',
          steps: [
            { step: 1, desc: 'NTC温度上升', actors: ['ntc'], highlight: ['ntc'] },
            { step: 2, desc: '主控ADC采样', actors: ['mcu', 'ntc'], highlight: ['ntc', 'mcu'] },
            { step: 3, desc: '主控判断过温', actors: ['mcu'], highlight: ['mcu'] },
            { step: 4, desc: '停止充电/放电', actors: ['mcu'], highlight: ['mcu', 'battery', 'usb_a'] },
            { step: 5, desc: 'LED闪烁红色告警', actors: ['mcu', 'leds'], highlight: ['leds'] },
            { step: 6, desc: '温度恢复，解除保护', actors: ['mcu'], highlight: ['mcu'] }
          ]
        }
      ]
    },

    /* ---------- 旗舰款 20000mAh 双向快充 ---------- */
    'powerbank_premium_20000': {
      name: '旗舰款 20000mAh 双向快充',
      capacity: '20000mAh',
      power: { input: '5-20V/3A PD 60W', output: '5-20V/5A PD 100W' },

      bom: [
        { id: 'mcu', name: 'IP5389', role: '主控SOC', vendor: 'Injoinic', note: '集成PD协议+电量计' },
        { id: 'oled', name: 'SSD1306', role: 'OLED屏', vendor: 'Solomon', note: '128×32像素，I2C接口' },
        { id: 'battery', name: '21700锂电芯×3', role: '电池组', vendor: 'Generic', note: '1S3P并联，20000mAh' },
        { id: 'ntc1', name: 'NTC 10K', role: '电池温度', vendor: 'Generic', note: '贴在电池组上' },
        { id: 'ntc2', name: 'NTC 10K', role: '主控温度', vendor: 'Generic', note: '贴在主控IC上' },
        { id: 'usb_c1', name: 'USB-C1', role: '双向接口', vendor: 'Generic', note: 'PD 双向快充' },
        { id: 'usb_c2', name: 'USB-C2', role: '输出接口', vendor: 'Generic', note: 'PD 输出100W' },
        { id: 'usb_a', name: 'USB-A', role: '输出接口', vendor: 'Generic', note: 'QC3.0 18W' }
      ],

      topology: {
        nodes: [
          { id: 'mcu', label: 'IP5389\n主控SOC\n(集成PD+电量计)', type: 'chip', x: 400, y: 300, color: '#3b82f6' },
          { id: 'oled', label: 'SSD1306\nOLED屏', type: 'display', x: 400, y: 150, color: '#8b5cf6' },
          { id: 'battery', label: '21700×3\n电池组', type: 'power', x: 650, y: 300, color: '#10b981' },
          { id: 'ntc1', label: 'NTC\n电池温度', type: 'sensor', x: 750, y: 250, color: '#f59e0b' },
          { id: 'ntc2', label: 'NTC\n主控温度', type: 'sensor', x: 500, y: 400, color: '#f59e0b' },
          { id: 'usb_c1', label: 'USB-C1\n双向60W', type: 'connector', x: 150, y: 250, color: '#6b7280' },
          { id: 'usb_c2', label: 'USB-C2\n输出100W', type: 'connector', x: 150, y: 350, color: '#6b7280' },
          { id: 'usb_a', label: 'USB-A\nQC3.0 18W', type: 'connector', x: 650, y: 150, color: '#6b7280' }
        ],

        edges: [
          { from: 'usb_c1', to: 'mcu', protocol: 'PD双向', label: '内置协议栈', color: '#8b5cf6', thickness: 3 },
          { from: 'usb_c2', to: 'mcu', protocol: 'PD输出', label: '100W', color: '#ef4444', thickness: 3 },
          { from: 'mcu', to: 'battery', protocol: 'Charge/Discharge', label: '双向管理', color: '#10b981', thickness: 3 },
          { from: 'mcu', to: 'oled', protocol: 'I2C', label: '实时显示', color: '#3b82f6' },
          { from: 'mcu', to: 'usb_a', protocol: 'QC3.0', label: '18W', color: '#10b981', thickness: 2 },
          { from: 'battery', to: 'ntc1', protocol: 'Thermal', label: '温度贴合', color: '#f59e0b', style: 'dashed' },
          { from: 'ntc1', to: 'mcu', protocol: 'ADC', label: '电池温度', color: '#f59e0b' },
          { from: 'ntc2', to: 'mcu', protocol: 'ADC', label: '主控温度', color: '#f59e0b' }
        ]
      },

      signal_flows: [
        {
          scenario: '给笔记本充电',
          steps: [
            { step: 1, desc: 'USB-C1连接笔记本', actors: ['usb_c1'], highlight: ['usb_c1'] },
            { step: 2, desc: 'PD协商20V/5A 100W', actors: ['mcu'], highlight: ['usb_c1', 'mcu'] },
            { step: 3, desc: '主控启动100W输出', actors: ['mcu'], highlight: ['mcu', 'usb_c1'] },
            { step: 4, desc: '电池放电', actors: ['battery'], highlight: ['battery', 'mcu'] },
            { step: 5, desc: 'OLED显示: "输出 20V 4.2A 84W"', actors: ['oled'], highlight: ['oled'] },
            { step: 6, desc: 'SOC实时更新', actors: ['mcu'], highlight: ['mcu', 'oled'] },
            { step: 7, desc: '低于20%停止输出', actors: ['mcu'], highlight: ['mcu', 'usb_c1'] }
          ]
        }
      ]
    }
  };

  /* ========== 接口函数 ========== */

  // 获取方案
  function getArchitecture(archId) {
    return ARCHITECTURES[archId] || null;
  }

  // 列出所有方案
  function listArchitectures() {
    return Object.keys(ARCHITECTURES).map(id => ({
      id,
      name: ARCHITECTURES[id].name,
      capacity: ARCHITECTURES[id].capacity,
      power: ARCHITECTURES[id].power
    }));
  }

  // 根据容量/功能推荐方案
  function recommendArchitecture(requirements) {
    const { capacity, pd_support, display } = requirements;

    if (capacity >= 15000 || pd_support === 'bidirectional' || display === 'oled') {
      return ARCHITECTURES['powerbank_premium_20000'];
    }
    return ARCHITECTURES['powerbank_basic_10000'];
  }

  // 导出
  return {
    getArchitecture,
    listArchitectures,
    recommendArchitecture,
    ARCHITECTURES
  };

})();

// 全局导出
window.ProductArchitecture = ProductArchitecture;
