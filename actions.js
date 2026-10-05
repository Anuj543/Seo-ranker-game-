/* ============================================================
   SEO RANKER — actions.js
   The 10 SEO actions: definitions, impact previews and execution.
   Effects are expressed as ranges so the preview never reveals
   exact outcomes. Pure game logic (no DOM).
   ============================================================ */
(function () {
  'use strict';
  const SR = window.SR;
  const { clamp, cap, rand, randInt, fmt } = SR;
  const S = SR.scoring;
  const R = SR.ranking;

  const A = (SR.actions = {});

  const STAT_LABELS = {
    technicalScore: 'Technical SEO', contentScore: 'Content Quality', internalLinking: 'Internal Linking',
    userExperience: 'User Experience', seoHealth: 'SEO Health', authority: 'Authority',
    topicalAuthority: 'Topical Authority', keywordCoverage: 'Keyword Coverage', rankingKeywords: 'Ranking Keywords',
    aiEntity: 'Entity Coverage', aiClarity: 'Answer Clarity', aiStructured: 'Structured Content', reputation: 'Reputation'
  };
  A.STAT_LABELS = STAT_LABELS;
  const DIMINISHING = new Set(['technicalScore', 'contentScore', 'internalLinking', 'userExperience', 'seoHealth', 'authority',
    'topicalAuthority', 'keywordCoverage', 'aiEntity', 'aiClarity', 'aiStructured']);
  const REPAIR = new Set(['technicalScore', 'userExperience', 'seoHealth', 'internalLinking']);

  A.getStat = (gs, k) => (k === 'aiEntity' ? gs.ai.entity : k === 'aiClarity' ? gs.ai.clarity : k === 'aiStructured' ? gs.ai.structured : gs[k]);
  A.addStat = (gs, k, d) => {
    if (k === 'aiEntity') gs.ai.entity = cap(gs.ai.entity + d);
    else if (k === 'aiClarity') gs.ai.clarity = cap(gs.ai.clarity + d);
    else if (k === 'aiStructured') gs.ai.structured = cap(gs.ai.structured + d);
    else if (k === 'rankingKeywords') gs.rankingKeywords = Math.max(1, Math.round(gs.rankingKeywords + d));
    else gs[k] = cap(gs[k] + d);
  };

  /* ---------- Content & link tier tables ---------- */
  const CONTENT_LEVELS = ['Poor', 'Average', 'Good', 'Excellent'];
  const levelOfQuality = q => (q < 35 ? 0 : q < 58 ? 1 : q < 78 ? 2 : 3);
  A.CONTENT_LEVELS = CONTENT_LEVELS;

  const CONTENT_VARIANTS = [
    { id: 'quick', name: 'Quick, thin posts', blurb: 'Fast and cheap. Quality is likely to be weak.', cost: 700, ap: 1, q: 28, debt: [3, 6], risk: 'Medium',
      stats: { contentScore: [1, 3], rankingKeywords: [3, 6], keywordCoverage: [2, 4] }, boost: [0.04, 0.07] },
    { id: 'standard', name: 'Standard SEO articles', blurb: 'Solid, well-targeted articles.', cost: 1500, ap: 1, q: 56, debt: [-1, 1], risk: 'Low',
      stats: { contentScore: [5, 8], rankingKeywords: [5, 8], keywordCoverage: [3, 5], topicalAuthority: [1, 2] }, boost: [0.05, 0.09] },
    { id: 'indepth', name: 'In-depth pillar + cluster', blurb: 'A long-form pillar with supporting pages. Takes two action points.', cost: 2800, ap: 2, q: 78, debt: [-4, -2], risk: 'Low',
      stats: { contentScore: [9, 14], rankingKeywords: [7, 12], keywordCoverage: [4, 7], topicalAuthority: [4, 7], internalLinking: [1, 3] }, boost: [0.07, 0.12] }
  ];

  const LINK_TIERS = {
    low: { id: 'low', label: 'Low', name: 'Bulk directory links', blurb: 'Dozens of cheap links from unrelated sites.', cost: 800, ap: 1,
      auth: [1, 2], tox: [8, 14], relevance: [0.2, 0.55], links: [18, 40], backfire: 0.45, risk: 'High' },
    medium: { id: 'medium', label: 'Medium', name: 'Guest post outreach', blurb: 'A handful of guest posts on reasonably relevant blogs.', cost: 1500, ap: 1,
      auth: [3, 5], tox: [0, 3], relevance: [0.45, 0.8], links: [3, 6], backfire: 0.15, risk: 'Medium' },
    high: { id: 'high', label: 'High', name: 'Digital PR campaign', blurb: 'Newsworthy assets pitched to relevant publications.', cost: 2500, ap: 1,
      auth: [5, 7], tox: [-2, 0], relevance: [0.7, 1], links: [2, 4], backfire: 0.08, risk: 'Low' },
    authority: { id: 'authority', label: 'Authority', name: 'Editorial authority outreach', blurb: 'Earned links from respected sites. Needs strong content. Takes two action points.', cost: 4000, ap: 2,
      auth: [7, 11], tox: [-3, -1], relevance: [0.85, 1], links: [1, 3], backfire: 0.05, risk: 'Low' }
  };
  A.LINK_TIERS = LINK_TIERS;

  /* Content strength needed before higher link tiers perform */
  function linkReadiness(gs, tier) {
    if (tier.id === 'high' && gs.contentScore < 35) return { mult: 0.6, note: 'Your content is too thin to attract PR links. Results will be reduced.' };
    if (tier.id === 'authority' && (gs.contentScore < 45 || gs.authority < 12))
      return { mult: 0.5, note: 'You need stronger content and some existing authority before editors take you seriously.' };
    return { mult: 1, note: '' };
  }

  /* ---------- Definitions ---------- */
  A.DEFS = {
    keywordResearch: {
      id: 'keywordResearch', name: 'Keyword Research', icon: 'fa-magnifying-glass', cat: 'content', cost: 500, ap: 1, risk: 'Low',
      desc: 'Find keywords worth targeting and start tracking new ones. Makes your next content more effective.',
      potential: ['Keyword coverage ↑', 'Boosts next content'],
      educational: 'Keyword research identifies search queries with real demand and manageable competition. It is the foundation of any effective SEO strategy, and it makes the content you publish afterwards much more targeted.',
      effects: () => ({ stats: { keywordCoverage: [2, 4], rankingKeywords: [2, 4], contentScore: [1, 3] }, boost: null,
        trafficText: 'No direct change. Sets up stronger content', notes: ['Your next content publish this month gets a bonus.'] }),
      finish(gs) {
        gs.keywordResearchDone = true;
        const added = R.addTrackedKeywords(gs, randInt(1, 2));
        return { extra: added.length ? `Now tracking: ${added.map(k => '"' + k.term + '"').join(', ')}.` : '' };
      }
    },

    publishContent: {
      id: 'publishContent', name: 'Publish SEO Content', icon: 'fa-pen-to-square', cat: 'content', cost: 1500, ap: 1, risk: 'Low',
      desc: 'Create content for your target keywords. Choose between speed and quality.',
      potential: ['Keywords ↑', 'Content quality ↑', 'Traffic potential ↑'],
      educational: 'Publishing quality content is the most impactful long-term strategy, but quality matters. Thin, rushed pages add content debt that can drag rankings down later. Strong content on a weak technical foundation also underperforms.',
      variants: CONTENT_VARIANTS,
      effects(gs, v) {
        const research = gs.keywordResearchDone;
        const km = research ? 1.3 : 1;
        const stats = {};
        Object.entries(v.stats).forEach(([k, [lo, hi]]) => {
          const m = k === 'rankingKeywords' || k === 'keywordCoverage' ? km : 1;
          stats[k] = [Math.round(lo * m), Math.round(hi * m)];
        });
        const notes = [];
        let boost = v.boost.slice();
        if (research) notes.push('Keyword Research bonus active: broader keyword reach and better quality.');
        if (gs.technicalScore < 40) { boost = boost.map(b => b * 0.5); notes.push('A weak technical foundation will limit how much traffic new pages can earn.'); }
        if (v.id === 'quick') notes.push(gs.contentDebt >= 12 ? 'You already carry content debt. More thin pages will deepen the problem.' : 'Thin pages build content debt, which can hurt you in later months.');
        const base = v.q + (research ? 10 : 0) + (gs.technicalScore < 35 ? -8 : 0);
        const lo = levelOfQuality(base - 9), hi = levelOfQuality(base + 9);
        const qualityText = lo === hi ? CONTENT_LEVELS[lo] : `${CONTENT_LEVELS[lo]} to ${CONTENT_LEVELS[hi]}`;
        return { stats, boost, notes, trafficText: 'Potential medium-term increase', rows: [{ label: 'Likely content quality', value: qualityText, tone: lo >= 2 ? 'good' : lo === 0 ? 'bad' : 'neutral' }] };
      },
      prepare(gs, v) {
        const q = v.q + (gs.keywordResearchDone ? 10 : 0) + (gs.technicalScore < 35 ? -8 : 0) + rand(-9, 9);
        const level = levelOfQuality(q);
        return { level, statMult: level === 0 ? { contentScore: 0.5, rankingKeywords: 0.8 } : level === 3 ? { contentScore: 1.1 } : {} };
      },
      finish(gs, v, ctx) {
        const key = CONTENT_LEVELS[ctx.level].toLowerCase();
        gs.contentCounts[key] += 1;
        let debt = randInt(v.debt[0], v.debt[1]) + (ctx.level === 0 ? 4 : 0) - (ctx.level === 3 ? 1 : 0);
        gs.contentDebt = clamp(gs.contentDebt + debt, 0, 100);
        let bonus = '';
        if (ctx.level === 3) { A.addStat(gs, 'topicalAuthority', randInt(1, 2)); A.addStat(gs, 'aiStructured', randInt(1, 2)); bonus = ' Excellent quality earned extra topical authority.'; }
        gs.keywordResearchDone = false;
        const debtNote = debt > 3 ? ' Thin pages added content debt.' : debt < 0 ? ' It also cleaned up some content debt.' : '';
        return { extra: `Quality: ${CONTENT_LEVELS[ctx.level]}.${bonus}${debtNote}`, tone: ctx.level === 0 ? 'warning' : 'success', content: CONTENT_LEVELS[ctx.level] };
      }
    },

    technicalSEO: {
      id: 'technicalSEO', name: 'Technical SEO Fix', icon: 'fa-wrench', cat: 'tech', cost: 1000, ap: 1, risk: 'Low',
      desc: 'Fix crawl errors, broken pages and indexing problems. Protects every other effort.',
      potential: ['Technical ↑', 'SEO health ↑'],
      educational: 'Technical SEO makes sure search engines can crawl, render and index your site. Problems like slow pages, broken links and duplicates suppress all your other work, and sites naturally accumulate new issues over time.',
      effects: gs => ({ stats: { technicalScore: [7, 13], seoHealth: [3, 6] }, boost: null,
        trafficText: 'Mostly protective. Gains appear as rankings recover',
        notes: gs.technicalScore >= 80 ? ['Your technical health is already strong. Returns are diminishing.'] : [] })
    },

    internalLinking: {
      id: 'internalLinking', name: 'Internal Linking', icon: 'fa-link', cat: 'tech', cost: 700, ap: 1, risk: 'Low',
      desc: 'Connect your pages so crawlers and ranking strength flow to what matters.',
      potential: ['Linking ↑', 'Topical authority ↑'],
      educational: 'Internal links help search engines discover pages and spread ranking strength across your site. Good structure can lift rankings without any external effort, and it matters more as your content library grows.',
      effects: gs => ({ stats: { internalLinking: [6, 11], seoHealth: [2, 4], topicalAuthority: [1, 2] }, boost: [0.01, 0.03],
        trafficText: 'Small, gradual increase', notes: gs.rankingKeywords < 25 ? ['With few pages, linking has limited impact yet.'] : [] })
    },

    buildBacklinks: {
      id: 'buildBacklinks', name: 'Build Backlinks', icon: 'fa-arrow-up-right-from-square', cat: 'authority', cost: 2000, ap: 1, risk: 'Medium',
      desc: 'Earn links from other sites. Quality and relevance beat quantity.',
      potential: ['Authority ↑', 'Ranking potential ↑'],
      educational: 'Backlinks signal trust, but link quality matters far more than quantity. A few relevant, authoritative links beat dozens of spammy ones, which can trigger penalties and drag down your authority.',
      variants: Object.values(LINK_TIERS),
      effects(gs, tier) {
        const ready = linkReadiness(gs, tier);
        const lo = Math.max(1, Math.round(tier.auth[0] * ready.mult)), hi = Math.max(lo, Math.round(tier.auth[1] * ready.mult));
        const notes = [];
        if (ready.note) notes.push(ready.note);
        if (tier.id === 'low') notes.push('Cheap links from unrelated sites raise your toxicity and often backfire.');
        if (gs.toxicity >= 25) notes.push('Your link profile already looks risky. More poor links make a penalty likelier.');
        return {
          stats: { authority: [lo, hi] }, boost: tier.id === 'low' ? null : [0.02, 0.05], notes,
          trafficText: 'Potential medium-term increase',
          riskLevel: tier.risk,
          rows: [
            { label: 'Link relevance', value: `${Math.round(tier.relevance[0] * 100)}% to ${Math.round(tier.relevance[1] * 100)}%`, tone: tier.relevance[0] >= 0.6 ? 'good' : 'bad' },
            { label: 'Link toxicity', value: tier.tox[1] > 2 ? 'Rises noticeably' : tier.tox[1] > 0 ? 'May rise slightly' : 'Stable or falls', tone: tier.tox[1] > 2 ? 'bad' : 'good' }
          ]
        };
      },
      prepare(gs, tier) {
        const ready = linkReadiness(gs, tier);
        const relevance = rand(tier.relevance[0], tier.relevance[1]);
        const bias = (relevance - tier.relevance[0]) / Math.max(0.01, tier.relevance[1] - tier.relevance[0]);
        const backfireChance = clamp(tier.backfire + (gs.toxicity > 30 ? 0.12 : 0) - (gs.contentScore > 60 ? 0.03 : 0), 0, 0.8);
        return { relevance, bias, backfire: Math.random() < backfireChance, ready };
      },
      biasKey: 'authority',
      finish(gs, tier, ctx) {
        const links = randInt(tier.links[0], tier.links[1]);
        gs.backlinks[tier.id] += links;
        gs.toxicity = clamp(gs.toxicity + randInt(tier.tox[0], tier.tox[1]), 0, 100);
        let extra = `${links} ${tier.label.toLowerCase()}-quality links at ${Math.round(ctx.relevance * 100)}% relevance.`;
        let tone = 'success';
        if (ctx.backfire) {
          const a = randInt(2, 4), h = randInt(3, 6), r = randInt(3, 5);
          A.addStat(gs, 'authority', -a); A.addStat(gs, 'seoHealth', -h); A.addStat(gs, 'reputation', -r);
          extra += ` It backfired: some links were flagged as manipulative (Authority −${a}, SEO Health −${h}, Reputation −${r}).`;
          tone = 'danger';
        }
        return { extra, tone, negative: ctx.backfire };
      }
    },

    pageExperience: {
      id: 'pageExperience', name: 'Improve Page Experience', icon: 'fa-mobile-screen', cat: 'ux', cost: 1200, ap: 1, risk: 'Low',
      desc: 'Speed up pages, fix Core Web Vitals and polish the mobile experience.',
      potential: ['User experience ↑', 'Core Web Vitals ↑'],
      educational: 'Page experience signals such as Core Web Vitals, mobile usability and HTTPS influence rankings and keep visitors engaged. Improving them also protects you during algorithm updates.',
      effects: () => ({ stats: { userExperience: [7, 13], seoHealth: [2, 4], technicalScore: [1, 3] }, boost: [0.02, 0.05], trafficText: 'Small, gradual increase', notes: [] })
    },

    localSEO: {
      id: 'localSEO', name: 'Local SEO', icon: 'fa-location-dot', cat: 'authority', cost: 800, ap: 1, risk: 'Low',
      desc: 'Optimise your business profile, citations and reviews. Strongest for local businesses.',
      potential: ['Authority ↑', 'Local visibility ↑'],
      educational: 'Local SEO targets searches with geographic intent. A complete business profile, consistent citations and good reviews help you appear in map packs and local results, which matters most for businesses serving a local area.',
      effects(gs) {
        const local = gs.websiteType === 'local';
        return local
          ? { stats: { authority: [2, 4], seoHealth: [3, 6], rankingKeywords: [3, 6] }, boost: [0.08, 0.15], trafficText: 'Potential short-term increase', notes: ['Local Business bonus active: this is a high-impact move for you.'] }
          : { stats: { authority: [1, 2] }, boost: [0.01, 0.03], trafficText: 'Small increase', notes: ['Limited relevance for your website type. Consider other priorities.'] };
      }
    },

    aeoOptimization: {
      id: 'aeoOptimization', name: 'AEO Optimization', icon: 'fa-robot', cat: 'ai', cost: 1000, ap: 1, risk: 'Low',
      desc: 'Answer Engine Optimization: structure content to answer questions directly.',
      potential: ['Answer clarity ↑', 'Structured content ↑'],
      educational: 'Answer Engine Optimization (AEO) structures content to win featured snippets, People Also Ask boxes and voice answers by answering questions clearly and concisely. It works best on top of already solid content.',
      effects: gs => ({ stats: { aiClarity: [8, 14], aiStructured: [5, 9], contentScore: [1, 3] }, boost: [0.01, 0.03],
        trafficText: 'Small increase, via snippets',
        notes: gs.contentScore < 30 ? ['Answers are only as good as the content behind them. Weak content limits this.'] : [] })
    },

    geoOptimization: {
      id: 'geoOptimization', name: 'GEO Optimization', icon: 'fa-globe', cat: 'ai', cost: 1200, ap: 1, risk: 'Low',
      desc: 'Generative Engine Optimization: strengthen entities and sources for AI-assisted search.',
      potential: ['Entity coverage ↑', 'Topical authority ↑'],
      educational: 'Generative Engine Optimization (GEO) helps AI-assisted search tools understand and reference your brand. Clear entities, consistent facts and trustworthy sources help, but this is a fast-moving area. It supports, and never replaces, core SEO.',
      effects: () => ({ stats: { aiEntity: [8, 14], topicalAuthority: [1, 3], contentScore: [0, 2] }, boost: [0.01, 0.03], trafficText: 'Small increase', notes: [] })
    },

    analyzeGSC: {
      id: 'analyzeGSC', name: 'Analyze GSC', icon: 'fa-chart-column', cat: 'insight', cost: 300, ap: 1, risk: 'Low',
      desc: 'Review simulated Search Console data to spot problems and opportunities.',
      potential: ['Insight', 'Boosts your next action'],
      educational: 'Search Console shows how Google crawls, indexes and ranks your site: queries, clicks, indexing problems and Core Web Vitals. Regular review turns guesses into prioritised fixes.',
      effects: () => ({ stats: { seoHealth: [1, 3] }, boost: null, trafficText: 'No direct change', notes: ['Unlocks a +15% effect bonus on your next action this month.'] }),
      finish(gs) { gs.gscBonus = true; return { extra: 'Reviewed the simulated data. Your next action gets a +15% effect bonus.', openGSC: true }; }
    }
  };

  A.ORDER = ['keywordResearch', 'publishContent', 'technicalSEO', 'internalLinking', 'buildBacklinks', 'pageExperience', 'localSEO', 'aeoOptimization', 'geoOptimization', 'analyzeGSC'];

  /* ---------- Resolve ranges for an action given current state ---------- */
  function variantOf(def, vid) {
    if (!def.variants) return null;
    return def.variants.find(v => v.id === vid) || def.variants[1] || def.variants[0];
  }

  A.cost = (def, v) => (v ? v.cost : def.cost);
  A.apCost = (def, v) => (v && v.ap ? v.ap : def.ap || 1);

  A.resolve = function (gs, id, vid) {
    const def = A.DEFS[id];
    const variant = variantOf(def, vid);
    const raw = def.effects(gs, variant);
    const D = SR.DIFFICULTIES[gs.difficulty];
    const bonus = gs.gscBonus && id !== 'analyzeGSC' ? 1.15 : 1;
    const ranges = {};
    // New pages only reach their potential on a sound technical and UX foundation
    const foundation = 0.5 + 0.5 * clamp((gs.technicalScore + gs.userExperience) / 2 / 65, 0, 1);
    Object.entries(raw.stats).forEach(([k, [lo, hi]]) => {
      let m = bonus;
      if (k === 'rankingKeywords') m *= foundation;
      if (DIMINISHING.has(k)) m *= clamp(1 - A.getStat(gs, k) / 170, 0.4, 1);
      if (REPAIR.has(k)) m *= D.repair;
      let l = lo * m, h = hi * m;
      if (hi > 0) { l = lo > 0 ? Math.max(1, Math.round(l)) : Math.round(l); h = Math.max(l, Math.round(h)); }
      ranges[k] = [l, h];
    });
    const boost = raw.boost ? [raw.boost[0] * bonus, raw.boost[1] * bonus] : null;
    const notes = (raw.notes || []).slice();
    if (bonus > 1) notes.unshift('GSC insight bonus active: +15% effect.');
    if (raw.stats.rankingKeywords && foundation < 0.8) notes.push('Weak technical or UX foundations reduce how many keywords new pages can reach.');
    return {
      def, variant, ranges, boost, notes, rows: raw.rows || [], trafficText: raw.trafficText,
      riskLevel: raw.riskLevel || (variant && variant.risk) || def.risk,
      cost: A.cost(def, variant), ap: A.apCost(def, variant)
    };
  };

  /* Human-friendly impact preview (ranges only, never exact results) */
  A.preview = function (gs, id, vid) {
    const r = A.resolve(gs, id, vid);
    const rows = [];
    Object.entries(r.ranges).forEach(([k, [lo, hi]]) => {
      if (hi <= 0) return;
      rows.push({ label: STAT_LABELS[k], value: lo === hi ? `+${lo}` : `+${lo} to +${hi}`, tone: 'good' });
    });
    rows.push({ label: 'Traffic', value: r.trafficText || (r.boost ? 'Potential medium-term increase' : 'No direct change'), tone: r.boost ? 'good' : 'neutral' });
    if (!('seoHealth' in r.ranges)) rows.push({ label: 'SEO Health', value: 'No major change', tone: 'neutral' });
    r.rows.forEach(x => rows.push(x));
    rows.push({ label: 'Risk', value: r.riskLevel, tone: r.riskLevel === 'High' ? 'bad' : r.riskLevel === 'Medium' ? 'warn' : 'good' });
    return { ...r, previewRows: rows };
  };

  /* Can the player afford it? */
  A.canAfford = (gs, id, vid) => {
    if (gs.phase !== 'playing') return { ok: false, reason: 'The campaign is complete.' };
    if (gs.flow.stage !== 'play') return { ok: false, reason: 'Finish the current step first.' };
    const r = A.resolve(gs, id, vid);
    if (gs.actionPoints < r.ap) return { ok: false, reason: r.ap > 1 ? `Needs ${r.ap} action points.` : 'No action points left.' };
    if (gs.budget < r.cost) return { ok: false, reason: `Needs ${SR.money(r.cost)}.` };
    return { ok: true };
  };

  /* ---------- Execute ---------- */
  A.perform = function (gs, id, vid) {
    const check = A.canAfford(gs, id, vid);
    if (!check.ok) return { ok: false, reason: check.reason };

    const r = A.resolve(gs, id, vid);
    const { def, variant } = r;
    const beforeIndex = S.valueIndex(gs);

    gs.budget -= r.cost;
    gs.actionPoints -= r.ap;
    gs.budgetUsedThisMonth += r.cost;

    const ctx = def.prepare ? def.prepare(gs, variant) : {};
    const mult = ctx.statMult || {};
    const parts = [];
    Object.entries(r.ranges).forEach(([k, [lo, hi]]) => {
      let v = def.biasKey === k ? Math.round(lo + (hi - lo) * ctx.bias) : randInt(Math.round(lo), Math.round(hi));
      if (mult[k]) v = Math.round(v * mult[k]);
      if (v === 0) return;
      A.addStat(gs, k, v);
      parts.push(`${STAT_LABELS[k]} ${v > 0 ? '+' : '−'}${Math.abs(v)}`);
    });
    if (r.boost) gs.trafficBoostThisMonth += rand(r.boost[0], r.boost[1]);

    const fin = def.finish ? def.finish(gs, variant, ctx) : {};
    if (id !== 'analyzeGSC') gs.gscBonus = false;
    gs.actionCounts[id] = (gs.actionCounts[id] || 0) + 1;

    R.refreshDerived(gs);
    const impact = +(S.valueIndex(gs) - beforeIndex).toFixed(1);
    const name = variant ? `${def.name} · ${variant.name || variant.label}` : def.name;
    const summary = `${parts.join(', ')}.${fin.extra ? ' ' + fin.extra : ''}`.trim();
    const tone = fin.tone || 'success';

    const entry = { id, variant: variant ? variant.id : null, name, shortName: def.name, cost: r.cost, ap: r.ap, summary, tone, impact, month: gs.month };
    gs.actionsThisMonth.push(entry);
    gs.ledger.push({ month: gs.month, kind: 'action', title: name, detail: summary, impact });
    return { ok: true, entry, openGSC: !!fin.openGSC, negative: !!fin.negative, contentLevel: fin.content || null };
  };
})();
