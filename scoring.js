/* ============================================================
   SEO RANKER — scoring.js
   SEO score, AI visibility, labels and diagnostic text.
   Pure functions over the game state (no DOM).
   ============================================================ */
(function () {
  'use strict';
  const SR = window.SR;
  const { clamp, cap } = SR;

  const S = (SR.scoring = {});

  /* Authority after subtracting the drag from toxic links */
  S.effectiveAuthority = gs => Math.max(0, gs.authority - gs.toxicity * 0.3);
  S.authNorm = gs => clamp(S.effectiveAuthority(gs) * 1.8, 0, 100);

  /* SEO Score: Technical 25 / Content 30 / Authority 20 / Linking 15 / UX 10 */
  S.seoScore = gs =>
    Math.min(100, Math.round(
      gs.technicalScore * 0.25 + gs.contentScore * 0.30 + S.authNorm(gs) * 0.20 +
      gs.internalLinking * 0.15 + gs.userExperience * 0.10
    ));

  /* AI visibility from five simulated factors */
  S.aiFactors = gs => ({
    entity: cap(gs.ai.entity),
    clarity: cap(gs.ai.clarity),
    topical: cap(gs.topicalAuthority),
    structured: cap(gs.ai.structured),
    source: cap(S.effectiveAuthority(gs) * 1.4)
  });
  S.AI_WEIGHTS = { entity: 0.2, clarity: 0.25, topical: 0.2, structured: 0.2, source: 0.15 };
  S.aiVisibility = gs => {
    const f = S.aiFactors(gs);
    return cap(Object.keys(S.AI_WEIGHTS).reduce((sum, k) => sum + f[k] * S.AI_WEIGHTS[k], 0));
  };

  /* Overall competitive strength (also used for competitors) */
  S.strength = gs => S.authNorm(gs) * 0.4 + gs.contentScore * 0.35 + gs.technicalScore * 0.25;

  S.scoreLevel = score => {
    if (score >= 85) return { label: 'Excellent', tone: 'success' };
    if (score >= 70) return { label: 'Strong', tone: 'success' };
    if (score >= 50) return { label: 'Developing', tone: 'warning' };
    if (score >= 30) return { label: 'Needs work', tone: 'warning' };
    return { label: 'Critical', tone: 'danger' };
  };

  /* Content quality level labels */
  S.contentLevel = score => (score >= 78 ? 'Excellent' : score >= 58 ? 'Good' : score >= 35 ? 'Average' : 'Poor');

  S.pressureLabel = p => (p >= 12 ? 'High' : p >= 3 ? 'Moderate' : p >= -6 ? 'Low' : 'You lead');
  S.pressureTone = p => (p >= 12 ? 'danger' : p >= 3 ? 'warning' : 'success');

  /* Single number used to judge whether a move helped or hurt */
  S.valueIndex = gs =>
    S.seoScore(gs) + gs.aiVisibility * 0.2 + gs.authority * 0.3 + Math.sqrt(gs.rankingKeywords) * 1.2 +
    gs.seoHealth * 0.15 - gs.toxicity * 0.35 - gs.contentDebt * 0.3;

  S.positionLabel = pos => {
    if (pos <= 3) return 'Top 3: excellent visibility';
    if (pos <= 10) return 'Page 1: strong visibility';
    if (pos <= 20) return 'Page 2: growing visibility';
    if (pos <= 30) return 'Page 3: developing';
    if (pos <= 50) return 'Pages 4-5: low visibility';
    return 'Pages 6+: very low visibility';
  };

  /* What is helping / hurting the SEO score */
  S.explain = gs => {
    const comps = SR.COMPONENTS.map(c => {
      const value = c.key === 'authNorm' ? Math.round(S.authNorm(gs)) : Math.round(gs[c.key]);
      const status = value >= 60 ? 'helping' : value < 40 ? 'hurting' : 'neutral';
      return { ...c, value, status, contribution: +(value * c.weight).toFixed(1), max: c.weight * 100, text: S.componentText(c.id, value, gs) };
    });
    const extras = [];
    if (gs.toxicity >= 10) extras.push({ status: 'hurting', text: `Toxic links are cutting your effective authority by about ${Math.round(gs.toxicity * 0.3)} points.` });
    if (gs.contentDebt >= 10) extras.push({ status: 'hurting', text: 'Thin, low-quality pages are building up content debt and will erode content quality.' });
    if (gs.pressure >= 8) extras.push({ status: 'hurting', text: 'Competitors are stronger than you, which makes ranking harder.' });
    if (gs.pressure <= -6) extras.push({ status: 'helping', text: 'You are ahead of your competitors, which gives you a ranking edge.' });
    return { comps, extras };
  };

  S.componentText = (id, v) => {
    const t = {
      technical: [
        'Crawl and indexing problems are suppressing everything else. Fix this first.',
        'The foundation is decent but leaves ranking potential on the table.',
        'Strong technical health. Search engines can crawl and index you cleanly.'
      ],
      content: [
        'Content is thin or unhelpful, so there is little for pages to rank on.',
        'Content is serviceable. Depth and quality would lift more keywords.',
        'High quality, in-depth content is a major ranking asset.'
      ],
      authority: [
        'Few trustworthy sites link to you, so competing for tough terms is hard.',
        'Authority is growing. Relevant, quality links will compound it.',
        'Strong authority lets you compete for competitive keywords.'
      ],
      linking: [
        'Pages are poorly connected, so ranking strength is not flowing through the site.',
        'Internal links work but could route authority to priority pages better.',
        'A strong internal link structure is spreading authority efficiently.'
      ],
      ux: [
        'Slow or clumsy pages are losing visitors and weakening signals.',
        'Experience is acceptable. Core Web Vitals could still improve.',
        'Fast, smooth pages keep visitors engaged and protect rankings.'
      ]
    }[id];
    return v < 40 ? t[0] : v < 60 ? t[1] : t[2];
  };
})();
