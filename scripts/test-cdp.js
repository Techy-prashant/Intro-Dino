const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(os.tmpdir(), 'chrome-test-profile-' + Date.now());

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  `--user-data-dir=${userDataDir}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  'http://localhost:3000/'
]);

chromeProc.on('error', (err) => {
  console.error('Failed to spawn Chrome:', err);
});

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = [];
      res.on('data', c => data.push(c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(data).toString('utf-8')));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Waiting for Chrome CDP to be ready...');
  let pages = null;
  for (let i = 0; i < 20; i++) {
    await wait(500);
    try {
      pages = await getJson('http://127.0.0.1:9222/json');
      if (pages && pages.length > 0) break;
    } catch (e) {}
  }

  if (!pages || !pages.length) {
    console.error('Could not connect to Chrome CDP');
    chromeProc.kill();
    return;
  }

  console.log('Found Chrome pages:', pages.map(p => ({ title: p.title, url: p.url })));
  const page = pages.find(p => p.url.includes('localhost:3000')) || pages[0];

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg);
      callbacks.delete(msg.id);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await new Promise(r => ws.onopen = r);
  console.log('Connected to page WebSocket');

  // Evaluate expression in the page
  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true });
    return res.result && res.result.result ? res.result.result.value : null;
  }

  await send('Runtime.enable');
  await send('Page.enable');
  await wait(1000);

  // Test 1: Check initial screen text
  const initialText = await evaluate(`document.getElementById('start-instruction').innerText`);
  console.log('Initial start instruction text:', initialText);

  // Check engine attached
  const engineState = await evaluate(`window.__INTRO_DINO_ENGINE__ ? window.__INTRO_DINO_ENGINE__.state : null`);
  console.log('Initial GameEngine state:', engineState);

  // Close
  ws.close();
  chromeProc.kill();
}

run().catch(err => {
  console.error(err);
  try { chromeProc.kill(); } catch (e) {}
});

