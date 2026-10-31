// =============================================================================
// INTRODUCTION DINO - SOCIAL PROFILES & DYNAMIC QR CODE GENERATOR
// Dynamically generates scannable monochrome QR codes from configured URLs
// =============================================================================

import { CONFIG } from './config.js';

export class SocialManager {
  constructor() {
    this.profiles = CONFIG.socialProfiles;
    this.cachedQRs = new Map();
  }

  generateQRDataUrl(url) {
    if (this.cachedQRs.has(url)) {
      return this.cachedQRs.get(url);
    }

    try {
      if (typeof window.qrcode === 'function') {
        const qr = window.qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        const dataUrl = qr.createDataURL(4, 2);
        this.cachedQRs.set(url, dataUrl);
        return dataUrl;
      }
    } catch (e) {
      console.warn('QR generation note:', e);
    }
    return '';
  }

  renderSocialBar() {
    const bar = document.createElement('div');
    bar.className = 'social-profiles-bar';

    this.profiles.forEach(profile => {
      const item = document.createElement('div');
      item.className = 'social-item';

      const qrDataUrl = this.generateQRDataUrl(profile.url);

      item.innerHTML = `
        <div class="qr-wrapper" title="Scan QR Code to open ${profile.name}">
          ${qrDataUrl ? `<img class="qr-code-img" src="${qrDataUrl}" alt="${profile.name} QR" width="48" height="48" />` : ''}
        </div>
        <div class="social-meta">
          <a class="social-link" href="${profile.url}" target="_blank" rel="noopener noreferrer">
            <span>${profile.name}</span>
            <span class="social-arrow">↗</span>
          </a>
          <span class="social-handle">${profile.handle}</span>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        item.classList.toggle('expanded');
      });

      bar.appendChild(item);
    });

    return bar;
  }
}
