// 砺 / Forge 原型 · 本地后端
// 作用：① 同源伺服原型 HTML；② 代理转发到 MiMo（API Key 留在服务端，避免浏览器 CORS）
//
// 启动前准备：
//   cp .env.example .env
//   # 编辑 .env，填入你的 MIMO_API_KEY
//   node server.js
// 然后浏览器打开： http://localhost:8787

const http = require('http');
const fs = require('fs');
const path = require('path');

// 尝试加载 .env（不依赖 dotenv，手动解析）
try {
  const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  env.split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (_) {}

const KEY   = process.env.MIMO_API_KEY;
const MODEL = process.env.MIMO_MODEL || 'mimo-v2.5-pro';
const BASE  = process.env.MIMO_BASE  || 'https://token-plan-cn.xiaomimimo.com/v1';
const PORT  = process.env.PORT       || 8787;

if (!KEY) {
  console.error('\n[错误] 未找到 MIMO_API_KEY。\n请复制 .env.example 为 .env 并填入 API Key，或设置环境变量 MIMO_API_KEY=your_key\n');
  process.exit(1);
}
const HTML  = path.join(__dirname, 'AI研发工作空间_员工端_原型_v1.html');

const server = http.createServer(async (req, res) => {
  // ---- 大模型代理（流式）----
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      let messages;
      try { messages = JSON.parse(body).messages; }
      catch (e) { res.writeHead(400); return res.end('bad json'); }
      try {
        const up = await fetch(BASE + '/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: MODEL, messages, stream: true, max_tokens: 1024, temperature: 0.6 })
        });
        if (!up.ok) {
          const t = await up.text();
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ error: 'upstream ' + up.status, detail: t.slice(0, 400) }));
        }
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        const reader = up.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') { res.write('data: [DONE]\n\n'); continue; }
            try {
              const j = JSON.parse(data);
              const d = j.choices && j.choices[0] && j.choices[0].delta;
              const c = d && d.content;            // 只透传正式回答，忽略 reasoning_content
              if (c) res.write('data: ' + JSON.stringify({ t: c }) + '\n\n');
            } catch (_) {}
          }
        }
        res.end();
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: String(e && e.message || e) }));
      }
    });
    return;
  }

  // ---- 伺服原型 HTML ----
  fs.readFile(HTML, (err, data) => {
    if (err) { res.writeHead(404); return res.end('prototype html not found: ' + HTML); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('砺 prototype + MiMo proxy → http://localhost:' + PORT + '  (model: ' + MODEL + ')');
});
