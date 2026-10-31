const fs = require('fs');
const path = require('path');

const s1x = fs.readFileSync(path.join(__dirname, '..', 'assets', '100-offline-sprite.png')).toString('base64');
const s2x = fs.readFileSync(path.join(__dirname, '..', 'assets', '200-offline-sprite.png')).toString('base64');
const sndPress = fs.readFileSync(path.join(__dirname, '..', 'assets', 'button-press.mp3')).toString('base64');
const sndHit = fs.readFileSync(path.join(__dirname, '..', 'assets', 'hit.mp3')).toString('base64');
const sndReached = fs.readFileSync(path.join(__dirname, '..', 'assets', 'score-reached.mp3')).toString('base64');

const jsDir = path.join(__dirname, '..', 'js');
if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir, { recursive: true });

const content = `// Embedded base64 assets from Chromium for 100% offline and file:/// zero-dependency compatibility
export const ASSETS = {
  SPRITE_1X: 'data:image/png;base64,${s1x}',
  SPRITE_2X: 'data:image/png;base64,${s2x}',
  SOUND_PRESS: 'data:audio/mpeg;base64,${sndPress}',
  SOUND_HIT: 'data:audio/mpeg;base64,${sndHit}',
  SOUND_REACHED: 'data:audio/mpeg;base64,${sndReached}',
};
`;

fs.writeFileSync(path.join(jsDir, 'assets.js'), content, 'utf-8');
console.log('Generated js/assets.js. Size:', fs.statSync(path.join(jsDir, 'assets.js')).size);

