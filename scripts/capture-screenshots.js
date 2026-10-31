const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(os.tmpdir(), 'chrome-screenshots-' + Date.now());

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9225',
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

async function capture() {
  console.log('Connecting to Chrome for screenshots...');
  let pages = null;
  for (let i = 0; i < 20; i++) {
    await wait(400);
    try {
      pages = await getJson('http://127.0.0.1:9225/json');
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

  // Wait for game engine to be fully initialized on the page
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

  async function takeScreenshot(filename) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.result.data, 'base64');
    fs.writeFileSync(filename, buffer);
    console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
  }

  const shotsDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir, { recursive: true });

  // Helper to ensure clean active running gameplay
  async function setActivePlaying(milestone, score) {
    await evaluate(`(() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.state = 'PLAYING';
      eng.trex.status = 'RUNNING';
      eng.trex.reset();
      eng.obstacleManager.reset();
      if (eng.instructionBarEl) eng.instructionBarEl.classList.add('hidden');
      eng.score = ${score};
      eng.distanceRan = ${score} / 0.025;
      eng.checkpoints.triggerMilestone(${milestone});
      eng.render();
    })()`);
    await wait(300);
    // Ensure image has finished rendering
    for (let i = 0; i < 20; i++) {
      const isLoaded = await evaluate(`(() => {
        const img = document.querySelector('.traveling-checkpoint .checkpoint-img');
        if (!img) return true;
        return img.complete && img.naturalWidth > 0;
      })()`);
      if (isLoaded) break;
      await wait(150);
    }
    await wait(200);
  }

  // 1. Initial screen
  await takeScreenshot(path.join(shotsDir, '01_initial_screen.png'));

  // 2. Introduction 01 (25 pt early checkpoint: Hey I'm Prashant Tiwari with enlarged photo & 3.2° tilt)
  await setActivePlaying(25, 25);
  await takeScreenshot(path.join(shotsDir, '02_checkpoint_25.png'));

  // 2b. Introduction 03 (145 pt: IIT Madras with newly updated photo & 2.2° tilt)
  await setActivePlaying(145, 145);
  await takeScreenshot(path.join(shotsDir, '02b_checkpoint_145_iitm.png'));

  // 3. Introduction 06 (325 pt: Instagram with enlarged photo, 2.2° tilt & CLICK ME badge)
  await setActivePlaying(325, 325);
  await takeScreenshot(path.join(shotsDir, '03_checkpoint_325_instagram.png'));

  // 4. Introduction 09 (505 pt: Portfolio preview with enlarged photo, 2.2° tilt & CLICK ME badge)
  await setActivePlaying(505, 505);
  await takeScreenshot(path.join(shotsDir, '04_checkpoint_505_portfolio.png'));

  // 5. Introduction 11 (625 pt: Contact with clickable email)
  await setActivePlaying(625, 625);
  await takeScreenshot(path.join(shotsDir, '05_checkpoint_625_contact.png'));

  // 6. Night Mode (Active running under moon at 700+ points)
  await evaluate(`(() => {
    const eng = window.__INTRO_DINO_ENGINE__;
    eng.state = 'PLAYING';
    eng.distanceRan = 710 / 0.025;
    eng.score = 710;
    eng.isNightMode = true;
    document.body.classList.add('night-mode');
    eng.horizon.nightOpacity = 1;
    eng.obstacleManager.reset();
    eng.trex.status = 'RUNNING';
    eng.trex.reset();
    eng.render();
  })()`);
  await wait(1000);
  await takeScreenshot(path.join(shotsDir, '06_night_mode.png'));

  // 7. Game Over with Background Screen Blur & Uncluttered Layout
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
    eng.obstacleManager.reset();
    eng.obstacleManager.spawnObstacle(4.2);
    const obs = eng.obstacleManager.obstacles[0];
    obs.x = eng.trex.x + 15;
    eng.onCrash();
    eng.render();
  })()`);
  await wait(500);
  await takeScreenshot(path.join(shotsDir, '07_game_over_resume.png'));

  ws.close();
  chromeProc.kill();

  const artifactDir = 'C:\\Users\\msi\\.gemini\\antigravity\\brain\\cc61affc-2041-4f6d-a26d-14bae49266b1\\screenshots';
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
  [
    '01_initial_screen.png',
    '02_checkpoint_25.png',
    '02b_checkpoint_145_iitm.png',
    '03_checkpoint_325_instagram.png',
    '04_checkpoint_505_portfolio.png',
    '05_checkpoint_625_contact.png',
    '06_night_mode.png',
    '07_game_over_resume.png'
  ].forEach(file => {
    fs.copyFileSync(path.join(shotsDir, file), path.join(artifactDir, file));
  });

  console.log('All screenshots captured and copied to artifact directory successfully!');
}

capture().catch(err => {
  console.error('Capture error:', err);
  try { chromeProc.kill(); } catch (e) {}
  process.exit(1);
});
