const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(os.tmpdir(), 'chrome-docs-shots-' + Date.now());

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9228',
  `--user-data-dir=${userDataDir}`,
  '--window-size=1280,720',
  '--disable-gpu',
  '--no-first-run',
  'http://localhost:3000/'
]);

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

async function captureAllDocsScreenshots() {
  console.log('Connecting to Chrome for documentation screenshots...');
  let pages = null;
  for (let i = 0; i < 25; i++) {
    await wait(400);
    try {
      pages = await getJson('http://127.0.0.1:9228/json');
      if (pages && pages.length > 0) break;
    } catch (e) {}
  }

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
  await send('Runtime.enable');
  await send('Page.enable');

  // Wait for game engine ready
  for (let i = 0; i < 20; i++) {
    const ready = await send('Runtime.evaluate', { expression: 'Boolean(window.__INTRO_DINO_ENGINE__)', returnByValue: true });
    if (ready.result && ready.result.result && ready.result.result.value) break;
    await wait(400);
  }
  await wait(800);

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (res.result && res.result.exceptionDetails) {
      console.error('Evaluate Exception:', res.result.exceptionDetails.text, res.result.exceptionDetails.exception);
    }
    return res.result && res.result.result ? res.result.result.value : null;
  }

  async function takeScreenshot(outputPath) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.result.data, 'base64');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Saved screenshot: ${outputPath} (${buffer.length} bytes)`);
  }

  const docsDir = path.join(__dirname, '..', 'docs', 'screenshots');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // 1. Initial screen: Zero Portfolio Identity
  await evaluate(`(() => {
    const eng = window.__INTRO_DINO_ENGINE__;
    eng.state = 'START_SCREEN';
    eng.score = 0;
    eng.distanceRan = 0;
    document.body.classList.remove('game-over-active', 'night-mode');
    const bar = document.getElementById('instruction-bar');
    if (bar) {
      bar.textContent = 'PRESS SPACEBAR TO START';
      bar.classList.remove('hidden');
    }
    eng.trex.status = 'WAITING';
    eng.checkpoints.reset();
    eng.obstacleManager.reset();
    eng.render();
  })()`);
  await wait(400);
  await takeScreenshot(path.join(docsDir, 'initial-screen.png'));

  // 2. Gameplay: Dinosaur running during active gameplay
  await evaluate(`(() => {
    const eng = window.__INTRO_DINO_ENGINE__;
    eng.state = 'PLAYING';
    eng.score = 12;
    eng.distanceRan = 12 / 0.025;
    eng.speed = 4.2;
    document.body.classList.remove('game-over-active', 'night-mode');
    const bar = document.getElementById('instruction-bar');
    if (bar) bar.classList.add('hidden');
    eng.trex.status = 'RUNNING';
    eng.checkpoints.reset();
    eng.obstacleManager.reset();
    eng.obstacleManager.spawnObstacle(4.2);
    if (eng.obstacleManager.obstacles[0]) {
      eng.obstacleManager.obstacles[0].x = window.innerWidth * 0.75;
    }
    eng.render();
  })()`);
  await wait(400);
  await takeScreenshot(path.join(docsDir, 'gameplay.png'));

  // Helper to cleanly position narrative checkpoints
  async function renderCheckpoint(milestone, score) {
    await evaluate(`(() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.state = 'PLAYING';
      eng.score = ${score};
      eng.distanceRan = ${score} / 0.025;
      document.body.classList.remove('game-over-active', 'night-mode');
      const bar = document.getElementById('instruction-bar');
      if (bar) bar.classList.add('hidden');
      eng.trex.status = 'RUNNING';
      eng.trex.reset();
      eng.obstacleManager.reset();
      eng.checkpoints.reset();
      eng.checkpoints.triggerMilestone(${milestone});
      const el = eng.checkpoints.renderedElements.get(${milestone});
      if (el) {
        el.style.transform = 'translate3d(' + Math.round(window.innerWidth / 2) + 'px, 0, 0) translate3d(-50%, 0, 0)';
        el.style.opacity = '1';
      }
      eng.render();
    })()`);
    await wait(600);
  }

  // 3. Introduction 01 (25 pts): Prashant Tiwari with enlarged photo
  await renderCheckpoint(25, 25);
  await takeScreenshot(path.join(docsDir, 'introduction.png'));

  // 4. Education (145 pts): IIT Madras Data Science card
  await renderCheckpoint(145, 145);
  await takeScreenshot(path.join(docsDir, 'education.png'));

  // 5. Social Profiles (325 pts): Instagram profile
  await renderCheckpoint(325, 325);
  await takeScreenshot(path.join(docsDir, 'social-profiles.png'));

  // 6. Portfolio (505 pts): Personal portfolio preview
  await renderCheckpoint(505, 505);
  await takeScreenshot(path.join(docsDir, 'portfolio.png'));

  // 7. Contact (625 pts): Contact checkpoint with email
  await renderCheckpoint(625, 625);
  await takeScreenshot(path.join(docsDir, 'contact.png'));

  // 8. Night Mode (700+ pts): Fullscreen night transition & moon
  await evaluate(`(() => {
    const eng = window.__INTRO_DINO_ENGINE__;
    eng.state = 'PLAYING';
    eng.distanceRan = 715 / 0.025;
    eng.score = 715;
    eng.isNightMode = true;
    document.body.classList.add('night-mode');
    document.body.classList.remove('game-over-active');
    eng.horizon.nightOpacity = 1;
    eng.obstacleManager.reset();
    eng.trex.status = 'RUNNING';
    eng.trex.reset();
    eng.checkpoints.reset();
    eng.render();
  })()`);
  await wait(800);
  await takeScreenshot(path.join(docsDir, 'night-mode.png'));

  // 9. Game Over (Clean foreground modal + soft background blur)
  await evaluate(`(() => {
    const eng = window.__INTRO_DINO_ENGINE__;
    document.body.classList.remove('night-mode');
    document.body.style.transition = 'none';
    eng.isNightMode = false;
    eng.horizon.nightOpacity = 0;
    eng.state = 'PLAYING';
    eng.score = 145;
    eng.distanceRan = 145 / 0.025;
    eng.checkpoints.triggerMilestone(145);
    const el = eng.checkpoints.renderedElements.get(145);
    if (el) {
      el.style.transform = 'translate3d(' + Math.round(window.innerWidth / 2) + 'px, 0, 0) translate3d(-50%, 0, 0)';
      el.style.opacity = '1';
    }
    eng.obstacleManager.reset();
    eng.obstacleManager.spawnObstacle(4.2);
    const obs = eng.obstacleManager.obstacles[0];
    obs.x = eng.trex.x + 15;
    eng.onCrash();
    eng.render();
  })()`);
  await wait(600);
  await takeScreenshot(path.join(docsDir, 'game-over.png'));

  // Also create hero-banner.png in docs/assets/
  const assetsDir = path.join(__dirname, '..', 'docs', 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  fs.copyFileSync(path.join(docsDir, 'education.png'), path.join(assetsDir, 'hero-banner.png'));

  console.log('--- ALL DOCUMENTATION SCREENSHOTS CAPTURED SUCCESSFULLY ---');
  ws.close();
  chromeProc.kill();
}

captureAllDocsScreenshots().catch(err => {
  console.error('Error during screenshot capture:', err);
  try { chromeProc.kill(); } catch (e) {}
  process.exit(1);
});
