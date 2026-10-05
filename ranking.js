/* ============================================================
   SEO RANKER — ranking.js
   Game state creation, keyword ranking simulation, traffic model,
   competitor simulation and economy. No DOM access.
   ============================================================ */
(function () {
  'use strict';
  const SR = window.SR;
  const { clamp, cap, rand, randInt, pick, shuffle, CONFIG } = SR;
  const S = SR.scoring;

  const R = (SR.ranking = {});

  /* ---------- Game state ---------- */
  R.createGame = function (typeId, diffId) {
    const T = SR.WEBSITE_TYPES[typeId];
    const D = SR.DIFFICULTIES[diffId];
    const jit = (v, spread) => Math.max(1, Math.round(v + rand(-spread, spread)));
    const pool = shuffle(T.keywordPool).map(([t, v, d]) => ({ term: t, volume: v, difficulty: d }));

    const gs = {
      version: 3,
      websiteType: typeId, websiteName: T.name, difficulty: diffId,
      month: 1, phase: 'playing', flow: { stage: 'play' },
      budget: D.budget, carryover: 0, budgetUsedThisMonth: 0, bonusNext: 0,
      actionPoints: CONFIG.MAX_AP, actionsThisMonth: [],

      organicTraffic: jit(T.traffic, T.traffic * 0.08),
      rankingKeywords: jit(T.keywords, 2), top10Keywords: 0, avgPosition: 80,
      seoHealth: cap(jit(T.seoHealth, 4)), authority: cap(jit(T.authority, 2)),
      reputation: T.reputation, revenuePerVisitor: T.revenuePerVisitor,
      monthlyRevenue: 0, totalRevenue: 0,

      technicalScore: cap(jit(T.technicalScore, 5)), contentScore: cap(jit(T.contentScore, 4)),
      internalLinking: cap(jit(T.internalLinking, 4)), userExperience: cap(jit(T.userExperience, 5)),
      keywordCoverage: T.coverage, topicalAuthority: T.topical,
      ai: { ...T.ai }, aiVisibility: 0,
      contentDebt: 0, toxicity: 0,
      backlinks: { low: 0, medium: 0, high: 0, authority: 0 },
      contentCounts: { poor: 0, average: 0, good: 0, excellent: 0 },
      actionCounts: {},

      keywordResearchDone: false, gscBonus: false,
      trafficBoostThisMonth: 0, boostQueue: [0, 0],
      demand: { mod: 1, monthsLeft: 0, label: '' },
      rankShock: 0, pressure: 0,

      keywords: pool.slice(0, CONFIG.TRACKED_KEYWORDS), keywordReserve: pool.slice(CONFIG.TRACKED_KEYWORDS),
      competitors: [], competitorNews: [],
      missions: [], seenDecisions: [], lastEventMonth: 0, lastDecisionMonth: 0,
      monthlyHistory: [], eventLog: [], ledger: [], achievements: {}, monthAchievements: [],
      stats: { recoveries: 0, missionsCompleted: 0, unusedAP: 0, techNeglectMonths: 0, recoveryWatch: null, decisions: 0 },
      trafficCal: 1
    };

    R.refreshDerived(gs);
    R.initCompetitors(gs, T, D);
    gs.pressure = R.pressure(gs);
    R.initKeywords(gs);
    R.refreshDerived(gs);
    gs.trafficCal = 1;
    gs.trafficCal = gs.organicTraffic / Math.max(1, R.trafficTarget(gs, true));
    gs.start = R.snapshot(gs);
    gs.start.month = 0;
    return gs;
  };

  R.refreshDerived = function (gs) {
    gs.aiVisibility = S.aiVisibility(gs);
    gs.seoScore = S.seoScore(gs);
    const tracked = gs.keywords;
    const totalVol = tracked.reduce((a, k) => a + k.volume, 0) || 1;
    gs.avgPosition = Math.round(tracked.reduce((a, k) => a + k.position * k.volume, 0) / totalVol);
    const t10 = tracked.filter(k => k.position <= 10).length;
    gs.top10Keywords = t10 ? Math.max(t10, Math.round(gs.rankingKeywords * (t10 / tracked.length) * 0.5)) : 0;
    gs.monthlyRevenue = Math.round(gs.organicTraffic * gs.revenuePerVisitor);
  };

  R.snapshot = gs => ({
    month: gs.month, traffic: gs.organicTraffic, keywords: gs.rankingKeywords, top10: gs.top10Keywords,
    seoScore: gs.seoScore, health: gs.seoHealth, authority: gs.authority, aiVis: gs.aiVisibility,
    revenue: gs.monthlyRevenue, reputation: gs.reputation, technical: gs.technicalScore, content: gs.contentScore,
    linking: gs.internalLinking, ux: gs.userExperience, position: gs.avgPosition, toxicity: gs.toxicity,
    debt: gs.contentDebt, hq: gs.backlinks.high + gs.backlinks.authority, pressure: gs.pressure,
    coverage: gs.keywordCoverage, topical: gs.topicalAuthority
  });

  /* Chronological snapshots including the starting point */
  R.series = gs => [gs.start, ...gs.monthlyHistory.map(h => h.snap)];

  /* ---------- Keywords ---------- */
  R.initKeywords = function (gs) {
    const power = R.rankPower(gs);
    gs.keywords = gs.keywords.map(k => {
      const pos = clamp(Math.round(R.targetPosition(power, k.difficulty) + rand(-6, 6)), 3, 100);
      return { ...k, position: pos, prev: pos };
    });
  };

  R.rankPower = gs => {
    const base = gs.seoScore * 0.75 + gs.topicalAuthority * 0.15 + gs.keywordCoverage * 0.10;
    const pressureAdj = clamp(gs.pressure, -15, 30) * 0.25;
    return clamp(base - pressureAdj - gs.rankShock, 0, 100);
  };

  R.targetPosition = (power, difficulty) => clamp(Math.round(58 - (power - difficulty * 0.75) * 1.3), 1, 100);

  R.addTrackedKeywords = function (gs, count) {
    const added = [];
    for (let i = 0; i < count && gs.keywordReserve.length; i++) {
      const k = gs.keywordReserve.shift();
      const pos = clamp(Math.round(R.targetPosition(R.rankPower(gs), k.difficulty) + rand(5, 20)), 12, 100);
      const kw = { ...k, position: pos, prev: pos };
      gs.keywords.push(kw);
      added.push(kw);
    }
    return added;
  };

  /* Monthly ranking movement. Drops are faster than climbs. */
  R.updateKeywords = function (gs) {
    const power = R.rankPower(gs);
    gs.keywords.forEach(k => {
      k.prev = k.position;
      const target = R.targetPosition(power, k.difficulty);
      const gap = target - k.position;
      const noise = rand(-1, 1) * (2 + k.position * 0.04);
      let move;
      if (gap < 0) move = Math.max(gap * 0.32, -14); // improving
      else move = Math.min(gap * 0.42, 12);          // slipping
      k.position = clamp(Math.round(k.position + move + noise), 1, 100);
    });
    gs.rankShock = Math.round(gs.rankShock * 0.5);
  };

  /* Immediate ranking shock (events/decisions): positive delta worsens ranks */
  R.shiftKeywords = function (gs, delta, share = 1) {
    gs.keywords.forEach(k => {
      if (Math.random() <= share) k.position = clamp(Math.round(k.position + delta * rand(0.6, 1.4)), 1, 100);
    });
  };

  /* ---------- Traffic ---------- */
  // Smoothed click-through curve ("visibility"). Position 1 is far ahead, but
  // lower positions still contribute a long tail.
  R.visibility = pos => Math.pow(0.0015 + 0.30 * Math.exp(-0.18 * (pos - 1)), 0.6);

  R.trafficTarget = function (gs, ignoreBoost) {
    const raw = gs.keywords.reduce((a, k) => a + k.volume * R.visibility(k.position), 0);
    const startKw = gs.start ? gs.start.keywords : gs.rankingKeywords;
    const breadth = Math.pow(Math.max(0.5, gs.rankingKeywords / Math.max(1, startKw)), 0.7);
    let t = raw * breadth * gs.trafficCal;
    t *= 0.8 + 0.2 * Math.min(1, gs.technicalScore / 60);          // weak tech suppresses
    t *= 0.9 + 0.1 * Math.min(1, gs.userExperience / 60);          // poor UX loses visitors
    t *= 1 + (gs.aiVisibility / 100) * 0.1;                        // AI is a modest bonus
    t *= 1 - Math.min(0.2, gs.contentDebt / 150);
    t *= gs.demand.mod;
    if (!ignoreBoost) t *= 1 + R.consumeBoostPreview(gs);
    return t;
  };

  R.consumeBoostPreview = gs => gs.trafficBoostThisMonth * 0.6 + (gs.boostQueue[0] || 0);

  R.updateTraffic = function (gs) {
    const target = R.trafficTarget(gs);
    const noise = 1 + rand(-0.04, 0.04);
    const next = (gs.organicTraffic + (target - gs.organicTraffic) * 0.5) * noise;
    const floor = Math.round(gs.start.traffic * 0.3);
    gs.organicTraffic = Math.max(floor, Math.round(next));
    // boosts partially echo into later months, then fade
    const [q0, q1] = gs.boostQueue;
    gs.boostQueue = [(q1 || 0) + gs.trafficBoostThisMonth * 0.25, gs.trafficBoostThisMonth * 0.1];
    gs.trafficBoostThisMonth = 0;
  };

  /* ---------- Competitors ---------- */
  const PERSONALITIES = {
    content: { label: 'Content-led', growth: { authority: 0.6, content: 1.5, tech: 0.7 } },
    links: { label: 'Link-led', growth: { authority: 1.5, content: 0.7, tech: 0.7 } },
    tech: { label: 'Technical-led', growth: { authority: 0.7, content: 0.8, tech: 1.5 } },
    balanced: { label: 'Balanced', growth: { authority: 1, content: 1, tech: 1 } }
  };
  R.PERSONALITIES = PERSONALITIES;

  R.initCompetitors = function (gs, T, D) {
    const names = shuffle(T.competitors).slice(0, 3);
    const kinds = shuffle(['content', 'links', 'tech', 'balanced']).slice(0, 3);
    const lvl = SR.clamp(D.competition, 0.8, 1.25);
    gs.competitors = names.map((name, i) => ({
      id: 'ABC'[i], name, kind: kinds[i],
      authority: cap((T.authority + rand(8, 18)) * lvl),
      content: cap((T.contentScore + rand(12, 24)) * lvl),
      tech: cap((T.technicalScore + rand(-4, 10)) * (0.9 + lvl * 0.1)),
      growth: 0, pages: 0
    }));
  };

  R.competitorStrength = c => c.authority * 0.4 + c.content * 0.35 + c.tech * 0.25;

  /* Positive = competitors are stronger than you. */
  R.pressure = gs => {
    const strengths = gs.competitors.map(R.competitorStrength);
    const top = Math.max(...strengths);
    const avg = strengths.reduce((a, b) => a + b, 0) / strengths.length;
    return Math.round((top * 0.5 + avg * 0.5) - S.strength(gs));
  };

  R.updateCompetitors = function (gs) {
    const D = SR.DIFFICULTIES[gs.difficulty];
    const me = S.strength(gs);
    const news = [];
    gs.competitors.forEach(c => {
      const myStr = R.competitorStrength(c);
      // Fairness: rivals slow down when you are far behind them, speed up when you dominate
      const catchup = clamp(1 + (me - myStr) / 90, 0.6, 1.3);
      const g = PERSONALITIES[c.kind].growth;
      const base = 1.1 * D.competition * catchup;
      const before = { a: c.authority, c: c.content, t: c.tech };
      c.authority = clamp(c.authority + base * g.authority * rand(0.3, 1.6), 0, 92);
      c.content = clamp(c.content + base * g.content * rand(0.3, 1.8), 0, 94);
      c.tech = clamp(c.tech + base * g.tech * rand(0.1, 1.2), 0, 92);
      const dA = c.authority - before.a, dC = c.content - before.c, dT = c.tech - before.t;
      c.growth = +(dA * 0.4 + dC * 0.35 + dT * 0.25).toFixed(1);
      c.pages = Math.round(dC * 3.2 + rand(0, 3));
      const biggest = Math.max(dA, dC, dT);
      const label = c.name;
      if (biggest === dC && c.pages >= 4) news.push({ id: c.id, text: `${label} published ${c.pages} new pages.`, kind: 'content', weight: dC });
      else if (biggest === dA && dA > 1.2) news.push({ id: c.id, text: `${label} earned a wave of new backlinks.`, kind: 'links', weight: dA });
      else if (biggest === dT && dT > 1) news.push({ id: c.id, text: `${label} improved its site speed and technical health.`, kind: 'tech', weight: dT });
      else news.push({ id: c.id, text: `${label} held steady this month.`, kind: 'calm', weight: 0 });
    });
    gs.competitorNews = news.sort((a, b) => b.weight - a.weight);
    gs.pressure = R.pressure(gs);
  };

  /* ---------- Economy ---------- */
  R.monthlyBudget = function (gs) {
    const D = SR.DIFFICULTIES[gs.difficulty];
    let base = D.budget;
    if (gs.monthlyRevenue > 10000) base += 1500;
    else if (gs.monthlyRevenue > 5000) base += 1000;
    else if (gs.monthlyRevenue > 2000) base += 500;
    if (gs.seoHealth < 30) base -= 500;
    if (gs.reputation >= 70) base += 500;
    else if (gs.reputation < 30) base -= 500;
    return base + Math.round(gs.carryover * CONFIG.CARRYOVER_RATE) + gs.bonusNext;
  };
})();
