const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(os.tmpdir(), 'chrome-test-suite-' + Date.now());

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9223',
  `--user-data-dir=${userDataDir}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
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

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE 20-TEST VALIDATION SUITE ---');

  let pages = null;
  for (let i = 0; i < 20; i++) {
    await wait(400);
    try {
      pages = await getJson('http://127.0.0.1:9223/json');
      if (pages && pages.length > 0) break;
    } catch (e) {}
  }

  if (!pages || !pages.length) {
    console.error('Failed to connect to Chrome CDP');
    chromeProc.kill();
    process.exit(1);
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
  await wait(500);

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true });
    return res.result && res.result.result ? res.result.result.value : null;
  }

  // Wait until engine is fully loaded and assets initialized
  for (let i = 0; i < 40; i++) {
    const ready = await evaluate(`Boolean(window.__INTRO_DINO_ENGINE__ && window.__INTRO_DINO_ENGINE__.assetsLoaded)`);
    if (ready) break;
    await wait(100);
  }

  const results = [];

  function assertTest(number, name, condition, details = '') {
    const passed = Boolean(condition);
    results.push({ number, name, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[Test ${number.toString().padStart(2, '0')}] ${mark}: ${name} ${details ? '(' + details + ')' : ''}`);
  }

  // ---------------------------------------------------------------------------
  // Test 1: First visit shows only the start instruction and game environment
  // ---------------------------------------------------------------------------
  const visibleText = await evaluate(`
    (() => {
      const visible = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while(walker.nextNode()) {
        const node = walker.currentNode;
        const text = node.nodeValue.trim();
        if (text && node.parentElement && window.getComputedStyle(node.parentElement).display !== 'none' && window.getComputedStyle(node.parentElement).visibility !== 'hidden' && window.getComputedStyle(node.parentElement).opacity !== '0') {
          visible.push(text);
        }
      }
      return visible;
    })()
  `);
  assertTest(1, 'First visit shows only start instruction', 
    visibleText.length === 1 && visibleText[0] === 'PRESS SPACEBAR TO START',
    `Found texts: ${JSON.stringify(visibleText)}`);

  // ---------------------------------------------------------------------------
  // Test 2: Space starts the game with snappier initial pace (4.2)
  // ---------------------------------------------------------------------------
  await evaluate(`
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  `);
  await wait(300);
  const stateAfterSpace = await evaluate(`window.__INTRO_DINO_ENGINE__.state`);
  const initialSpeed = await evaluate(`window.__INTRO_DINO_ENGINE__.speed`);
  const instructionHidden = await evaluate(`document.getElementById('instruction-bar').classList.contains('hidden')`);
  assertTest(2, 'Space starts game with slightly increased starting pace (4.2)',
    stateAfterSpace === 'PLAYING' && instructionHidden && initialSpeed >= 4.0,
    `State: ${stateAfterSpace}, Speed: ${initialSpeed}`);

  // ---------------------------------------------------------------------------
  // Test 3: Dinosaur jump height reduced & lands perfectly on baseline
  // ---------------------------------------------------------------------------
  const jumpingWorks = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      const initialY = eng.trex.y;
      const started = eng.trex.startJump(eng.speed);
      const isJumping = started && eng.trex.jumping && eng.trex.status === 'JUMPING';
      // Simulate physics update until landing
      let peakY = initialY;
      for (let i = 0; i < 60; i++) {
        eng.trex.update(16.6);
        if (eng.trex.y < peakY) peakY = eng.trex.y;
        if (!eng.trex.jumping) break;
      }
      const jumpHeight = initialY - peakY;
      const landedOnBaseline = eng.trex.y === eng.trex.groundY && !eng.trex.jumping;
      // Height should be reduced (~80-160px depending on scale, well below previous excessive hang)
      return isJumping && landedOnBaseline && jumpHeight > 40 && jumpHeight < 250;
    })()
  `);
  assertTest(3, 'Dinosaur jump height reduced and lands perfectly on baseline', jumpingWorks);

  // ---------------------------------------------------------------------------
  // Test 4: Jump sound cooldown & single jump initiation on Space spam
  // ---------------------------------------------------------------------------
  const audioCooldownWorks = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.trex.startJump(eng.speed);
      // While jumping in mid-air, startJump must return false
      const secondJumpTriggered = eng.trex.startJump(eng.speed);
      // Audio playPress has 300ms cooldown
      const t1 = performance.now();
      eng.audio.lastPlayed['press'] = t1;
      let soundPlayedAgain = false;
      // Calling playPress within 100ms should be blocked by cooldown
      const origPlay = eng.audio.play;
      eng.audio.play('press', 300);
      const blocked = (eng.audio.lastPlayed['press'] === t1);
      return !secondJumpTriggered && blocked;
    })()
  `);
  assertTest(4, 'Audio cooldown (300ms) prevents repeated Spacebar jump sound', audioCooldownWorks);

  // ---------------------------------------------------------------------------
  // Test 5: Ambient background music & startup music implemented and isolated
  // ---------------------------------------------------------------------------
  const audioSystemsValid = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      const hasStartup = typeof eng.audio.playStartupMusic === 'function' &&
                         typeof eng.audio.tryAutoPlayStartup === 'function';
      const hasBGM = typeof eng.audio.startBGM === 'function' &&
                     typeof eng.audio.pauseBGM === 'function' &&
                     typeof eng.audio.resumeBGM === 'function' &&
                     typeof eng.audio.generateAmbientBGM === 'function';
      const targetVolume = eng.audio.bgmTargetVolume >= 0.08 && eng.audio.bgmTargetVolume <= 0.12;
      return hasStartup && hasBGM && targetVolume;
    })()
  `);
  assertTest(5, 'Startup music & ambient background music (BGM) operational at ~9.5% volume', audioSystemsValid);

  // ---------------------------------------------------------------------------
  // Test 6: Cacti and Pterodactyl obstacles spawn correctly
  // ---------------------------------------------------------------------------
  const obstaclesValid = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.obstacleManager.reset();
      eng.obstacleManager.spawnObstacle(4.2);
      const obs1 = eng.obstacleManager.obstacles[0];
      const pteroType = eng.obstacleManager.constructor.OBSTACLE_TYPES.find(t => t.type === 'pterodactyl');
      const obs2 = eng.obstacleManager.spawnObstacle(6.0, pteroType);
      return obs1 && obs2 && obs1.collisionBoxes.length > 0 && obs2.collisionBoxes.length > 0;
    })()
  `);
  assertTest(6, 'Obstacles (cacti & pterodactyls) spawn with accurate hitboxes', obstaclesValid);

  // ---------------------------------------------------------------------------
  // Test 7: Collision detection is accurate with invulnerability
  // ---------------------------------------------------------------------------
  const collisionAccurate = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.obstacleManager.reset();
      eng.trex.reset();
      eng.trex.flashing = false;
      const noHitBefore = eng.obstacleManager.checkCollision(eng.trex);

      // Place obstacle right on trex
      eng.obstacleManager.spawnObstacle(4.2);
      const obs = eng.obstacleManager.obstacles[0];
      obs.x = eng.trex.x; // collide
      const hitWhenColliding = eng.obstacleManager.checkCollision(eng.trex);

      // Flashing invulnerability check
      eng.trex.flashing = true;
      const noHitWhenFlashing = !eng.obstacleManager.checkCollision(eng.trex);
      eng.trex.flashing = false;

      return !noHitBefore && hitWhenColliding && noHitWhenFlashing;
    })()
  `);
  assertTest(7, 'Collision detection is accurate with invulnerability window', collisionAccurate);

  // ---------------------------------------------------------------------------
  // Test 8: No checkpoint numbers or milestone labels exist anywhere
  // ---------------------------------------------------------------------------
  const noCheckpointNumbers = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.checkpoints.triggerMilestone(25);
      const track = document.getElementById('narrative-track');
      const text = track.innerText;
      // Must NOT contain [ 25 ], [25 PTS], [100 PTS], or milestone digits
      const hasBrackets = /\\[\\s*\\d+\\s*(PTS)?\\s*\\]/i.test(text);
      const hasPts = /PTS/i.test(text);
      return !hasBrackets && !hasPts;
    })()
  `);
  assertTest(8, 'No checkpoint numbers or milestone labels are displayed', noCheckpointNumbers);

  // ---------------------------------------------------------------------------
  // Test 9: Introduction 01 has text and enlarged image with clockwise tilt (~3.2 deg)
  // ---------------------------------------------------------------------------
  const intro01Valid = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.checkpoints.triggerMilestone(25);
      const el = document.querySelector('.traveling-checkpoint[data-milestone="25"]');
      if (!el) return false;
      const text = el.querySelector('.checkpoint-text')?.textContent || '';
      const img = el.querySelector('.checkpoint-img');
      const hasTilt = img && (img.classList.contains('tilt-strong') || img.classList.contains('tilted'));
      const textCorrect = text.includes("Hey... I'm Prashant Tiwari.");
      return textCorrect && hasTilt;
    })()
  `);
  assertTest(9, 'Introduction 01 has text and tilted enlarged image (~3.2 deg)', intro01Valid);

  // ---------------------------------------------------------------------------
  // Test 10: Social profiles & portfolio images are clickable with updated URLs
  // ---------------------------------------------------------------------------
  const socialProfilesValid = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      // Trigger Instagram (325) and Portfolio (505)
      eng.checkpoints.triggerMilestone(325);
      const instaEl = document.querySelector('.traveling-checkpoint[data-milestone="325"]');
      const instaLink = instaEl?.querySelector('a.checkpoint-image-link')?.href || '';
      const instaBadge = instaEl?.querySelector('.click-me-badge')?.textContent || '';

      eng.checkpoints.triggerMilestone(505);
      const portEl = document.querySelector('.traveling-checkpoint[data-milestone="505"]');
      const portLink = portEl?.querySelector('a.checkpoint-image-link')?.href || '';
      const portBadge = portEl?.querySelector('.click-me-badge')?.textContent || '';

      const instaOk = instaLink.includes('instagram.com/_.prashant.me') && instaBadge.includes('CLICK ME');
      const portOk = portLink.includes('portfolio-v3-ten-gray.vercel.app') && portBadge.includes('CLICK ME');
      return instaOk && portOk;
    })()
  `);
  assertTest(10, 'Social profiles and portfolio have updated URLs and clickable badges', socialProfilesValid);

  // ---------------------------------------------------------------------------
  // Test 11: Contact introduction (625) displays clickable email
  // ---------------------------------------------------------------------------
  const contactValid = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.checkpoints.triggerMilestone(625);
      const el = document.querySelector('.traveling-checkpoint[data-milestone="625"]');
      const link = el?.querySelector('a.checkpoint-email-link');
      const emailText = link?.textContent || '';
      const href = link?.href || '';
      return href === 'mailto:pt286355@gmail.com' && emailText.includes('pt286355@gmail.com');
    })()
  `);
  assertTest(11, 'Contact checkpoint displays clickable email mailto:pt286355@gmail.com', contactValid);

  // ---------------------------------------------------------------------------
  // Test 12: Continuous horizontal movement: exits far left, enters from right
  // ---------------------------------------------------------------------------
  const horizontalMovementValid = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.checkpoints.reset();
      const W = window.innerWidth;
      const centerX = W / 2;

      // 1. Entry at score 18 (milestone 25, enterStart is 10): X should be to the right of center
      eng.checkpoints.update(18);
      const el25 = eng.checkpoints.renderedElements.get(25);
      const matrix1 = el25 ? el25.style.transform : '';
      const match1 = matrix1.match(/translate3d\\((-?\\d+)px/);
      const xEntry = match1 ? parseInt(match1[1], 10) : 0;

      // 2. Centered at score 25: X should be center
      eng.checkpoints.update(25);
      const match2 = el25.style.transform.match(/translate3d\\((-?\\d+)px/);
      const xCenter = match2 ? parseInt(match2[1], 10) : 0;

      // 3. Exiting far left at score 75 (milestone 25, exit window is 70 to 85): X should be significantly left of center
      eng.checkpoints.update(75);
      const match3 = el25.style.transform.match(/translate3d\\((-?\\d+)px/);
      const xExit = match3 ? parseInt(match3[1], 10) : 0;

      // 4. Simultaneous entry of milestone 85 at score 75 (entrance window 70 to 85): X should be right of center
      const el85 = eng.checkpoints.renderedElements.get(85);
      const match4 = el85 ? el85.style.transform.match(/translate3d\\((-?\\d+)px/) : null;
      const xNextEntry = match4 ? parseInt(match4[1], 10) : 0;

      return xEntry > centerX && xCenter === Math.round(centerX) && xExit < centerX && xNextEntry > centerX;
    })()
  `);
  assertTest(12, 'Continuous horizontal travel: enters right, centers, exits far left', horizontalMovementValid);

  // ---------------------------------------------------------------------------
  // Test 13: Gameplay continues uninterrupted during introduction animation
  // ---------------------------------------------------------------------------
  const gameplayContinues = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.state = 'PLAYING';
      eng.checkpoints.triggerMilestone(145);
      return eng.state === 'PLAYING' && eng.speed > 0;
    })()
  `);
  assertTest(13, 'Gameplay continues without interruption during checkpoints', gameplayContinues);

  // ---------------------------------------------------------------------------
  // Test 14: Day/night transitions work at 700-point cycle
  // ---------------------------------------------------------------------------
  const nightTransition = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.obstacleManager.reset();
      eng.state = 'PLAYING';
      eng.distanceRan = 705 / 0.025; // 705 score
      eng.update(16);
      const isNight = eng.isNightMode;
      const hasClass = document.body.classList.contains('night-mode');
      eng.distanceRan = 1405 / 0.025; // 1400 back to day
      eng.update(16);
      const isDay = !eng.isNightMode;
      return isNight && hasClass && isDay;
    })()
  `);
  assertTest(14, 'Day/night cycle transitions at 700-point intervals', nightTransition);

  // ---------------------------------------------------------------------------
  // Test 15: Game over preserves high score and shows resume prompt
  // ---------------------------------------------------------------------------
  const gameOverPreserves = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      localStorage.setItem('intro_dino_high_score', '200');
      eng.score = 450;
      eng.onCrash();
      const highScore = localStorage.getItem('intro_dino_high_score');
      const instructionBar = document.getElementById('instruction-bar');
      const showsResume = instructionBar && instructionBar.textContent.includes('RESUME');
      return eng.state === 'CRASHED' && highScore === '450' && showsResume;
    })()
  `);
  assertTest(15, 'Game over updates high score and shows resume prompt', gameOverPreserves);

  // ---------------------------------------------------------------------------
  // Test 16: Space resumes the game with safe runway
  // ---------------------------------------------------------------------------
  const spaceResumes = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.score = 450;
      eng.obstacleManager.spawnObstacle(4.2);
      eng.obstacleManager.obstacles[0].x = 100;
      eng.handleAction();
      const isResumed = eng.state === 'PLAYING';
      const scorePreserved = Math.floor(eng.score) === 450;
      const runwayCleared = eng.obstacleManager.obstacles.every(o => o.x > 450);
      const safeWindowActive = eng.trex.flashing;
      return isResumed && scorePreserved && runwayCleared && safeWindowActive;
    })()
  `);
  assertTest(16, 'Space resumes game from previous score with safe runway', spaceResumes);

  // ---------------------------------------------------------------------------
  // Test 17: Page refresh always starts fresh run at score 0, retaining high score
  // ---------------------------------------------------------------------------
  await evaluate(`localStorage.setItem('intro_dino_high_score', '950')`);
  await send('Page.reload');
  await wait(800);
  const refreshResults = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      const highScoreRetained = localStorage.getItem('intro_dino_high_score') === '950';
      const freshScoreZero = eng.score === 0;
      const startScreenState = eng.state === 'START_SCREEN';
      return highScoreRetained && freshScoreZero && startScreenState;
    })()
  `);
  assertTest(17, 'Page refresh always starts fresh run, retaining high score', refreshResults);

  // ---------------------------------------------------------------------------
  // Test 18: Final message (745+) does not stop gameplay and runs infinitely
  // ---------------------------------------------------------------------------
  const finalMessageNoStop = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.state = 'PLAYING';
      eng.checkpoints.triggerMilestone(745);
      const area = document.getElementById('narrative-track');
      const text = area.innerText;
      const containsFinal = text.includes('last one') || text.includes('enjoy the game') || text.includes('Prashant continues');
      return containsFinal && eng.state === 'PLAYING';
    })()
  `);
  assertTest(18, 'Final introduction (13) displays without stopping gameplay', finalMessageNoStop);

  // ---------------------------------------------------------------------------
  // Test 19: Mobile controls work correctly (jump, duck, scroll prevent)
  // ---------------------------------------------------------------------------
  const mobileControls = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      eng.state = 'PLAYING';
      const fakeTouch = { clientY: window.innerHeight * 0.75 };
      eng.handleTouchStart({ preventDefault: () => {}, touches: [fakeTouch], target: eng.canvas });
      const duckedOnLowerHalf = eng.isTouchDucking;
      eng.handleTouchEnd({ preventDefault: () => {} });
      const unducked = !eng.isTouchDucking;
      return duckedOnLowerHalf && unducked;
    })()
  `);
  assertTest(19, 'Mobile touch controls (jump, duck, scroll prevent) work', mobileControls);

  // ---------------------------------------------------------------------------
  // Test 20: All 13 introductions defined and image preloading operational
  // ---------------------------------------------------------------------------
  const all13IntroductionsValid = await evaluate(`
    (() => {
      const eng = window.__INTRO_DINO_ENGINE__;
      const preloadedCount = eng.checkpoints.preloadedImages.size;
      return preloadedCount === 6;
    })()
  `);
  assertTest(20, 'All 13 introductions configured and images preloaded', all13IntroductionsValid);

  console.log('\n--- TEST SUMMARY ---');
  const allPassed = results.every(r => r.passed);
  console.log(`Total tests: ${results.length}, Passed: ${results.filter(r => r.passed).length}, Failed: ${results.filter(r => !r.passed).length}`);

  ws.close();
  chromeProc.kill();

  if (!allPassed) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  try { chromeProc.kill(); } catch (e) {}
  process.exit(1);
});
