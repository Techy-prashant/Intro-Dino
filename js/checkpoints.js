// =============================================================================
// INTRODUCTION DINO - CONTINUOUS HORIZONTAL CHECKPOINT NARRATIVE
// Text & images travel together as one atomic composition across the horizon
// Enters right (M-20 to M), Centers (M to M+80), Exits far left (M+80 to M+100)
// NO checkpoint numbers or score labels; smooth preloaded image rendering
// =============================================================================

import { CONFIG } from './config.js';

export class CheckpointManager {
  constructor(trackContainer) {
    this.container = trackContainer;
    this.unlockedMilestones = new Set();
    this.renderedElements = new Map(); // milestone -> DOM element
    this.preloadedImages = new Map();

    // Preload all introduction images immediately to ensure zero delay/layout shifts
    this.preloadAllImages();
  }

  preloadAllImages() {
    CONFIG.checkpoints.forEach(item => {
      const src = item.image || item.remoteImage;
      if (src) {
        const img = new Image();
        this.preloadedImages.set(src, { loaded: false, img });
        img.onload = () => {
          this.preloadedImages.set(src, { loaded: true, img });
        };
        img.onerror = () => {
          if (item.remoteImage && src !== item.remoteImage) {
            img.src = item.remoteImage;
          } else {
            this.preloadedImages.set(src, { loaded: false, error: true });
          }
        };
        img.src = src;
      }
    });
  }

  restore(milestonesArray) {
    if (Array.isArray(milestonesArray)) {
      milestonesArray.forEach(m => this.unlockedMilestones.add(m));
    }
  }

  /**
   * Calculate dynamic timing windows for any checkpoint based on its custom milestone or duration
   */
  getCheckpointTiming(index) {
    const c = CONFIG.checkpoints[index];
    if (!c) return null;
    const m = c.milestone;
    const next = CONFIG.checkpoints[index + 1];

    let gap = 60;
    if (typeof c.duration === 'number' && c.duration > 0) {
      gap = c.duration;
    } else if (next && typeof next.milestone === 'number') {
      gap = Math.max(15, next.milestone - m);
    }

    // Proportional transition travel span (clamped between 6 and 18 points)
    const transitionSpan = Math.max(6, Math.min(18, Math.round(gap * 0.25)));
    const readingSpan = Math.max(8, gap - transitionSpan);

    return {
      milestone: m,
      gap,
      transitionSpan,
      readingSpan,
      enterStart: m - transitionSpan,
      exitStart: m + readingSpan,
      exitEnd: m + gap
    };
  }

  /**
   * Continuous score-driven horizontal transition update (called every frame)
   */
  update(currentScore) {
    const s = Math.max(0, currentScore);
    const visibleCheckpoints = [];

    CONFIG.checkpoints.forEach((c, idx) => {
      const timing = this.getCheckpointTiming(idx);
      c._timing = timing;

      if (!c.isFinal) {
        if (s >= timing.enterStart && s < timing.exitEnd) {
          visibleCheckpoints.push(c);
        }
      } else {
        // Final message enters at enterStart and stays centered indefinitely
        if (s >= timing.enterStart) {
          visibleCheckpoints.push(c);
        }
      }

      if (s >= c.milestone) {
        this.unlockedMilestones.add(c.milestone);
      }
    });

    const visibleMilestoneSet = new Set(visibleCheckpoints.map(c => c.milestone));

    // Remove any DOM elements that have completely passed beyond the left edge
    for (const [m, el] of this.renderedElements.entries()) {
      if (!visibleMilestoneSet.has(m)) {
        el.remove();
        this.renderedElements.delete(m);
      }
    }

    const W = window.innerWidth;
    const centerX = W / 2;

    visibleCheckpoints.forEach(c => {
      const timing = c._timing || this.getCheckpointTiming(CONFIG.checkpoints.indexOf(c));
      const m = timing.milestone;
      const transSpan = timing.transitionSpan;
      const enterStart = timing.enterStart;
      const exitStart = timing.exitStart;

      let el = this.renderedElements.get(m);
      if (!el) {
        el = this.createMilestoneElement(c);
        this.container.appendChild(el);
        this.renderedElements.set(m, el);
      }

      // Calculate offscreen boundaries based on element width
      const unitEl = el.firstElementChild;
      const elemWidth = (unitEl ? unitEl.offsetWidth : 480) || 480;
      const startX = W + (elemWidth / 2) + 60;  // Beyond right edge
      const endX = - (elemWidth / 2) - 80;      // Far beyond left edge

      let x = centerX;
      let opacity = 1.0;

      if (s < m) {
        // Entering phase: from enterStart to m (travels together from right to center)
        const p = Math.max(0, Math.min(1, (s - enterStart) / transSpan));
        // Smooth cubic ease-out
        const easeOut = 1 - Math.pow(1 - p, 3);
        x = startX + (centerX - startX) * easeOut;
        opacity = Math.min(1, p * 2.0);
      } else if (!c.isFinal && s > exitStart) {
        // Exiting phase: from exitStart to exitEnd (travels far beyond the left edge)
        const p = Math.max(0, Math.min(1, (s - exitStart) / transSpan));
        // Progressive movement across the left side
        const easeIn = Math.pow(p, 1.8);
        x = centerX + (endX - centerX) * easeIn;
        // Fades out only as it physically approaches and leaves the left boundary
        opacity = p < 0.65 ? 1.0 : Math.max(0, 1 - (p - 0.65) / 0.35);
      } else {
        // Centered steady reading phase
        x = centerX;
        opacity = 1.0;
      }

      // GPU-accelerated subpixel positioning (text and image travel as ONE unit)
      el.style.transform = `translate3d(${Math.round(x)}px, 0, 0) translate(-50%, 0)`;
      el.style.opacity = opacity.toFixed(3);
    });
  }

  createMilestoneElement(c) {
    const el = document.createElement('div');
    el.className = 'traveling-checkpoint';
    el.dataset.milestone = c.milestone;

    let mediaHtml = '';
    const imgSrc = c.image || c.remoteImage;
    if (imgSrc) {
      const tiltClass = (c.tilt && c.tilt > 2.8) ? 'tilt-strong' : 'tilt-subtle';
      if (c.link) {
        mediaHtml = `
          <div class="checkpoint-media-wrapper">
            <a href="${c.link}" target="_blank" rel="noopener noreferrer" class="checkpoint-image-link" tabindex="-1">
              <img class="checkpoint-img ${tiltClass}" src="${imgSrc}" alt="Prashant Tiwari" />
              ${c.showClickMe ? '<span class="click-me-badge">CLICK ME ↗</span>' : ''}
            </a>
          </div>
        `;
      } else {
        mediaHtml = `
          <div class="checkpoint-media-wrapper">
            <div class="checkpoint-image-wrap">
              <img class="checkpoint-img ${tiltClass}" src="${imgSrc}" alt="Prashant Tiwari" />
            </div>
          </div>
        `;
      }
    } else if (c.email) {
      mediaHtml = `
        <div class="checkpoint-media-wrapper">
          <div class="checkpoint-email-wrap">
            <a href="mailto:${c.email}" class="checkpoint-email-link">
              <svg class="email-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              <span>${c.email}</span>
            </a>
          </div>
        </div>
      `;
    }

    el.innerHTML = `
      <div class="checkpoint-unit">
        <div class="checkpoint-text">${c.text}</div>
        ${mediaHtml}
      </div>
    `;

    // Handle image load / error gracefully
    if (c.image || c.remoteImage) {
      const imgEl = el.querySelector('.checkpoint-img');
      if (imgEl) {
        if (imgEl.complete && imgEl.naturalWidth > 0) {
          imgEl.classList.add('loaded');
        } else {
          imgEl.onload = () => imgEl.classList.add('loaded');
          imgEl.onerror = () => {
            if (c.remoteImage && imgEl.src !== c.remoteImage) {
              imgEl.src = c.remoteImage;
            } else {
              const wrap = el.querySelector('.checkpoint-media-wrapper');
              if (wrap) wrap.style.display = 'none';
            }
          };
        }
      }
    }

    // Ensure interactive image and email links receive clean touch events without gameplay propagation
    const interactiveLinks = el.querySelectorAll('.checkpoint-image-link, .checkpoint-email-link');
    interactiveLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      link.addEventListener('touchstart', (e) => {
        e.stopPropagation();
      }, { passive: true });
      link.addEventListener('touchend', (e) => {
        e.stopPropagation();
      }, { passive: true });
    });

    return el;
  }

  triggerMilestone(milestoneNumber) {
    this.unlockedMilestones.add(milestoneNumber);
    this.update(milestoneNumber);
  }

  check(score) {
    this.update(score);
  }

  reset() {
    this.unlockedMilestones.clear();
    this.renderedElements.forEach(el => el.remove());
    this.renderedElements.clear();
  }
}
