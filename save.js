/* ============================================================
   SEO RANKER — save.js
   localStorage save system (campaign saves + safe loading).
   ============================================================ */
(function () {
  'use strict';
  const SR = window.SR;
  const SV = (SR.save = {});

  SV.write = function (gs) {
    if (!gs) return false;
    try {
      localStorage.setItem(SR.CONFIG.SAVE_KEY, JSON.stringify(gs));
      return true;
    } catch (e) {
      console.warn('SEO Ranker: could not save', e);
      return false;
    }
  };

  SV.read = function () {
    try {
      const raw = localStorage.getItem(SR.CONFIG.SAVE_KEY);
      if (!raw) return null;
      const gs = JSON.parse(raw);
      // Reject malformed or outdated saves instead of crashing
      if (!gs || gs.version !== 3 || !Array.isArray(gs.keywords) || !gs.start) return null;
      return gs;
    } catch (e) {
      console.warn('SEO Ranker: save was unreadable and has been ignored', e);
      return null;
    }
  };

  SV.has = () => !!SV.read();

  SV.clear = function () {
    try { localStorage.removeItem(SR.CONFIG.SAVE_KEY); } catch (e) { /* ignore */ }
  };
})();
