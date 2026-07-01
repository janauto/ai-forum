/* ============================================================
 * engine.js — 联动引擎
 * 信号总线 + 绑定规则 + 仿真。
 * 设备发出事件 → 匹配 bindings → 在目标设备上执行 action。
 * ============================================================ */

const Engine = (function () {
  let project = null;
  let onLog = null;        // 日志回调
  let onSignal = null;     // 信号可视化回调（拓扑高亮）
  let running = false;

  function attach(proj, hooks) {
    project = proj;
    onLog = hooks.onLog || (() => {});
    onSignal = hooks.onSignal || (() => {});
  }

  // 找到设备对象
  function findDevice(id) {
    for (const vp of project.viewports) {
      const d = vp.devices.find(x => x.id === id);
      if (d) return d;
    }
    return null;
  }

  // 重新渲染单个设备（由 app.js 注入实现）
  let rerenderImpl = () => {};
  function setRerender(fn) { rerenderImpl = fn; }
  function rerender(id) { rerenderImpl(id); }

  /* ---- 核心：设备发出事件 ---- */
  function emit(deviceId, event, payload, depth = 0) {
    if (depth > 12) return; // 防止环路
    const src = findDevice(deviceId);
    if (!src) return;

    const label = (src.props && (src.props.label || src.props.title)) || (getDef(src.type)?.name) || src.type;
    onLog(`${label} ▸ ${event}${payload !== undefined && payload !== null ? ' = ' + payload : ''}`, 'event');

    // 找到所有匹配的绑定
    const matches = project.bindings.filter(b => b.from === deviceId && b.event === event);
    if (matches.length === 0 && depth === 0) {
      onLog(`  (无绑定) ${label}.${event}`, 'muted');
    }

    matches.forEach(b => {
      const target = findDevice(b.to);
      if (!target) return;

      // 条件门（新国标安全保护逻辑：如 >45 才触发过温保护）
      if (b.condition && !evalCond(b.condition, payload)) return;

      // 计算传给 action 的值：优先 binding.arg，其次 transform，其次 payload
      let value = payload;
      if (b.arg !== undefined && b.arg !== '') value = b.arg;
      if (b.transform) {
        try { value = applyTransform(b.transform, payload, value); } catch (e) {}
      }

      applyAction(target, b.action, value, depth);

      // 信号可视化（拓扑连线高亮）
      onSignal(b);
    });
  }

  // 条件判断：>45  <=20  ==1  !=0
  function evalCond(expr, payload) {
    const m = String(expr).trim().match(/^([<>]=?|==|!=)\s*([-\d.]+)$/);
    if (!m) return true;
    const op = m[1], n = parseFloat(m[2]), v = parseFloat(payload);
    if (isNaN(v)) return true;
    switch (op) { case '>': return v > n; case '>=': return v >= n; case '<': return v < n; case '<=': return v <= n; case '==': return v == n; case '!=': return v != n; }
    return true;
  }

  // 简单 transform：支持 ×k、+k、阈值映射 ">30?高温:正常"、模板 "温度:{v}°C"
  function applyTransform(expr, payload, fallback) {
    expr = String(expr).trim();
    // 模板字符串 {v}
    if (expr.includes('{v}')) return expr.replace(/\{v\}/g, payload);
    // 阈值: >30?A:B  或 <20?A:B
    let m = expr.match(/^([<>]=?)\s*([-\d.]+)\s*\?\s*(.*?)\s*:\s*(.*)$/);
    if (m) {
      const [, op, num, a, b] = m;
      const n = parseFloat(num), v = parseFloat(payload);
      let cond = false;
      if (op === '>') cond = v > n; else if (op === '>=') cond = v >= n;
      else if (op === '<') cond = v < n; else if (op === '<=') cond = v <= n;
      return cond ? a : b;
    }
    // 算术: *2  +10
    m = expr.match(/^([*+\-/])\s*([-\d.]+)$/);
    if (m) {
      const [, op, num] = m; const n = parseFloat(num), v = parseFloat(payload);
      if (op === '*') return v * n; if (op === '/') return v / n;
      if (op === '+') return v + n; if (op === '-') return v - n;
    }
    return fallback;
  }

  /* ---- 在目标设备上执行动作 ---- */
  function applyAction(device, action, value, depth) {
    const def = getDef(device.type);
    if (!def) return;
    const fn = def.actions && def.actions[action];
    const tLabel = (device.props && (device.props.label || device.props.title)) || def.name;

    if (fn) {
      fn(device, value, device);
      onLog(`    → ${tLabel}.${action}${value !== undefined && value !== '' ? '(' + value + ')' : ''}`, 'action');
      rerender(device.id);

      // 动作可能引发后续事件（如继电器 switch）
      if (def.events && def.events.includes('switch') && (action === 'on' || action === 'off' || action === 'toggle')) {
        emit(device.id, 'switch', device.state.closed, depth + 1);
      }
    } else {
      onLog(`    → ${tLabel}.${action} (未定义动作)`, 'muted');
    }
  }

  /* ---- 仿真：让传感器自然漂移，制造"活着"的感觉 ---- */
  let simTimer = null;
  function startSim() {
    running = true;
    onLog('▶ 仿真开始', 'sys');
    simTimer = setInterval(() => {
      // 传感器轻微漂移并触发 change
      project.viewports.forEach(vp => vp.devices.forEach(d => {
        if (['temp', 'humidity', 'light'].includes(d.type)) {
          const drift = (Math.sin(Date.now() / 3000 + d.x) ) * (d.type === 'light' ? 40 : 0.6);
          const base = d.state.value;
          const nv = Math.round((base + drift) * 10) / 10;
          if (Math.abs(nv - base) > 0.05) {
            d.state.value = nv;
            rerender(d.id);
            emit(d.id, 'change', nv, 1);
          }
        }
      }));
    }, 1500);
  }
  function stopSim() {
    running = false;
    clearInterval(simTimer);
    simTimer = null;
    onLog('■ 仿真停止', 'sys');
  }
  function isRunning() { return running; }

  return { attach, emit, findDevice, setRerender, rerender, startSim, stopSim, isRunning };
})();
window.Engine = Engine;
