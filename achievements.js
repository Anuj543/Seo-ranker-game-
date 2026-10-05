/* ============================================================
   SEO RANKER — achievements.js
   Achievement definitions with progress, plus the persistent
   player profile (XP, level, lifetime stats) in localStorage.
   ============================================================ */
(function () {
  'use strict';
  const SR = window.SR;
  const { clamp } = SR;
  const S = SR.scoring;
  const R = SR.ranking;

  const AC = (SR.achievements = {});

  const frac = (v, t) => clamp(v / t, 0, 1);
  const distinctUsed = gs => Object.keys(gs.actionCounts).length;
  const goodCount = gs => gs.contentCounts.good + gs.contentCounts.excellent;
  const bestPos = gs => Math.min(...gs.keywords.map(k => k.position));

  AC.LIST = [
    { id: 'firstRanking', name: 'First Ranking', icon: 'fa-flag', desc: 'Bring your average ranking position into the top 50.',
      check: gs => gs.avgPosition <= 50, progress: gs => ({ f: frac(100 - gs.avgPosition, 50), label: `Avg. position #${gs.avgPosition} / #50` }) },
    { id: 'pageOne', name: 'Page One', icon: 'fa-star', desc: 'Get at least one tracked keyword onto page one (Top 10).',
      check: gs => bestPos(gs) <= 10, progress: gs => ({ f: frac(100 - bestPos(gs), 90), label: `Best position #${bestPos(gs)} / #10` }) },
    { id: 'trafficMachine', name: 'Traffic Machine', icon: 'fa-rocket', desc: 'Reach 3,000 monthly organic visitors.',
      check: gs => gs.organicTraffic >= 3000, progress: gs => ({ f: frac(gs.organicTraffic, 3000), label: `${SR.fmt(gs.organicTraffic)} / 3,000` }) },
    { id: 'authorityBuilder', name: 'Authority Builder', icon: 'fa-shield-halved', desc: 'Grow authority to 30 or higher.',
      check: gs => gs.authority >= 30, progress: gs => ({ f: frac(gs.authority, 30), label: `${gs.authority} / 30` }) },
    { id: 'technicalWizard', name: 'Technical Wizard', icon: 'fa-gear', desc: 'Reach Technical SEO 85 and SEO Health 80.',
      check: gs => gs.technicalScore >= 85 && gs.seoHealth >= 80, progress: gs => ({ f: (frac(gs.technicalScore, 85) + frac(gs.seoHealth, 80)) / 2, label: `Tech ${gs.technicalScore}/85 · Health ${gs.seoHealth}/80` }) },
    { id: 'aiSearchReady', name: 'AI Search Ready', icon: 'fa-robot', desc: 'Reach a simulated AI Visibility of 70.',
      check: gs => gs.aiVisibility >= 70, progress: gs => ({ f: frac(gs.aiVisibility, 70), label: `${gs.aiVisibility} / 70` }) },
    { id: 'seoSpecialist', name: 'SEO Specialist', icon: 'fa-chart-line', desc: 'Achieve an SEO Score of 75 or higher.',
      check: gs => gs.seoScore >= 75, progress: gs => ({ f: frac(gs.seoScore, 75), label: `${gs.seoScore} / 75` }) },
    { id: 'seoStrategist', name: 'SEO Strategist', icon: 'fa-chess', desc: 'Use 8 different types of SEO action in one campaign.',
      check: gs => distinctUsed(gs) >= 8, progress: gs => ({ f: frac(distinctUsed(gs), 8), label: `${distinctUsed(gs)} / 8 action types` }) },
    { id: 'seoMaster', name: 'SEO Master', icon: 'fa-crown', desc: 'Finish the 12 months with an SEO Score of 80 or higher.',
      check: gs => gs.phase === 'ended' && gs.seoScore >= 80, progress: gs => ({ f: frac(gs.seoScore, 80), label: `${gs.seoScore} / 80 at the end` }) },
    { id: 'recoveryExpert', name: 'Recovery Expert', icon: 'fa-heart-pulse', desc: 'Win back your traffic after a drop of 10% or more.',
      check: gs => gs.stats.recoveries >= 1, progress: gs => ({ f: gs.stats.recoveries >= 1 ? 1 : gs.stats.recoveryWatch ? 0.5 : 0, label: gs.stats.recoveryWatch ? 'Recovering...' : 'Not started' }) },
    { id: 'contentArchitect', name: 'Content Architect', icon: 'fa-pen-ruler', desc: 'Publish 5 pieces of Good or Excellent content.',
      check: gs => goodCount(gs) >= 5, progress: gs => ({ f: frac(goodCount(gs), 5), label: `${goodCount(gs)} / 5 quality pieces` }) },
    { id: 'pageOneClub', name: 'Page One Club', icon: 'fa-ranking-star', desc: 'Reach 25 Top 10 keywords.',
      check: gs => gs.top10Keywords >= 25, progress: gs => ({ f: frac(gs.top10Keywords, 25), label: `${gs.top10Keywords} / 25` }) },
    { id: 'missionSpecialist', name: 'Mission Specialist', icon: 'fa-bullseye', desc: 'Complete 5 monthly missions.',
      check: gs => gs.stats.missionsCompleted >= 5, progress: gs => ({ f: frac(gs.stats.missionsCompleted, 5), label: `${gs.stats.missionsCompleted} / 5` }) },
    { id: 'marketLeader', name: 'Market Leader', icon: 'fa-trophy', desc: 'Become stronger than every competitor.',
      check: gs => gs.competitors.every(c => R.competitorStrength(c) < S.strength(gs)), progress: gs => ({ f: frac(S.strength(gs), Math.max(...gs.competitors.map(R.competitorStrength)) + 0.01), label: gs.pressure <= -1 ? 'Ahead of rivals' : 'Behind the leader' }) }
  ];
  AC.byId = id => AC.LIST.find(a => a.id === id);

  /* Unlock anything newly earned; returns the new achievement defs */
  AC.check = function (gs) {
    const fresh = [];
    AC.LIST.forEach(a => {
      if (!gs.achievements[a.id] && a.check(gs)) {
        gs.achievements[a.id] = gs.month;
        gs.monthAchievements.push(a.id);
        fresh.push(a);
      }
    });
    return fresh;
  };

  /* ---------- Player profile ---------- */
  const P = (SR.profile = {});
  const LEVELS = [0, 80, 200, 380, 620, 920, 1300, 1800];
  const TITLES = ['SEO Trainee', 'SEO Executive', 'SEO Specialist', 'Senior Specialist', 'SEO Strategist', 'Senior Strategist', 'SEO Master', 'SEO Legend'];

  P.defaults = () => ({ xp: 0, campaigns: 0, bestTraffic: 0, bestSeoScore: 0, bestGrade: '-', achievements: {}, reputation: 50, missions: 0 });

  P.load = function () {
    try {
      const raw = localStorage.getItem(SR.CONFIG.PROFILE_KEY);
      return raw ? { ...P.defaults(), ...JSON.parse(raw) } : P.defaults();
    } catch (e) { return P.defaults(); }
  };
  P.save = function (p) { try { localStorage.setItem(SR.CONFIG.PROFILE_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ } };

  P.level = xp => {
    let lvl = 0;
    LEVELS.forEach((t, i) => { if (xp >= t) lvl = i; });
    const next = LEVELS[lvl + 1];
    return { level: lvl + 1, title: TITLES[lvl], xp, floor: LEVELS[lvl], next: next === undefined ? null : next,
      pct: next === undefined ? 100 : Math.round(((xp - LEVELS[lvl]) / (next - LEVELS[lvl])) * 100) };
  };

  P.addXp = function (amount) { const p = P.load(); p.xp += amount; P.save(p); return p; };

  /* Called as things happen during a campaign */
  P.noteAchievements = function (ids) {
    if (!ids.length) return;
    const p = P.load();
    ids.forEach(id => { if (!p.achievements[id]) { p.achievements[id] = true; p.xp += 40; } });
    P.save(p);
  };

  P.recordCampaign = function (gs, grade) {
    const p = P.load();
    const bonus = { S: 300, A: 200, B: 130, C: 80, D: 40, F: 15 }[grade] || 15;
    p.xp += bonus;
    p.campaigns += 1;
    p.bestTraffic = Math.max(p.bestTraffic, gs.organicTraffic);
    p.bestSeoScore = Math.max(p.bestSeoScore, gs.seoScore);
    p.reputation = gs.reputation;
    const order = ['-', 'F', 'D', 'C', 'B', 'A', 'S'];
    if (order.indexOf(grade) > order.indexOf(p.bestGrade)) p.bestGrade = grade;
    P.save(p);
    return p;
  };
})();
