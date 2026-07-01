/* ============================================================
 * app.js — 主控制器
 * 视口管理 / 设备渲染与交互 / 拖放 / 属性·联动编辑 /
 * 拓扑渲染 / PRD构建 / 仿真 / 导出
 * ============================================================ */

const project = { viewports: [], bindings: [] };
let idc = 0;
const uid = p => p + (++idc);
let selectedId = null;
let activeVpId = null;
let dragType = null;        // 从库拖拽的类型
const logBuf = [];

/* ---------- 初始化 ---------- */
document.addEventListener('DOMContentLoaded', () => {
  Engine.attach(project, { onLog: log, onSignal: onSignal });
  Engine.setRerender(rerenderDevice);
  renderLibrary();
  bindUI();
  seedDefaultProject();
  renderViewports();
  refreshMeta();
  startClock();
});

/* ---------- 默认示例工程（开箱即用演示联动） ---------- */
function seedDefaultProject() {
  const hwVp = addViewport('hardware', null, false);
  const btn = addDevice(hwVp.id, 'button', { x: 40, y: 40 });
  const led = addDevice(hwVp.id, 'led', { x: 170, y: 40 });
  const tmp = addDevice(hwVp.id, 'temp', { x: 40, y: 170 });
  const oled = addDevice(hwVp.id, 'oled', { x: 210, y: 175 });

  const mVp = addViewport('mobile', 'ios', false);
  const gauge = addDevice(mVp.id, 'app_gauge', { props: { title: '温度', min: 0, max: 60, unit: '°C' } });
  const tg = addDevice(mVp.id, 'app_toggle', { props: { label: '指示灯' } });
  const alog = addDevice(mVp.id, 'app_log', { props: { title: '设备事件' } });

  addBinding(btn.id, 'click', led.id, 'toggle');
  addBinding(btn.id, 'click', alog.id, 'push', { transform: '按键被按下' });
  addBinding(tmp.id, 'change', oled.id, 'setText', { transform: '温度:{v}C' });
  addBinding(tmp.id, 'change', gauge.id, 'set');
  addBinding(tg.id, 'change', led.id, 'set');

  setLayout(2);
}

/* ---------- 视口管理 ---------- */
function addViewport(type, style, doRender = true) {
  const titles = { hardware: '硬件原型板', mobile: (style === 'android' ? 'Android' : style === 'miniapp' ? '小程序' : 'iOS') + ' 应用', topology: '逻辑拓扑', logic: '状态逻辑' };
  const vp = { id: uid('v'), type, style: style || null, title: titles[type] || type, devices: [], maximized: false };
  project.viewports.push(vp);
  activeVpId = vp.id;
  if (doRender) { renderViewports(); refreshMeta(); }
  return vp;
}
function removeViewport(id) {
  const vp = project.viewports.find(v => v.id === id);
  if (!vp) return;
  const devIds = vp.devices.map(d => d.id);
  project.bindings = project.bindings.filter(b => !devIds.includes(b.from) && !devIds.includes(b.to));
  project.viewports = project.viewports.filter(v => v.id !== id);
  if (selectedId && devIds.includes(selectedId)) { selectedId = null; renderProps(); }
  renderViewports(); refreshMeta();
}
function setLayout(n) {
  const grid = document.getElementById('viewport-grid');
  grid.className = 'viewport-grid layout-' + n;
  document.querySelectorAll('.layout-btn').forEach(b => b.classList.toggle('active', +b.dataset.layout === n));
}

/* ---------- 设备管理 ---------- */
function addDevice(vpId, type, opts = {}) {
  const vp = project.viewports.find(v => v.id === vpId);
  const def = getDef(type);
  if (!vp || !def) return null;
  const d = {
    id: uid('d'), type, vpId,
    x: opts.x != null ? opts.x : 20, y: opts.y != null ? opts.y : 20,
    props: Object.assign(JSON.parse(JSON.stringify(def.defaultProps)), opts.props || {}),
    state: JSON.parse(JSON.stringify(def.defaultState))
  };
  vp.devices.push(d);
  return d;
}
function removeDevice(id) {
  for (const vp of project.viewports) {
    const i = vp.devices.findIndex(d => d.id === id);
    if (i > -1) {
      vp.devices.splice(i, 1);
      project.bindings = project.bindings.filter(b => b.from !== id && b.to !== id);
      if (selectedId === id) { selectedId = null; }
      renderViewports(); renderProps(); refreshMeta();
      return;
    }
  }
}
function findDevice(id) { return Engine.findDevice(id); }

/* ---------- 绑定管理 ---------- */
function addBinding(from, event, to, action, extra = {}) {
  const b = { id: uid('b'), from, event, to, action, arg: extra.arg || '', transform: extra.transform || '', condition: extra.condition || '' };
  project.bindings.push(b);
  return b;
}

/* ============================================================
 * 渲染：左侧库
 * ============================================================ */
function renderLibrary() {
  const el = document.getElementById('library-content');
  el.innerHTML = LIBRARY_GROUPS.map(g => {
    const items = g.types.map(t => {
      const def = getDef(t) || PLATFORMS[t];
      return `<div class="lib-item" draggable="true" data-type="${t}">
          <div class="lib-icon">${def.icon}</div>
          <div><div class="lib-name">${def.name}</div><div class="lib-desc">${def.desc}</div></div>
        </div>`;
    }).join('');
    return `<div class="lib-group" data-group="${g.id}">
        <div class="lib-group-header"><span class="lib-caret">▸</span><span class="lib-group-title">${g.title}</span><span class="lib-count">${g.types.length}</span></div>
        <div class="lib-items">${items}</div>
      </div>`;
  }).join('');

  el.querySelectorAll('.lib-group-header').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed')));
  el.querySelectorAll('.lib-item').forEach(it => {
    it.addEventListener('dragstart', e => { dragType = it.dataset.type; e.dataTransfer.effectAllowed = 'copy'; it.style.opacity = '.5'; });
    it.addEventListener('dragend', () => { it.style.opacity = '1'; });
    it.addEventListener('dblclick', () => quickAdd(it.dataset.type));
  });
}

// 双击库项：加到合适视口
function quickAdd(type) {
  if (isPlatform(type)) { const vp = addViewport('mobile', PLATFORMS[type].style); flash(`已创建 ${PLATFORMS[type].name} 视口`); return; }
  const wantMobile = isAppWidget(type);
  let vp = project.viewports.find(v => (wantMobile ? v.type === 'mobile' : v.type === 'hardware'));
  if (!vp) vp = addViewport(wantMobile ? 'mobile' : 'hardware', wantMobile ? 'ios' : null);
  addDevice(vp.id, type, wantMobile ? {} : { x: 30 + Math.random() * 60, y: 30 + Math.random() * 60 });
  renderViewports(); refreshMeta();
}

/* ============================================================
 * 渲染：视口网格
 * ============================================================ */
function renderViewports() {
  const grid = document.getElementById('viewport-grid');
  const anyMax = project.viewports.some(v => v.maximized);
  grid.classList.toggle('has-max', anyMax);

  grid.innerHTML = project.viewports.map(vp => {
    const typeIcon = { hardware: '🔌', mobile: (vp.style === 'android' ? '📲' : vp.style === 'miniapp' ? '◫' : '📱'), topology: '◈', logic: '⚙' }[vp.type] || '▢';
    const tag = vp.type === 'mobile' ? (vp.style || 'ios').toUpperCase() : vp.type.toUpperCase();
    return `<div class="viewport ${vp.id === activeVpId ? 'active' : ''} ${vp.maximized ? 'maximized' : ''}" data-vp="${vp.id}">
        <div class="viewport-head">
          <span class="vp-type-icon">${typeIcon}</span>
          <span class="vp-title">${vp.title}</span>
          <span class="vp-tag">${tag}</span>
          <button class="vp-ctrl max" data-act="max" title="最大化">${vp.maximized ? '❐' : '▢'}</button>
          <button class="vp-ctrl close" data-act="close" title="关闭">✕</button>
        </div>
        <div class="viewport-body ${vp.type}" data-vp-body="${vp.id}">
          ${renderViewportBody(vp)}
        </div>
      </div>`;
  }).join('');

  // 渲染拓扑（需要 DOM 尺寸）
  project.viewports.forEach(vp => { if (vp.type === 'topology') drawTopology(vp.id); });
  wireViewportEvents();
}

function renderViewportBody(vp) {
  if (vp.type === 'hardware') {
    if (!vp.devices.length) return `<div class="hw-empty"><div class="e-icon">🔌</div><div>拖入外设/传感器/显示设备</div></div>`;
    return vp.devices.map(d => renderHwDevice(d)).join('');
  }
  if (vp.type === 'mobile') return renderPhone(vp);
  if (vp.type === 'topology') return `<svg class="topo-svg"></svg><div class="topo-empty" style="display:none">暂无设备</div>`;
  return '';
}

function renderHwDevice(d) {
  const def = getDef(d.type);
  const s = def.size || { w: 90, h: 90 };
  return `<div class="device device-${d.type} ${d.id === selectedId ? 'selected' : ''}" data-device-id="${d.id}"
      style="left:${d.x}px;top:${d.y}px;width:${s.w}px;min-height:${s.h}px">${def.render(d)}</div>`;
}

function renderPhone(vp) {
  const widgets = vp.devices.length
    ? vp.devices.map(d => `<div class="app-widget ${d.id === selectedId ? 'selected' : ''}" data-device-id="${d.id}">${getDef(d.type).render(d)}<button class="w-del" data-act="wdel">✕</button></div>`).join('')
    : `<div class="mobile-empty-app">空白 App<br>从下方添加控件</div>`;
  const platName = { ios: 'iOS', android: 'Android', miniapp: '小程序' }[vp.style] || 'App';
  const addBar = ['app_status', 'app_button', 'app_toggle', 'app_gauge', 'app_log']
    .map(t => `<button class="mobile-add-btn" data-add-widget="${t}" data-vp="${vp.id}">＋${getDef(t).name}</button>`).join('');
  return `<div class="phone ${vp.style || 'ios'}">
      <div class="phone-notch"></div>
      <div class="phone-screen">
        <div class="phone-statusbar"><span>9:41</span><span>▮▮▮ ◍</span></div>
        <div class="phone-appbar"><span class="pa-dot"></span><span class="pa-title">${vp.title}</span><span class="pa-plat">${platName}</span></div>
        <div class="phone-widgets">${widgets}</div>
        <div class="mobile-add-bar">${addBar}</div>
      </div>
    </div>`;
}

/* 单设备原地刷新（交互时用，避免整体重绘） */
function rerenderDevice(id) {
  const d = findDevice(id); if (!d) return;
  const el = document.querySelector(`[data-device-id="${id}"]`); if (!el) return;
  const def = getDef(d.type);
  if (isAppWidget(d.type)) el.innerHTML = def.render(d) + `<button class="w-del" data-act="wdel">✕</button>`;
  else el.innerHTML = def.render(d);
  // 脉冲高亮
  el.classList.add('pulse'); setTimeout(() => el.classList.remove('pulse'), 500);
}

/* ============================================================
 * 视口内交互（事件委托）
 * ============================================================ */
function wireViewportEvents() {
  const grid = document.getElementById('viewport-grid');

  // 视口控制 + 选中视口
  grid.querySelectorAll('.viewport').forEach(vpEl => {
    const vpId = vpEl.dataset.vp;
    vpEl.addEventListener('mousedown', () => { activeVpId = vpId; grid.querySelectorAll('.viewport').forEach(v => v.classList.toggle('active', v.dataset.vp === vpId)); });
    vpEl.querySelector('[data-act="max"]').addEventListener('click', e => { e.stopPropagation(); const vp = project.viewports.find(v => v.id === vpId); const was = vp.maximized; project.viewports.forEach(v => v.maximized = false); vp.maximized = !was; renderViewports(); });
    vpEl.querySelector('[data-act="close"]').addEventListener('click', e => { e.stopPropagation(); removeViewport(vpId); });

    const body = vpEl.querySelector('.viewport-body');
    body.addEventListener('dragover', e => { e.preventDefault(); body.parentElement.classList.add('drop-target'); });
    body.addEventListener('dragleave', () => body.parentElement.classList.remove('drop-target'));
    body.addEventListener('drop', e => handleDrop(e, vpId));
  });

  // 手机加控件
  grid.querySelectorAll('[data-add-widget]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); addDevice(b.dataset.vp, b.dataset.addWidget, {}); renderViewports(); refreshMeta(); }));
  // 删除控件
  grid.querySelectorAll('[data-act="wdel"]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const id = b.closest('[data-device-id]').dataset.deviceId; removeDevice(id); }));

  // 交互：按下/抬起（按键）
  grid.addEventListener('mousedown', onGridMouseDown);
  grid.addEventListener('click', onGridClick);
  grid.addEventListener('input', onGridInput);
}

function isInteractive(t) { return t.closest('[data-emit-down],[data-emit-up],[data-emit-click],[data-emit-toggle],[data-emit-pulse],[data-emit-plug],[data-emit-input],.w-del,.vp-ctrl,[data-add-widget]'); }

function onGridMouseDown(e) {
  // 按键按下
  const down = e.target.closest('[data-emit-down]');
  if (down) {
    const host = down.closest('[data-device-id]'); const id = host.dataset.deviceId;
    const d = findDevice(id); if (d && 'pressed' in d.state) { d.state.pressed = true; rerenderDevice(id); }
    Engine.emit(id, down.dataset.emitDown);
    const up = () => {
      const dd = findDevice(id); if (dd && 'pressed' in dd.state) { dd.state.pressed = false; rerenderDevice(id); }
      const upAttr = down.getAttribute('data-emit-up'); if (upAttr) Engine.emit(id, upAttr);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mouseup', up);
    return;
  }
  // 设备拖动（非交互元素）
  const dev = e.target.closest('.device');
  if (dev && !isInteractive(e.target)) startDeviceDrag(e, dev);
}

function onGridClick(e) {
  const clickEl = e.target.closest('[data-emit-click]');
  if (clickEl) { const id = clickEl.closest('[data-device-id]').dataset.deviceId; Engine.emit(id, clickEl.dataset.emitClick); return; }

  const tog = e.target.closest('[data-emit-toggle]');
  if (tog) {
    const id = tog.closest('[data-device-id]').dataset.deviceId; const d = findDevice(id);
    d.state.on = !d.state.on; rerenderDevice(id);
    Engine.emit(id, tog.dataset.emitToggle, d.state.on);
    Engine.emit(id, d.state.on ? 'on' : 'off', d.state.on);
    return;
  }

  const pulse = e.target.closest('[data-emit-pulse]');
  if (pulse) {
    const id = pulse.closest('[data-device-id]').dataset.deviceId; const d = findDevice(id);
    d.state.detected = true; rerenderDevice(id);
    Engine.emit(id, pulse.dataset.emitPulse, true);
    setTimeout(() => { const dd = findDevice(id); if (dd) { dd.state.detected = false; rerenderDevice(id); } }, 800);
    return;
  }

  // 插拔（USB 接口）
  const plug = e.target.closest('[data-emit-plug]');
  if (plug) {
    const id = plug.closest('[data-device-id]').dataset.deviceId; const d = findDevice(id);
    d.state.plugged = !d.state.plugged; rerenderDevice(id);
    Engine.emit(id, d.state.plugged ? 'plugIn' : 'plugOut', d.state.plugged);
    return;
  }

  // 选中设备
  const host = e.target.closest('[data-device-id]');
  if (host && !e.target.closest('.w-del')) selectDevice(host.dataset.deviceId);
}

function onGridInput(e) {
  const sl = e.target.closest('[data-emit-input]');
  if (sl) {
    const host = sl.closest('[data-device-id]'); const id = host.dataset.deviceId; const d = findDevice(id);
    const key = sl.dataset.stateKey || 'value';
    d.state[key] = +sl.value;
    // 轻量视觉更新（不重建滑块，避免拖动丢焦点）
    const valEl = host.querySelector('.hw-sensor-value');
    if (valEl) { const unit = d.props.unit || ''; const dec = d.type === 'temp' ? 1 : 0; valEl.innerHTML = (+sl.value).toFixed(dec) + `<small>${unit}</small>`; }
    const fill = host.querySelector('.battery-fill');
    if (fill) { const soc = +sl.value; fill.style.width = soc + '%'; fill.style.background = soc > 50 ? '#10b981' : soc > 20 ? '#fbbf24' : '#ef4444'; const p = host.querySelector('.battery-pct'); if (p) p.textContent = Math.round(soc) + '%'; }
    Engine.emit(id, sl.dataset.emitInput, +sl.value);
    if (selectedId === id) syncPropsState(d);
  }
}

/* 设备在 PCB 内拖动 */
function startDeviceDrag(e, devEl) {
  e.preventDefault();
  const id = devEl.dataset.deviceId; const d = findDevice(id);
  selectDevice(id);
  const body = devEl.closest('.viewport-body');
  const bodyRect = body.getBoundingClientRect();
  const sx = e.clientX, sy = e.clientY, ox = d.x, oy = d.y;
  function move(ev) {
    d.x = Math.max(0, Math.min(ox + (ev.clientX - sx), bodyRect.width - devEl.offsetWidth));
    d.y = Math.max(0, Math.min(oy + (ev.clientY - sy), bodyRect.height - devEl.offsetHeight));
    devEl.style.left = d.x + 'px'; devEl.style.top = d.y + 'px';
  }
  function up() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
  document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
}

/* 拖放：库 → 视口 */
function handleDrop(e, vpId) {
  e.preventDefault();
  document.querySelectorAll('.viewport').forEach(v => v.classList.remove('drop-target'));
  if (!dragType) return;
  const type = dragType; dragType = null;
  const vp = project.viewports.find(v => v.id === vpId);

  if (isPlatform(type)) { addViewport('mobile', PLATFORMS[type].style); flash(`已创建 ${PLATFORMS[type].name} 视口`); return; }

  if (isAppWidget(type)) {
    if (vp.type !== 'mobile') { flash('APP控件请拖入手机视口', 'warn'); return; }
    addDevice(vpId, type, {});
  } else {
    if (vp.type !== 'hardware') { flash('硬件元件请拖入硬件视口', 'warn'); return; }
    const body = e.currentTarget.getBoundingClientRect();
    const def = getDef(type); const s = def.size || { w: 90, h: 90 };
    addDevice(vpId, type, { x: Math.max(0, e.clientX - body.left - s.w / 2), y: Math.max(0, e.clientY - body.top - s.h / 2) });
  }
  renderViewports(); refreshMeta();
}

/* ============================================================
 * 选中 & 属性面板
 * ============================================================ */
function selectDevice(id) {
  selectedId = id;
  document.querySelectorAll('[data-device-id]').forEach(el => el.classList.toggle('selected', el.dataset.deviceId === id));
  switchTab('props');
  renderProps();
}

function renderProps() {
  const el = document.getElementById('props-content');
  const d = selectedId ? findDevice(selectedId) : null;
  if (!d) { el.innerHTML = `<div class="empty-hint"><div class="empty-icon">⌖</div><div>选择一个设备查看属性</div></div>`; return; }
  const def = getDef(d.type);
  const vp = project.viewports.find(v => v.devices.includes(d));
  const propRows = Object.entries(d.props).map(([k, v]) =>
    `<div class="prop-row"><div class="prop-label">${k}</div><input class="prop-input" value="${esc(v)}" data-prop="${k}"></div>`).join('');
  const evs = (def.events || []).map(e => `<span class="chip ev">${e}</span>`).join('') || '<span class="chip">无</span>';
  const acs = Object.keys(def.actions || {}).map(a => `<span class="chip ac">${a}</span>`).join('') || '<span class="chip">无</span>';

  // 真实芯片映射（来自 chipdb.js）
  const realMap = window.ChipDB ? ChipDB.mapDeviceToRealChip(d.type) : null;
  let realHtml = '';
  if (realMap) {
    const rows = Object.entries(realMap).map(([k, v]) => `<div class="rc-row"><span class="rc-k">${k}</span><span class="rc-v">${esc(v)}</span></div>`).join('');
    const spec = realMap.chip && ChipDB.getChipSpec(realMap.chip);
    const ds = spec ? spec.datasheet : (realMap.sensor && ChipDB.getComponentSpec(realMap.sensor)?.datasheet) || (realMap.ic && ChipDB.getComponentSpec(realMap.ic)?.datasheet);
    realHtml = `<div class="prop-divider"></div>
      <div class="prop-label" style="color:var(--accent-purple)">▣ 真实硬件映射</div>
      <div class="real-chip">${rows}${ds ? `<div class="rc-row"><span class="rc-k">datasheet</span><span class="rc-v" style="font-size:9px">${esc(ds)}</span></div>` : ''}</div>`;
  }

  el.innerHTML = `<div class="prop-section">
      <div class="prop-row"><div class="prop-label">设备</div><div class="prop-value-lg">${def.icon} ${def.name}</div></div>
      <div class="prop-row"><div class="prop-label">所在视口</div><div>${vp ? vp.title : '-'}</div></div>
      <div class="prop-divider"></div>
      ${propRows}
      ${realHtml}
      <div class="prop-divider"></div>
      <div class="prop-row"><div class="prop-label">可发出事件</div><div>${evs}</div></div>
      <div class="prop-row"><div class="prop-label">可接收动作</div><div>${acs}</div></div>
      <div class="prop-row"><div class="prop-label">实时状态</div><div class="prop-state-json" style="font-size:11px;color:var(--text-muted)">${esc(JSON.stringify(d.state))}</div></div>
      <div class="prop-divider"></div>
      <button class="danger-btn" data-del-device>删除此设备</button>
    </div>`;

  el.querySelectorAll('[data-prop]').forEach(inp => inp.addEventListener('change', () => {
    d.props[inp.dataset.prop] = inp.value; rerenderDevice(d.id); updateJSON();
  }));
  el.querySelector('[data-del-device]').addEventListener('click', () => removeDevice(d.id));
}
function syncPropsState(d) { const j = document.querySelector('.prop-state-json'); if (j) j.textContent = JSON.stringify(d.state); }

/* ============================================================
 * 联动面板
 * ============================================================ */
function renderBindings() {
  const el = document.getElementById('bindings-content');
  if (!project.bindings.length) { el.innerHTML = `<div class="binding-empty">暂无联动规则<br><span style="font-size:10px">点「＋新增」或解析PRD自动生成</span></div>`; return; }
  const allDevices = []; project.viewports.forEach(v => v.devices.forEach(d => allDevices.push({ d, v })));
  const nameOf = id => { const x = allDevices.find(o => o.d.id === id); return x ? (x.d.props.label || x.d.props.title || getDef(x.d.type).name) : '?'; };

  el.innerHTML = project.bindings.map(b => `
      <div class="binding-item">
        <div class="binding-flow">
          <span class="binding-dev">${esc(nameOf(b.from))}</span>
          <span class="binding-ev">·${esc(b.event)}</span>
          ${b.condition ? `<span class="binding-cond">[${esc(b.condition)}]</span>` : ''}
          <span class="binding-arrow">→</span>
          <span class="binding-dev">${esc(nameOf(b.to))}</span>
          <span class="binding-ac">·${esc(b.action)}</span>
          <button class="binding-del" data-del="${b.id}" style="margin-left:auto">✕</button>
        </div>
        ${b.transform ? `<div class="binding-meta" style="font-size:10px;color:var(--text-muted)">变换: ${esc(b.transform)}</div>` : ''}
      </div>`).join('');
  el.querySelectorAll('[data-del]').forEach(x => x.addEventListener('click', () => { project.bindings = project.bindings.filter(b => b.id !== x.dataset.del); renderBindings(); refreshMeta(); }));
}

function openAddBinding() {
  const allDevices = []; project.viewports.forEach(v => v.devices.forEach(d => allDevices.push(d)));
  if (allDevices.length < 1) { flash('请先添加设备', 'warn'); return; }
  const devOpts = allDevices.map(d => `<option value="${d.id}">${esc(d.props.label || d.props.title || getDef(d.type).name)}</option>`).join('');
  const el = document.getElementById('bindings-content');
  const form = document.createElement('div');
  form.className = 'binding-item';
  form.innerHTML = `
    <div class="prop-label" style="margin-bottom:6px">新建联动</div>
    <div class="binding-meta"><span style="width:34px">源</span><select id="nb-from">${devOpts}</select><select id="nb-event" style="max-width:90px"></select></div>
    <div class="binding-meta" style="margin-top:6px"><span style="width:34px">目标</span><select id="nb-to">${devOpts}</select><select id="nb-action" style="max-width:90px"></select></div>
    <div class="binding-meta" style="margin-top:6px"><span style="width:34px">条件</span><input id="nb-condition" class="prop-input" style="font-size:10px;padding:4px 6px" placeholder="可选: >45  <20  ==1"></div>
    <div class="binding-meta" style="margin-top:6px"><span style="width:34px">变换</span><input id="nb-transform" class="prop-input" style="font-size:10px;padding:4px 6px" placeholder="可选: {v}  *2  >30?高:低"></div>
    <div class="binding-meta" style="margin-top:8px"><button class="mini-btn" id="nb-ok" style="flex:1">确定</button><button class="mini-btn" id="nb-cancel">取消</button></div>`;
  el.prepend(form);
  const fromSel = form.querySelector('#nb-from'), evSel = form.querySelector('#nb-event'), toSel = form.querySelector('#nb-to'), acSel = form.querySelector('#nb-action');
  const fillEvents = () => { const d = findDevice(fromSel.value); evSel.innerHTML = (getDef(d.type).events || []).map(e => `<option>${e}</option>`).join('') || '<option value="">(无)</option>'; };
  const fillActions = () => { const d = findDevice(toSel.value); acSel.innerHTML = Object.keys(getDef(d.type).actions || {}).map(a => `<option>${a}</option>`).join('') || '<option value="">(无)</option>'; };
  fromSel.addEventListener('change', fillEvents); toSel.addEventListener('change', fillActions); fillEvents(); fillActions();
  form.querySelector('#nb-ok').addEventListener('click', () => {
    if (!evSel.value || !acSel.value) { flash('该设备无可用事件/动作', 'warn'); return; }
    addBinding(fromSel.value, evSel.value, toSel.value, acSel.value, { transform: form.querySelector('#nb-transform').value, condition: form.querySelector('#nb-condition').value });
    renderBindings(); refreshMeta();
  });
  form.querySelector('#nb-cancel').addEventListener('click', renderBindings);
}

/* ============================================================
 * 拓扑渲染
 * ============================================================ */
function drawTopology(vpId) {
  const body = document.querySelector(`[data-vp-body="${vpId}"]`); if (!body) return;
  const svg = body.querySelector('.topo-svg'); const empty = body.querySelector('.topo-empty');
  const data = PRD.topology(project);
  // 排除拓扑视口自身设备（无）
  if (!data.nodes.length) { if (empty) empty.style.display = 'flex'; return; }
  if (empty) empty.style.display = 'none';

  const W = body.clientWidth || 400, colW = Math.max(120, (W - 60) / 4);
  const cats = { sensor: 0, peripheral: 1, display: 2, app: 3 };
  const colCount = {};
  const pos = {};
  data.nodes.forEach(n => {
    const c = cats[n.group] != null ? cats[n.group] : 1;
    colCount[c] = (colCount[c] || 0);
    const row = colCount[c]++;
    pos[n.id] = { x: 30 + c * colW, y: 30 + row * 64, label: n.label, group: n.group };
  });
  const H = Math.max(body.clientHeight, 30 + Math.max(...Object.values(colCount), 1) * 64 + 30);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);

  const NS = 'http://www.w3.org/2000/svg';
  let edgeHtml = '', nodeHtml = '';
  data.edges.forEach(e => {
    const a = pos[e.from], b = pos[e.to]; if (!a || !b) return;
    const x1 = a.x + 110, y1 = a.y + 16, x2 = b.x, y2 = b.y + 16;
    const mx = (x1 + x2) / 2;
    edgeHtml += `<path class="topo-edge" data-from="${e.from}" data-to="${e.to}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`;
  });
  data.nodes.forEach(n => {
    const p = pos[n.id]; const def = getDef(n.type);
    nodeHtml += `<g class="topo-node" data-node="${n.id}" transform="translate(${p.x},${p.y})">
        <rect width="110" height="32" rx="6"/>
        <text x="8" y="14">${def.icon} ${esc(p.label).slice(0,8)}</text>
        <text class="nt-cat" x="8" y="26">${n.group}</text>
      </g>`;
  });
  svg.innerHTML = edgeHtml + nodeHtml;
}

// 信号可视化：高亮拓扑边/节点
function onSignal(b) {
  document.querySelectorAll(`.topo-edge[data-from="${b.from}"][data-to="${b.to}"]`).forEach(p => { p.classList.add('live'); setTimeout(() => p.classList.remove('live'), 600); });
  [b.from, b.to].forEach(id => document.querySelectorAll(`.topo-node[data-node="${id}"]`).forEach(g => { g.classList.add('live'); setTimeout(() => g.classList.remove('live'), 600); }));
}

/* ============================================================
 * PRD / 拓扑 / 仿真 / 导出
 * ============================================================ */
function bindUI() {
  // tabs
  document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  // stage
  document.getElementById('add-hw-vp').addEventListener('click', () => addViewport('hardware'));
  document.getElementById('add-mobile-vp').addEventListener('click', () => addViewport('mobile', 'ios'));
  document.getElementById('add-topo-vp').addEventListener('click', () => { if (project.viewports.some(v => v.type === 'topology')) { flash('已有拓扑视口'); return; } addViewport('topology'); });
  document.querySelectorAll('.layout-btn').forEach(b => b.addEventListener('click', () => setLayout(+b.dataset.layout)));
  // bottom
  document.getElementById('btn-parse-prd').addEventListener('click', doParsePRD);
  document.getElementById('btn-topology').addEventListener('click', doTopology);
  document.getElementById('btn-simulate').addEventListener('click', toggleSim);
  document.getElementById('btn-export').addEventListener('click', doExport);
  document.getElementById('btn-clear').addEventListener('click', doClear);
  // right panel
  document.getElementById('add-binding').addEventListener('click', openAddBinding);
  document.getElementById('load-sample').addEventListener('click', loadSamplePRD);
  document.getElementById('btn-powerbank').addEventListener('click', loadPowerbankDemo);
  document.getElementById('copy-json').addEventListener('click', () => copyText(document.getElementById('json-output').textContent, 'JSON已复制'));
  document.getElementById('copy-code').addEventListener('click', () => copyText(document.getElementById('code-output').textContent, '代码已复制'));
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('hidden', c.id !== 'tab-' + name));
  if (name === 'bindings') renderBindings();
  if (name === 'json') updateJSON();
  if (name === 'props') renderProps();
}

function doParsePRD() {
  const text = document.getElementById('prd-input').value.trim();
  if (!text) { switchTab('prd'); flash('请先输入PRD', 'warn'); return; }
  setStatus('解析PRD中…', 'sim');
  log('⚡ 解析PRD…', 'sys');
  setTimeout(() => {
    const plan = PRD.parse(text);
    buildFromPlan(plan);
    setStatus('就绪', 'active');
    flash(`解析完成：${plan.summary.hardware}个硬件 / ${plan.summary.platforms}个上位机 / ${plan.summary.bindings}条联动`);
    log(`✓ 生成 ${plan.summary.hardware} 硬件 · ${plan.summary.bindings} 联动`, 'sys');
  }, 600);
}

function buildFromPlan(plan) {
  // 清空现有
  project.viewports = []; project.bindings = []; selectedId = null;
  const keyMap = {};
  // 硬件视口
  const hwVp = addViewport('hardware', null, false);
  let gx = 30, gy = 30, col = 0;
  plan.hardware.forEach(h => {
    const def = getDef(h.type); const s = def.size || { w: 90, h: 90 };
    const d = addDevice(hwVp.id, h.type, { x: gx, y: gy, props: h.props });
    keyMap[h.key] = d.id;
    col++; gx += 150; if (col % 3 === 0) { gx = 30; gy += 150; }
  });
  // 上位机视口
  plan.platforms.forEach(p => {
    const mVp = addViewport('mobile', p.style, false);
    p.widgets.forEach(w => { const d = addDevice(mVp.id, w.type, { props: w.props }); keyMap[w.key] = d.id; });
  });
  // 绑定
  plan.bindings.forEach(b => {
    const from = keyMap[b.from], to = keyMap[b.to];
    if (from && to) addBinding(from, to ? to : to, b.event ? b.event : b.event, b.action, { arg: b.arg, transform: b.transform });
  });
  // 修正：上面写法保证参数顺序
  // （addBinding(from,event,to,action,extra)）
  project.bindings = [];
  plan.bindings.forEach(b => { const from = keyMap[b.from], to = keyMap[b.to]; if (from && to) addBinding(from, b.event, to, b.action, { arg: b.arg, transform: b.transform }); });

  setLayout(plan.platforms.length >= 1 ? 2 : 1);
  renderViewports(); refreshMeta();
}

function doTopology() {
  if (!totalDevices()) { flash('请先添加设备或解析PRD', 'warn'); return; }
  let vp = project.viewports.find(v => v.type === 'topology');
  if (!vp) vp = addViewport('topology');
  // 确保可见
  if (project.viewports.length > 2 && !project.viewports.some(v => v.maximized)) setLayout(4);
  renderViewports();
  flash('已生成逻辑拓扑');
  log('◈ 拓扑已更新', 'sys');
}

function toggleSim() {
  const btn = document.getElementById('btn-simulate');
  if (Engine.isRunning()) {
    Engine.stopSim();
    btn.classList.remove('running'); btn.querySelector('.ab-icon').textContent = '▶'; btn.childNodes[1].textContent = ' 运行模拟';
    setStatus('就绪', 'active'); document.getElementById('sim-hint').classList.remove('live');
  } else {
    if (!totalDevices()) { flash('请先添加设备', 'warn'); return; }
    Engine.startSim();
    btn.classList.add('running'); btn.querySelector('.ab-icon').textContent = '■'; btn.childNodes[1].textContent = ' 停止模拟';
    setStatus('仿真运行中', 'sim');
    const hint = document.getElementById('sim-hint'); hint.classList.add('live'); hint.textContent = '● 仿真中：点击硬件交互，观察联动';
  }
}

function doExport() {
  if (!totalDevices()) { flash('没有可导出的内容', 'warn'); return; }
  const sm = PRD.stateMachine(project);
  const fw = PRD.firmware(project);
  document.getElementById('json-output').textContent = JSON.stringify(sm, null, 2);
  document.getElementById('code-output').textContent = fw;
  // 下载打包
  download('proto-statemachine.json', JSON.stringify(sm, null, 2));
  switchTab('code');
  flash('已生成状态机JSON + 固件骨架（JSON已下载）');
  log('↓ 导出状态机 + 代码', 'sys');
}

function doClear() {
  if (!confirm('确定清空当前工程？')) return;
  project.viewports = []; project.bindings = []; selectedId = null; idc = 0;
  renderViewports(); renderProps(); refreshMeta();
  flash('已清空');
}

function loadSamplePRD() {
  document.getElementById('prd-input').value = `# 智能环境监测灯 PRD

## 功能描述
一款带环境监测的智能灯，支持本地按键控制与手机远程联动。

## 硬件模块
- 按键：短按切换灯的开关
- LED 指示灯：显示开关状态
- 蜂鸣器：操作提示音
- 温度传感器：监测环境温度
- 湿度传感器：监测环境湿度
- OLED 屏：本地显示温湿度
- 人体红外传感器：检测有人时告警

## 上位机
- iOS App：远程查看温湿度仪表盘、远程开关灯、接收事件日志

## 交互流程
1. 用户按下按键 → LED 切换 + 蜂鸣提示
2. 温度/湿度变化 → OLED 显示 + 手机仪表盘同步
3. 检测到人体 → 蜂鸣告警 + 手机日志
4. 手机 App 开关 → 控制 LED`;
  switchTab('prd'); flash('已载入示例PRD，点「解析PRD」生成');
}

/* ============================================================
 * 新国标充电宝 Demo —— 一键从 PRD 构建完整原型
 * ============================================================ */
const POWERBANK_PRD = `# 新国标充电宝 PRD（移动电源）

## 合规背景
依据 GB 4943.1-2022 与移动电源 CCC 强制认证要求，
充电宝须具备：过充保护、过放保护、过温保护、短路/过流保护、电量指示。

## 功能描述
10000mAh 双向快充移动电源，支持 USB-C PD 输入/输出、USB-A 输出，
本地电量指示与状态显示，并可通过手机 App 远程监控电量、温度与安全告警。

## 硬件模块
- 电池组（BMS）：10000mAh，监测 SOC 电量
- USB-C 接口：65W PD，支持输入充电
- USB-A 接口：5V/2.4A 输出放电
- 4格电量指示灯：本地电量显示
- 状态 LED：充电(橙)/满电(绿)/放电(青)/故障(红)
- 电池温度传感器：过温监测
- OLED 屏：显示电量/功率/状态
- 蜂鸣器：告警与操作提示
- 电量查询按键

## 上位机
- iOS App：电量仪表盘、温度监测、充放电功率、远程输出开关、安全告警日志

## 交互流程（含新国标安全逻辑）
1. USB-C 接入 → 电池充电，状态灯橙，OLED 与 App 显示"充电 65W"
2. 充满 100% → 停止充电(过充保护)，状态灯绿，蜂鸣，App 提示已充满
3. USB-A 接入负载 → 电池放电，App 显示输出功率
4. 电量 < 20% → 低电告警(过放保护)，蜂鸣，App 告警
5. 电池温度 > 45℃ → 过温保护：切断输出 + 状态灯红 + 蜂鸣 + App 告警
6. 手机 App 远程开关 → 启用/停止输出
7. 按电量键 → 蜂鸣提示 + App 记录`;

function loadPowerbankDemo() {
  document.getElementById('prd-input').value = POWERBANK_PRD;
  setStatus('解析充电宝PRD…', 'sim');
  log('⚡ 解析PRD：识别 电池/USB-C/USB-A/温度/OLED/iOS…', 'sys');

  // 清空
  project.viewports = []; project.bindings = []; selectedId = null; idc = 0;

  // —— 硬件视口：充电宝本体 ——
  const hw = addViewport('hardware', null, false); hw.title = '充电宝本体';
  const bat = addDevice(hw.id, 'battery', { x: 26, y: 28, props: { capacity: '10000mAh', label: '电池组' } });
  const uc = addDevice(hw.id, 'usb_c', { x: 210, y: 28, props: { power: '65W', role: '输入', label: 'USB-C' } });
  const ua = addDevice(hw.id, 'usb_a', { x: 340, y: 28, props: { power: '5V/2.4A', label: 'USB-A' } });
  const pl = addDevice(hw.id, 'power_led', { x: 26, y: 184, props: { label: '电量指示' } });
  const sled = addDevice(hw.id, 'led', { x: 190, y: 188, props: { pin: 'GPIO15', color: '#10b981' } });
  const temp = addDevice(hw.id, 'temp', { x: 286, y: 170, props: { iface: 'I2C', addr: '0x48', unit: '°C' } });
  temp.state.value = 30;
  const oled = addDevice(hw.id, 'oled', { x: 26, y: 318, props: { addr: '0x3C' } });
  oled.state.text = 'STANDBY'; oled.state.line2 = 'SOC 60%';
  const buz = addDevice(hw.id, 'buzzer', { x: 240, y: 322 });
  const key = addDevice(hw.id, 'button', { x: 350, y: 322, props: { label: '电量键', pin: 'GPIO0' } });

  // —— 手机视口：充电宝管家 App ——
  const mb = addViewport('mobile', 'ios', false); mb.title = '充电宝管家';
  const gSoc = addDevice(mb.id, 'app_gauge', { props: { title: '剩余电量', min: 0, max: 100, unit: '%' } }); gSoc.state.value = 60;
  const gTemp = addDevice(mb.id, 'app_gauge', { props: { title: '电池温度', min: 0, max: 80, unit: '°C' } }); gTemp.state.value = 30;
  const stPwr = addDevice(mb.id, 'app_status', { props: { title: '工作状态', unit: '' } }); stPwr.state.value = '待机';
  const tgOut = addDevice(mb.id, 'app_toggle', { props: { label: '远程输出' } });
  const alog = addDevice(mb.id, 'app_log', { props: { title: '安全告警' } });

  // —— 联动规则（含新国标安全逻辑）——
  const B = (f, e, t, a, x) => addBinding(f, e, t, a, x || {});
  // USB-C 充电
  B(uc.id, 'plugIn', bat.id, 'charge');
  B(uc.id, 'plugIn', sled.id, 'setColor', { arg: '#fb923c' });
  B(uc.id, 'plugIn', sled.id, 'on');
  B(uc.id, 'plugIn', oled.id, 'setText', { transform: 'CHARGING' });
  B(uc.id, 'plugIn', stPwr.id, 'set', { transform: '充电中 65W' });
  B(uc.id, 'plugIn', alog.id, 'push', { transform: '⚡ USB-C接入，开始充电 65W PD' });
  B(uc.id, 'plugOut', bat.id, 'stop');
  B(uc.id, 'plugOut', sled.id, 'off');
  B(uc.id, 'plugOut', oled.id, 'setText', { transform: 'STANDBY' });
  B(uc.id, 'plugOut', stPwr.id, 'set', { transform: '待机' });
  // USB-A 放电
  B(ua.id, 'plugIn', bat.id, 'discharge');
  B(ua.id, 'plugIn', sled.id, 'setColor', { arg: '#00d9ff' });
  B(ua.id, 'plugIn', sled.id, 'on');
  B(ua.id, 'plugIn', stPwr.id, 'set', { transform: '输出中 5V/2.4A' });
  B(ua.id, 'plugIn', alog.id, 'push', { transform: '🔋 USB-A接入负载，开始放电' });
  B(ua.id, 'plugOut', bat.id, 'stop');
  B(ua.id, 'plugOut', sled.id, 'off');
  B(ua.id, 'plugOut', stPwr.id, 'set', { transform: '待机' });
  // 电量联动
  B(bat.id, 'levelChange', pl.id, 'setLevel');
  B(bat.id, 'levelChange', gSoc.id, 'set');
  B(bat.id, 'levelChange', oled.id, 'setLine2', { transform: 'SOC {v}%' });
  // 满电（过充保护）
  B(bat.id, 'full', sled.id, 'setColor', { arg: '#10b981' });
  B(bat.id, 'full', sled.id, 'on');
  B(bat.id, 'full', buz.id, 'beep');
  B(bat.id, 'full', oled.id, 'setText', { transform: 'FULL' });
  B(bat.id, 'full', stPwr.id, 'set', { transform: '已充满' });
  B(bat.id, 'full', alog.id, 'push', { transform: '✓ 已充满100%，停止充电（过充保护）' });
  // 低电（过放保护）
  B(bat.id, 'low', buz.id, 'beep');
  B(bat.id, 'low', alog.id, 'push', { transform: '⚠ 电量低于20%（过放保护）' });
  // 温度监测 + 过温保护（新国标重点）
  B(temp.id, 'change', gTemp.id, 'set');
  B(temp.id, 'change', buz.id, 'beep', { condition: '>45' });
  B(temp.id, 'change', bat.id, 'stop', { condition: '>45' });
  B(temp.id, 'change', sled.id, 'setColor', { arg: '#ef4444', condition: '>45' });
  B(temp.id, 'change', sled.id, 'on', { condition: '>45' });
  B(temp.id, 'change', oled.id, 'setText', { transform: 'OVERHEAT!', condition: '>45' });
  B(temp.id, 'change', stPwr.id, 'set', { transform: '过温保护', condition: '>45' });
  B(temp.id, 'change', alog.id, 'push', { transform: '🔥 电池过温(>45℃)，已切断输出', condition: '>45' });
  // 电量键
  B(key.id, 'click', buz.id, 'beep');
  B(key.id, 'click', alog.id, 'push', { transform: '🔍 查询电量' });
  // 远程输出开关
  B(tgOut.id, 'on', bat.id, 'discharge');
  B(tgOut.id, 'off', bat.id, 'stop');
  B(tgOut.id, 'on', alog.id, 'push', { transform: '📱 远程启用输出' });

  setLayout(2);
  renderViewports(); refreshMeta();
  setStatus('就绪', 'active');
  const nb = project.bindings.length;
  log(`✓ 充电宝原型已生成：10 硬件 · 5 App控件 · ${nb} 联动`, 'sys');
  flash(`充电宝Demo已就绪：插USB-C充电 / 拖温度>45触发过温保护 / 手机远程开关`);
}

/* ============================================================
 * 工具
 * ============================================================ */
function totalDevices() { return project.viewports.reduce((s, v) => s + v.devices.length, 0); }
function refreshMeta() {
  document.getElementById('stat-devices').textContent = totalDevices();
  document.getElementById('stat-bindings').textContent = project.bindings.length;
  document.getElementById('stat-viewports').textContent = project.viewports.length;
  updateJSON();
  if (!document.getElementById('tab-bindings').classList.contains('hidden')) renderBindings();
}
function updateJSON() { document.getElementById('json-output').textContent = JSON.stringify(PRD.stateMachine(project), null, 2); }

function log(msg, type = 'event') {
  logBuf.push({ msg, type }); if (logBuf.length > 30) logBuf.shift();
  const el = document.getElementById('event-log');
  const last = logBuf.slice(-2);
  el.innerHTML = last.map(l => `<span class="log-line log-${l.type}">${esc(l.msg)}</span>`).join('');
}
function setStatus(text, dot) {
  document.getElementById('status-text').textContent = text;
  const d = document.getElementById('status-dot'); d.className = 'status-indicator ' + (dot || 'active');
}
let flashTimer;
function flash(msg, type) {
  log((type === 'warn' ? '⚠ ' : '✓ ') + msg, type === 'warn' ? 'sys' : 'action');
}
function copyText(t, ok) { navigator.clipboard?.writeText(t).then(() => flash(ok)).catch(() => flash('复制失败', 'warn')); }
function download(name, content) {
  const blob = new Blob([content], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}
function startClock() {
  const t = () => { const n = new Date(); document.getElementById('status-time').textContent = `${n.getFullYear()}.${String(n.getMonth()+1).padStart(2,'0')}.${String(n.getDate()).padStart(2,'0')} ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`; };
  t(); setInterval(t, 1000);
}
