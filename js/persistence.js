// =============================================================================
// INTRODUCTION DINO - PERSISTENCE MANAGER
// Stores High Score in localStorage; Refresh always starts a fresh run
// =============================================================================

import { CONFIG } from './config.js';

export class PersistenceManager {
  static getHighScore() {
    try {
      const val = localStorage.getItem(CONFIG.storage.highScoreKey);
      return val ? parseInt(val, 10) || 0 : 0;
    } catch (e) {
      return 0;
    }
  }

  static setHighScore(score) {
    try {
      const current = this.getHighScore();
      if (score > current) {
        localStorage.setItem(CONFIG.storage.highScoreKey, Math.floor(score).toString());
        return true;
      }
    } catch (e) {}
    return false;
  }

  static getMuteState() {
    try {
      const val = localStorage.getItem(CONFIG.storage.mutedKey);
      return val !== null ? JSON.parse(val) : false;
    } catch (e) {
      return false;
    }
  }

  static setMuteState(muted) {
    try {
      localStorage.setItem(CONFIG.storage.mutedKey, JSON.stringify(muted));
    } catch (e) {}
  }
}
