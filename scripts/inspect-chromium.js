const https = require('https');
const fs = require('fs');
const path = require('path');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(data) }));
      res.on('error', reject);
    });
  });
}

async function downloadChromium() {
  const dir = path.join(__dirname, '..', 'reference-chromium');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const files = [
    'background_el.ts',
    'cloud.ts',
    'constants.ts',
    'dimensions.ts',
    'distance_meter.ts',
    'game_config.ts',
    'game_over_panel.ts',
    'game_state_provider.ts',
    'generated_sound_fx.ts',
    'horizon.ts',
    'horizon_line.ts',
    'image_sprite_provider.ts',
    'night_mode.ts',
    'obstacle.ts',
    'offline.ts',
    'offline_sprite_definitions.ts',
    'sprite_position.ts',
    'trex.ts',
    'utils.ts'
  ];

  for (const f of files) {
    const url = `https://chromium.googlesource.com/chromium/src/+/main/components/neterror/resources/dino_game/${f}?format=TEXT`;
    const res = await get(url);
    if (res.status === 200) {
      const decoded = Buffer.from(res.data.toString('utf-8'), 'base64').toString('utf-8');
      fs.writeFileSync(path.join(dir, f), decoded, 'utf-8');
      console.log(`Saved ${f}`);
    } else {
      console.log(`Failed ${f}: ${res.status}`);
    }
  }

  // Also download the audio mp3s and sprite images into assets/
  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const rawAssets = [
    { url: 'https://chromium.googlesource.com/chromium/src/+/main/components/neterror/resources/sounds/button-press.mp3?format=TEXT', file: 'button-press.mp3' },
    { url: 'https://chromium.googlesource.com/chromium/src/+/main/components/neterror/resources/sounds/hit.mp3?format=TEXT', file: 'hit.mp3' },
    { url: 'https://chromium.googlesource.com/chromium/src/+/main/components/neterror/resources/sounds/score-reached.mp3?format=TEXT', file: 'score-reached.mp3' },
    { url: 'https://chromium.googlesource.com/chromium/src/+/main/components/neterror/resources/images/default_100_percent/offline/100-error-offline.png?format=TEXT', file: '100-error-offline.png' },
    { url: 'https://chromium.googlesource.com/chromium/src/+/main/components/neterror/resources/images/default_200_percent/offline/200-error-offline.png?format=TEXT', file: '200-error-offline.png' }
  ];

  for (const a of rawAssets) {
    const res = await get(a.url);
    if (res.status === 200) {
      const bin = Buffer.from(res.data.toString('utf-8'), 'base64');
      fs.writeFileSync(path.join(assetsDir, a.file), bin);
      console.log(`Saved asset ${a.file} (${bin.length} bytes)`);
    } else {
      console.log(`Failed asset ${a.file}: ${res.status}`);
    }
  }
}

downloadChromium().catch(console.error);
