/* ============================================================
   SEO RANKER — missions.js
   Optional monthly missions. They pay a bonus budget and
   reputation, but are never required to win.
   ============================================================ */
(function () {
  'use strict';
  const SR = window.SR;
  const { clamp, randInt, shuffle } = SR;
  const S = SR.scoring;
  const R = SR.ranking;

  const M = (SR.missions = {});

  const distinct = gs => new Set(gs.actionsThisMonth.map(a => a.id)).size;
  const goodContent = gs => gs.contentCounts.good + gs.contentCounts.excellent;
  const roundTo = (n, step) => Math.ceil(n / step) * step;

  /* Each template: can it appear now, and how it is built */
  const TEMPLATES = [
    { key: 'traffic', ok: () => true,
      make: gs => { const target = roundTo(Math.max(gs.organicTraffic * 1.25, gs.organicTraffic + 60), gs.organicTraffic > 800 ? 50 : 10);
        return { title: `Reach ${SR.fmt(target)} organic visitors`, desc: 'Grow monthly organic traffic. Measured when the month ends.', metric: 'traffic', target, reward: { budget: 1200, rep: 3 } }; } },
    { key: 'health', ok: gs => gs.seoHealth < 92,
      make: gs => gs.seoHealth < 70
        ? { title: 'Improve SEO Health above 70', desc: 'Fix the issues dragging down site health.', metric: 'health', target: 71, reward: { budget: 900, rep: 3 } }
        : { title: `Push SEO Health to ${Math.min(100, gs.seoHealth + 6)}`, desc: 'Keep strengthening your site foundations.', metric: 'health', target: Math.min(100, gs.seoHealth + 6), reward: { budget: 900, rep: 2 } } },
    { key: 'top10', ok: () => true,
      make: gs => { const target = gs.top10Keywords === 0 ? 1 : gs.top10Keywords + Math.max(3, Math.round(gs.top10Keywords * 0.3));
        return { title: gs.top10Keywords === 0 ? 'Get your first Top 10 keyword' : `Reach ${target} Top 10 keywords`, desc: 'Move keywords onto page one. Rankings update at month end.', metric: 'top10', target, reward: { budget: 1200, rep: 3 } }; } },
    { key: 'links', ok: gs => gs.budget >= 1500,
      make: gs => { const target = randInt(3, 5);
        return { title: `Earn ${target} high-quality backlinks`, desc: 'High and Authority tier links count. Low-quality links do not.', metric: 'hqLinks', target, base: gs.backlinks.high + gs.backlinks.authority, reward: { budget: 1000, rep: 3 } }; } },
    { key: 'ai', ok: gs => gs.aiVisibility < 90,
      make: gs => { const d = randInt(5, 8);
        return { title: `Improve AI Visibility by ${d} points`, desc: 'A simulated metric. Content, authority, AEO and GEO all help.', metric: 'aiGain', target: d, base: gs.aiVisibility, reward: { budget: 800, rep: 2 } }; } },
    { key: 'tech', ok: gs => gs.technicalScore < 85,
      make: gs => { const target = Math.min(95, gs.technicalScore + 8);
        return { title: `Raise Technical SEO to ${target}`, desc: 'Tackle crawlability and indexing issues.', metric: 'tech', target, reward: { budget: 900, rep: 2 } }; } },
    { key: 'content', ok: gs => gs.budget >= 1500,
      make: gs => ({ title: 'Publish Good or Excellent content', desc: 'Quality over quantity. Quick, thin posts will not count.', metric: 'goodContent', target: 1, base: goodContent(gs), reward: { budget: 800, rep: 3 } }) },
    { key: 'diverse', ok: () => true,
      make: () => ({ title: 'Use 3 different action types', desc: 'A balanced strategy beats repeating one tactic.', metric: 'diverse', target: 3, reward: { budget: 600, rep: 2 } }) },
    { key: 'kw', ok: () => true,
      make: gs => { const target = Math.round(gs.rankingKeywords * 1.2 + 6);
        return { title: `Reach ${SR.fmt(target)} ranking keywords`, desc: 'Widen your keyword footprint.', metric: 'keywords', target, reward: { budget: 800, rep: 2 } }; } },
    { key: 'authority', ok: gs => gs.authority < 70,
      make: gs => { const target = gs.authority + 5;
        return { title: `Raise Authority to ${target}`, desc: 'Earn quality links. Toxic links reduce effective authority.', metric: 'authority', target, reward: { budget: 1000, rep: 3 } }; } }
  ];

  M.generate = function (gs) {
    const picks = shuffle(TEMPLATES.filter(t => t.ok(gs))).slice(0, SR.CONFIG.MISSIONS_PER_MONTH);
    return picks.map((t, i) => ({ id: `m${gs.month}-${i}`, key: t.key, done: false, ...t.make(gs) }));
  };

  M.progress = function (gs, m) {
    let value;
    switch (m.metric) {
      case 'traffic': value = gs.organicTraffic; break;
      case 'health': value = gs.seoHealth; break;
      case 'top10': value = gs.top10Keywords; break;
      case 'hqLinks': value = gs.backlinks.high + gs.backlinks.authority - m.base; break;
      case 'aiGain': value = gs.aiVisibility - m.base; break;
      case 'tech': value = gs.technicalScore; break;
      case 'goodContent': value = goodContent(gs) - m.base; break;
      case 'diverse': value = distinct(gs); break;
      case 'keywords': value = gs.rankingKeywords; break;
      case 'authority': value = gs.authority; break;
      default: value = 0;
    }
    const relative = ['hqLinks', 'aiGain', 'goodContent', 'diverse'].includes(m.metric);
    const base = relative ? 0 : (gs.start && m.startValue !== undefined ? m.startValue : 0);
    const pct = clamp(((value - base) / Math.max(1, m.target - base)) * 100, 0, 100);
    return { value: Math.round(value), target: m.target, pct: m.done ? 100 : Math.round(pct), done: m.done || value >= m.target };
  };

  /* Returns the missions completed by this evaluation */
  M.evaluate = function (gs) {
    const completed = [];
    gs.missions.forEach(m => {
      if (m.done) return;
      if (M.progress(gs, m).done) {
        m.done = true;
        gs.stats.missionsCompleted += 1;
        gs.reputation = clamp(gs.reputation + m.reward.rep, 0, 100);
        if (gs.flow.stage === 'play') gs.budget += m.reward.budget; else gs.bonusNext += m.reward.budget;
        completed.push(m);
      }
    });
    return completed;
  };

  /* Remember starting values so progress bars start from where the player is */
  M.stamp = function (gs) {
    gs.missions.forEach(m => {
      const map = { traffic: gs.organicTraffic, health: gs.seoHealth, top10: gs.top10Keywords, tech: gs.technicalScore, keywords: gs.rankingKeywords, authority: gs.authority };
      if (m.metric in map) m.startValue = map[m.metric];
    });
  };
})();
