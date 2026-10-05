/* ============================================================
   SEO RANKER — events.js
   Context-aware random events and strategic decision events.
   Event probabilities depend on the player's current strategy.
   ============================================================ */
(function () {
  'use strict';
  const SR = window.SR;
  const { clamp, cap, rand, randInt, pick } = SR;
  const S = SR.scoring;
  const R = SR.ranking;
  const A = SR.actions;

  const E = (SR.events = {});

  const add = (gs, k, d) => A.addStat(gs, k, d);
  const scaleTraffic = (gs, m) => { gs.organicTraffic = Math.max(Math.round(gs.start.traffic * 0.3), Math.round(gs.organicTraffic * m)); };
  const topCompetitor = gs => gs.competitors.slice().sort((a, b) => R.competitorStrength(b) - R.competitorStrength(a))[0];

  /* ---------- Change summary chips (before vs after) ---------- */
  E.snap = gs => ({
    traffic: gs.organicTraffic, keywords: gs.rankingKeywords, health: gs.seoHealth, authority: gs.authority,
    ai: S.aiVisibility(gs), rep: gs.reputation, tech: gs.technicalScore, content: gs.contentScore,
    ux: gs.userExperience, linking: gs.internalLinking, position: gs.avgPosition, budget: gs.budget
  });

  E.diffChips = (a, b) => {
    const chips = [];
    const num = (label, key, invert) => {
      const d = Math.round(b[key] - a[key]);
      if (d) chips.push({ label, text: `${d > 0 ? '+' : '−'}${Math.abs(d)}`, tone: (invert ? d < 0 : d > 0) ? 'good' : 'bad' });
    };
    const tp = Math.round(SR.pct(b.traffic, a.traffic));
    if (tp) chips.push({ label: 'Traffic', text: `${tp > 0 ? '+' : '−'}${Math.abs(tp)}%`, tone: tp > 0 ? 'good' : 'bad' });
    num('Keywords', 'keywords'); num('Avg. position', 'position', true); num('SEO Health', 'health'); num('Authority', 'authority');
    num('Technical', 'tech'); num('Content', 'content'); num('UX', 'ux'); num('Linking', 'linking');
    num('AI Visibility', 'ai'); num('Reputation', 'rep');
    if (b.budget !== a.budget) chips.push({ label: 'Budget', text: `${b.budget > a.budget ? '+' : '−'}${SR.money(Math.abs(b.budget - a.budget))}`, tone: b.budget > a.budget ? 'good' : 'bad' });
    return chips;
  };

  /* ---------- Random events ---------- */
  const SEASON_TEXT = {
    ecommerce: 'A festive shopping season is lifting demand for products like yours.',
    saas: 'Planning and budgeting season is driving more people to research software.',
    local: 'Seasonal demand is sending more nearby customers searching for your services.',
    content: 'A seasonal trend is pushing readers toward topics you cover.'
  };

  E.RANDOM = [
    {
      id: 'algorithm_update', name: 'Google Algorithm Update', icon: 'fa-arrows-rotate', kind: 'mixed',
      weight: () => 0.8,
      run(gs) {
        const q = (gs.contentScore + gs.technicalScore) / 2 - gs.contentDebt * 0.5;
        if (q < 45) {
          R.shiftKeywords(gs, 7, 0.7); gs.rankShock += 4; scaleTraffic(gs, 0.9); add(gs, 'seoHealth', -randInt(3, 5));
          return { tone: 'bad', description: 'A core update rolled out that rewards helpful content and healthy sites. Thin content and technical weaknesses put you on the wrong side of it.' };
        }
        if (q >= 62) {
          R.shiftKeywords(gs, -6, 0.7); scaleTraffic(gs, 1.06);
          return { tone: 'good', description: 'A core update rolled out that rewards helpful content and healthy sites. Your strong foundation earned you a lift.' };
        }
        R.shiftKeywords(gs, randInt(-3, 3), 0.6); scaleTraffic(gs, 0.98);
        return { tone: 'warn', description: 'A core update shuffled results across your niche. Your rankings wobbled, but your fundamentals held up reasonably well.' };
      }
    },
    {
      id: 'content_spike', name: 'Content Spike', icon: 'fa-fire', kind: 'good',
      weight: gs => 0.2 + gs.contentScore / 70,
      run(gs) {
        scaleTraffic(gs, rand(1.14, 1.24)); add(gs, 'authority', randInt(2, 4)); gs.boostQueue[0] += 0.04;
        return { tone: 'good', description: 'One of your pages struck a chord and spread widely. It earned natural mentions from respected sites. Quality content makes this kind of luck more likely.' };
      }
    },
    {
      id: 'technical_issue', name: 'Technical Issue', icon: 'fa-bug', kind: 'bad',
      weight: gs => 0.3 + Math.max(0, 65 - gs.technicalScore) / 16,
      run(gs) {
        const sev = gs.technicalScore >= 70 ? 0.5 : 1;
        add(gs, 'technicalScore', -Math.round(randInt(4, 8) * sev)); add(gs, 'seoHealth', -Math.round(randInt(6, 10) * sev));
        scaleTraffic(gs, 1 - 0.08 * sev); R.shiftKeywords(gs, 3 * sev, 0.4);
        return {
          tone: 'bad',
          description: gs.technicalScore < 45
            ? 'Crawl errors piled up on a site that has been neglected technically. Search engines are struggling to access several pages.'
            : 'A server configuration change accidentally blocked crawlers from a set of key pages. Because your technical base is solid, the damage was limited.'
        };
      }
    },
    {
      id: 'competitor_surge', name: 'Competitor Surge', icon: 'fa-chess-knight', kind: 'bad',
      weight: gs => 0.4 + Math.max(0, gs.pressure) / 12,
      run(gs) {
        const c = topCompetitor(gs);
        const pages = randInt(18, 40);
        c.content = clamp(c.content + rand(4, 7), 0, 95); c.pages = pages;
        const soften = gs.internalLinking >= 60 ? 0.5 : 1;
        R.shiftKeywords(gs, randInt(3, 6) * soften, 0.5); scaleTraffic(gs, 1 - 0.05 * soften);
        gs.pressure = R.pressure(gs);
        return { tone: 'warn', description: `${c.name} published ${pages} new pages targeting your keywords.${soften < 1 ? ' Your strong internal linking softened the impact.' : ''}` };
      }
    },
    {
      id: 'backlink_opportunity', name: 'Backlink Opportunity', icon: 'fa-award', kind: 'good',
      weight: gs => 0.2 + gs.authority / 22 + (gs.toxicity < 10 ? 0.2 : 0),
      run(gs) {
        add(gs, 'authority', randInt(3, 6)); gs.backlinks.high += randInt(1, 2); gs.toxicity = clamp(gs.toxicity - 2, 0, 100); scaleTraffic(gs, 1.03);
        return { tone: 'good', description: 'A respected industry publication referenced your work and linked to you. Sites with solid authority attract these opportunities more often.' };
      }
    },
    {
      id: 'cannibalization', name: 'Content Cannibalization', icon: 'fa-scissors', kind: 'bad',
      weight: gs => Math.max(0.15, 0.2 + gs.rankingKeywords / 110 + gs.contentDebt / 25 - gs.internalLinking / 200),
      run(gs) {
        add(gs, 'rankingKeywords', -randInt(3, 6)); scaleTraffic(gs, 0.96); R.shiftKeywords(gs, 2, 0.3);
        return { tone: 'warn', description: 'Several of your pages are competing for the same queries and splitting ranking signals. As a site grows, this gets more likely without careful planning.' };
      }
    },
    {
      id: 'cwv_issue', name: 'Core Web Vitals Issue', icon: 'fa-gauge-high', kind: 'bad',
      weight: gs => 0.3 + Math.max(0, 55 - gs.userExperience) / 16,
      run(gs) {
        add(gs, 'userExperience', -randInt(4, 8)); add(gs, 'seoHealth', -randInt(5, 8)); scaleTraffic(gs, 0.95);
        return { tone: 'bad', description: 'A recent change to images and scripts pushed your Core Web Vitals below recommended thresholds, and mobile visitors noticed.' };
      }
    },
    {
      id: 'featured_snippet', name: 'Featured Snippet Opportunity', icon: 'fa-star', kind: 'good',
      weight: gs => (gs.contentScore >= 40 ? 0.15 + gs.contentScore / 60 + gs.ai.clarity / 70 : 0.08),
      run(gs) {
        scaleTraffic(gs, rand(1.08, 1.16)); add(gs, 'aiClarity', randInt(3, 6)); R.shiftKeywords(gs, -3, 0.2);
        return { tone: 'good', description: 'One of your clearly structured pages was selected for a featured snippet. Strong, well-organised content makes this much more likely.' };
      }
    },
    {
      id: 'ai_opportunity', name: 'AI Search Visibility Opportunity', icon: 'fa-brain', kind: 'good',
      weight: gs => 0.2 + (gs.ai.entity + gs.ai.clarity) / 160,
      run(gs) {
        add(gs, 'aiEntity', randInt(3, 6)); add(gs, 'aiClarity', randInt(2, 4)); scaleTraffic(gs, 1.04);
        return { tone: 'good', description: 'Your content was referenced in several simulated AI-assisted answers, bringing a small wave of discovery traffic.' };
      }
    },
    {
      id: 'seasonal_spike', name: 'Seasonal Demand Spike', icon: 'fa-sun', kind: 'good',
      weight: () => 0.6,
      run(gs) {
        const mod = rand(1.12, 1.25);
        gs.demand = { mod, monthsLeft: 2, label: 'Seasonal demand spike' }; scaleTraffic(gs, Math.sqrt(mod));
        return { tone: 'good', description: SEASON_TEXT[gs.websiteType] + ' Expect the lift for a couple of months.' };
      }
    },
    {
      id: 'demand_drop', name: 'Search Demand Drop', icon: 'fa-arrow-trend-down', kind: 'bad',
      weight: () => 0.5,
      run(gs) {
        const diversified = gs.rankingKeywords >= 80;
        const mod = diversified ? rand(0.92, 0.96) : rand(0.84, 0.92);
        gs.demand = { mod, monthsLeft: 2, label: 'Search demand drop' }; scaleTraffic(gs, Math.sqrt(mod));
        return { tone: 'warn', description: `Overall search demand in your niche dipped for a while.${diversified ? ' Your broad keyword coverage cushioned the fall.' : ' A narrow keyword footprint leaves you more exposed.'}` };
      }
    },
    {
      id: 'industry_trend', name: 'Industry Trend', icon: 'fa-lightbulb', kind: 'mixed',
      weight: () => 0.5,
      run(gs) {
        if (gs.keywordCoverage >= 35) {
          add(gs, 'rankingKeywords', randInt(5, 9)); add(gs, 'keywordCoverage', 2); scaleTraffic(gs, 1.04);
          return { tone: 'good', description: 'A new trend opened up fresh search topics. Your existing keyword research and content let you catch the wave.' };
        }
        add(gs, 'rankingKeywords', 2);
        return { tone: 'warn', description: 'A new trend opened up fresh search topics, but you had little prepared content, so you only caught a small part of it.' };
      }
    },
    {
      id: 'unnatural_links', name: 'Unnatural Links Warning', icon: 'fa-gavel', kind: 'bad',
      weight: gs => (gs.toxicity >= 12 ? (gs.toxicity - 8) / 9 : 0),
      run(gs) {
        add(gs, 'authority', -randInt(5, 8)); add(gs, 'reputation', -randInt(8, 12)); scaleTraffic(gs, 0.85);
        gs.toxicity = clamp(gs.toxicity - 10, 0, 100); R.shiftKeywords(gs, randInt(6, 10), 0.7); gs.rankShock += 3;
        return { tone: 'bad', description: 'A review flagged patterns of unnatural link building in your profile. You cleaned up the worst links, but the damage to trust is done.' };
      }
    },
    {
      id: 'positive_review', name: 'Surge of Positive Reviews', icon: 'fa-thumbs-up', kind: 'good',
      weight: gs => (0.35 + gs.reputation / 120) * (gs.websiteType === 'local' ? 1.8 : 1),
      run(gs) {
        add(gs, 'reputation', randInt(4, 8)); add(gs, 'authority', randInt(1, 2));
        if (gs.websiteType === 'local') scaleTraffic(gs, 1.03);
        return { tone: 'good', description: 'Customers shared glowing feedback online, boosting brand signals and trust in your site.' };
      }
    },
    {
      id: 'thin_content_cleanup', name: 'Thin Content Cleanup', icon: 'fa-broom', kind: 'bad',
      weight: gs => (gs.contentDebt >= 15 ? (gs.contentDebt - 10) / 9 : 0),
      run(gs) {
        add(gs, 'contentScore', -randInt(4, 7)); add(gs, 'rankingKeywords', -Math.round(gs.rankingKeywords * rand(0.05, 0.1)));
        scaleTraffic(gs, 0.9); gs.contentDebt = Math.max(0, gs.contentDebt - 8);
        return { tone: 'bad', description: 'Search engines discounted a batch of thin, low-value pages. The shortcuts you took earlier have come back to bite.' };
      }
    }
  ];

  E.rollEvent = function (gs) {
    const D = SR.DIFFICULTIES[gs.difficulty];
    const since = gs.month - gs.lastEventMonth;
    const chance = clamp(D.eventChance + Math.max(0, since - 2) * 0.1, 0, 0.9);
    if (Math.random() > chance) return null;
    const pool = E.RANDOM.map(ev => {
      let w = Math.max(0, ev.weight(gs));
      if (ev.kind === 'bad') w *= D.negativeBias;
      if (ev.id === gs.lastEventId) w *= 0.2;
      return { ev, w };
    }).filter(x => x.w > 0);
    const total = pool.reduce((a, x) => a + x.w, 0);
    let r = Math.random() * total;
    const chosen = (pool.find(x => (r -= x.w) <= 0) || pool[pool.length - 1]).ev;

    const before = E.snap(gs);
    const res = chosen.run(gs);
    R.refreshDerived(gs);
    const after = E.snap(gs);
    gs.lastEventId = chosen.id; gs.lastEventMonth = gs.month;
    return { id: chosen.id, name: chosen.name, icon: chosen.icon, tone: res.tone, description: res.description, chips: E.diffChips(before, after) };
  };

  /* ---------- Strategic decisions ---------- */
  const lastTrafficDrop = gs => {
    const s = R.series(gs); const n = s.length;
    return n >= 2 && s[n - 1].traffic < s[n - 2].traffic;
  };

  E.DECISIONS = [
    {
      id: 'competitor_pages', title: 'Rankings Are Slipping', icon: 'fa-chess-knight',
      situation: 'Your rankings are declining after a competitor published 30 new pages.',
      context: gs => `${topCompetitor(gs).name} is the strongest rival. Competitor pressure is ${S.pressureLabel(gs.pressure).toLowerCase()}. Your content quality is ${gs.contentScore} and internal linking ${gs.internalLinking}.`,
      weight: gs => 0.7 + Math.max(0, gs.pressure) / 10 + (lastTrafficDrop(gs) ? 0.5 : 0),
      options: [
        { id: 'quick', label: 'Publish quick, low-quality content', cost: 800, benefit: 'Fast keyword gains and a small traffic bump.', risk: 'Thin pages create content debt that can hurt later.',
          run(gs) { add(gs, 'rankingKeywords', randInt(5, 8)); scaleTraffic(gs, 1.02); add(gs, 'contentScore', -2); gs.contentDebt = clamp(gs.contentDebt + randInt(6, 10), 0, 100);
            return { tone: 'warn', summary: 'You filled the gaps quickly. Keywords rose, but quality slipped.' }; } },
        { id: 'improve', label: 'Improve existing high-potential pages', cost: 1500, benefit: 'Dependable content gains on pages that already rank.', risk: 'Slower to show results.',
          run(gs) { const g = gs.contentScore < 30 ? randInt(3, 4) : randInt(4, 6); add(gs, 'contentScore', g); add(gs, 'seoHealth', 3); add(gs, 'rankingKeywords', 2);
            return { tone: 'success', summary: `Refreshing proven pages lifted content quality by ${g}.` }; } },
        { id: 'linking', label: 'Strengthen internal linking', cost: 700, benefit: 'Cheap way to push ranking strength to key pages.', risk: 'Less effective if your structure is already good.',
          run(gs) { const half = gs.internalLinking >= 60; add(gs, 'internalLinking', half ? randInt(3, 5) : randInt(7, 11)); add(gs, 'topicalAuthority', 2);
            return { tone: 'success', summary: half ? 'Your structure was already strong, so gains were modest.' : 'Rerouting links to priority pages made a visible difference.' }; } },
        { id: 'ignore', label: 'Ignore the decline', cost: 0, benefit: 'Saves budget. Fine if the dip is just normal volatility.', risk: 'A real competitive threat will keep eating your rankings.',
          run(gs) { if (gs.pressure <= 4) return { tone: 'neutral', summary: 'You were comparable to rivals, and the dip proved to be normal volatility.' };
            scaleTraffic(gs, 0.95); add(gs, 'rankingKeywords', -2); R.shiftKeywords(gs, 3, 0.5); add(gs, 'reputation', -1);
            return { tone: 'bad', summary: 'The competitor kept gaining and your rankings slid further.' }; } }
      ]
    },
    {
      id: 'backlink_offer', title: 'A Link-Building Offer', icon: 'fa-link',
      situation: 'An agency offers 50 backlinks for ₹3,000. The sites look unrelated to your niche and have mixed quality metrics.',
      context: gs => `Your link toxicity is ${gs.toxicity >= 20 ? 'already elevated' : 'currently low'}. Authority is ${gs.authority}.`,
      weight: () => 0.8,
      options: [
        { id: 'accept', label: 'Accept the offer', cost: 3000, benefit: 'A quick-looking authority boost.', risk: 'High: bulk unrelated links often trigger quality problems.',
          run(gs) { gs.toxicity = clamp(gs.toxicity + randInt(18, 28), 0, 100); gs.backlinks.low += 50;
            if (Math.random() < 0.6) { add(gs, 'authority', -randInt(3, 5)); add(gs, 'seoHealth', -randInt(6, 9)); add(gs, 'reputation', -randInt(6, 9)); scaleTraffic(gs, 0.93);
              return { tone: 'bad', summary: 'The bulk links were flagged as low quality. Authority and trust took a hit.' }; }
            add(gs, 'authority', 2); return { tone: 'warn', summary: 'You got away with it for now, but your link profile looks riskier.' }; } },
        { id: 'negotiate', label: 'Negotiate: 10 hand-picked relevant links', cost: 1800, benefit: 'Modest authority from links that fit your niche.', risk: 'Lower volume than the original offer.',
          run(gs) { add(gs, 'authority', randInt(2, 4)); gs.backlinks.medium += 8; gs.toxicity = clamp(gs.toxicity + randInt(0, 4), 0, 100);
            return { tone: 'success', summary: 'A smaller set of relevant links delivered a safe, steady lift.' }; } },
        { id: 'pr', label: 'Invest in a content PR campaign', cost: 1500, benefit: 'Earns editorial links naturally and lifts content.', risk: 'Slower, and outcomes vary.',
          run(gs) { add(gs, 'authority', randInt(2, 4)); add(gs, 'contentScore', 2); add(gs, 'reputation', 3); gs.backlinks.high += 2;
            return { tone: 'success', summary: 'The PR push earned a couple of strong editorial links.' }; } },
        { id: 'decline', label: 'Decline politely', cost: 0, benefit: 'No risk and no spend.', risk: 'You pass on any possible upside.',
          run() { return { tone: 'neutral', summary: 'You avoided the risk and kept your link profile clean.' }; } }
      ]
    },
    {
      id: 'content_strategy', title: 'Extra Budget for Content', icon: 'fa-pen-nib',
      situation: 'You have some spare budget this month. What should your content priority be?',
      context: gs => `Content quality is ${gs.contentScore} (${S.contentLevel(gs.contentScore)}) with ${gs.contentDebt >= 10 ? 'noticeable' : 'little'} content debt.`,
      weight: gs => 0.7 + (gs.contentScore < 55 ? 0.5 : 0),
      options: [
        { id: 'pillar', label: 'Build a pillar page with cluster content', cost: 2000, benefit: 'Strong topical authority and keyword reach.', risk: 'Expensive, and payoff arrives over months.',
          run(gs) { add(gs, 'contentScore', randInt(7, 10)); add(gs, 'rankingKeywords', randInt(10, 14)); add(gs, 'internalLinking', 4); add(gs, 'topicalAuthority', 3); gs.trafficBoostThisMonth += 0.05;
            return { tone: 'success', summary: 'The pillar and its cluster built real topical depth.' }; } },
        { id: 'short', label: 'Publish several shorter articles', cost: 1000, benefit: 'Quicker keyword gains.', risk: 'Lower quality adds a little content debt.',
          run(gs) { add(gs, 'rankingKeywords', randInt(8, 11)); add(gs, 'contentScore', 3); gs.contentDebt = clamp(gs.contentDebt + 3, 0, 100); gs.trafficBoostThisMonth += 0.04;
            return { tone: 'warn', summary: 'Quick wins arrived, with a touch of added content debt.' }; } },
        { id: 'refresh', label: 'Refresh and improve existing top pages', cost: 800, benefit: 'Reliable boosts to pages that already perform.', risk: 'Does not expand your keyword footprint.',
          run(gs) { add(gs, 'contentScore', randInt(4, 6)); add(gs, 'technicalScore', 3); gs.contentDebt = Math.max(0, gs.contentDebt - 3); gs.trafficBoostThisMonth += 0.04;
            return { tone: 'success', summary: 'Updating strong pages improved quality and tidied up old issues.' }; } },
        { id: 'bank', label: 'Save the budget', cost: 0, benefit: 'Half of unspent budget carries over.', risk: 'No progress on content this month.',
          run() { return { tone: 'neutral', summary: 'You kept the cash in reserve for a better moment.' }; } }
      ]
    },
    {
      id: 'ux_vs_content', title: 'One Priority This Month', icon: 'fa-bullseye',
      situation: 'Your budget is tight this month. You can really only back one area of work.',
      context: gs => `Your weakest area is ${weakestLabel(gs)}.`,
      weight: () => 0.6,
      options: [
        { id: 'ux', label: 'Page speed and user experience', cost: 1200, benefit: 'Protects Core Web Vitals and rankings during updates.', risk: 'No new content or keywords.',
          run(gs) { add(gs, 'userExperience', randInt(9, 13)); add(gs, 'seoHealth', 4); add(gs, 'technicalScore', 2);
            return { tone: 'success', summary: 'The site feels faster and more polished.' }; } },
        { id: 'posts', label: 'Two new keyword-targeted posts', cost: 1500, benefit: 'More entry points for search traffic.', risk: 'Weak foundations limit what new pages can earn.',
          run(gs) { add(gs, 'rankingKeywords', 9); add(gs, 'contentScore', 4); gs.trafficBoostThisMonth += gs.technicalScore < 40 ? 0.02 : 0.04;
            return { tone: 'success', summary: 'Two new posts widened your keyword footprint.' }; } },
        { id: 'linkaudit', label: 'A structured internal linking audit', cost: 700, benefit: 'Cheaply improves how signals flow across pages.', risk: 'Limited effect on small sites.',
          run(gs) { add(gs, 'internalLinking', randInt(8, 11)); add(gs, 'seoHealth', 3);
            return { tone: 'success', summary: 'A tidier link structure spread authority more efficiently.' }; } },
        { id: 'pause', label: 'Pause spending', cost: 0, benefit: 'Keeps cash for later months.', risk: 'Nothing improves this month.',
          run() { return { tone: 'neutral', summary: 'You held your budget and waited.' }; } }
      ]
    },
    {
      id: 'site_migration', title: 'Redesign & Migration Proposal', icon: 'fa-server',
      situation: 'Your developers propose a full site redesign with a move to a new CMS. It could improve experience, but migrations are risky for SEO.',
      context: gs => `Technical health is ${gs.technicalScore} and user experience is ${gs.userExperience}. A shaky base makes migrations more dangerous.`,
      weight: gs => 0.35 + (gs.userExperience < 45 ? 0.5 : 0) + (gs.technicalScore < 45 ? 0.2 : 0),
      options: [
        { id: 'full', label: 'Migrate everything now', cost: 3000, benefit: 'A big jump in UX and technical quality if it goes well.', risk: 'High: botched redirects can wreck traffic.',
          run(gs) { const p = clamp(0.35 + gs.technicalScore / 150 + gs.internalLinking / 300, 0.3, 0.85);
            if (Math.random() < p) { add(gs, 'userExperience', randInt(12, 16)); add(gs, 'technicalScore', randInt(6, 10)); add(gs, 'seoHealth', 5); scaleTraffic(gs, 1.03);
              return { tone: 'success', summary: 'The migration landed cleanly and the new site is faster and cleaner.' }; }
            add(gs, 'technicalScore', -randInt(8, 12)); scaleTraffic(gs, 0.85); R.shiftKeywords(gs, 4, 0.7); gs.rankShock += 3; add(gs, 'reputation', -4);
            return { tone: 'bad', summary: 'Redirects broke and pages dropped out of the index. Recovery will take time.' }; } },
        { id: 'phased', label: 'Phase in improvements gradually', cost: 1200, benefit: 'Safe, steady experience and technical gains.', risk: 'Smaller and slower improvement.',
          run(gs) { add(gs, 'userExperience', randInt(6, 9)); add(gs, 'technicalScore', 3);
            return { tone: 'success', summary: 'Incremental upgrades improved the site with no disruption.' }; } },
        { id: 'postpone', label: 'Postpone the redesign', cost: 0, benefit: 'Zero risk and zero spend.', risk: 'Existing experience problems linger.',
          run(gs) { if (gs.userExperience < 40) { scaleTraffic(gs, 0.98); return { tone: 'warn', summary: 'The dated experience keeps costing you a few visitors.' }; }
            return { tone: 'neutral', summary: 'You wisely held off while performance was acceptable.' }; } }
      ]
    },
    {
      id: 'ai_citations', title: 'AI Answers Cite Your Rivals', icon: 'fa-robot',
      situation: 'Simulated AI-assisted search tools keep mentioning your competitors when people ask about your category, but rarely you.',
      context: gs => `Your simulated AI visibility is ${gs.aiVisibility}. It builds on solid content and authority, not just AI-specific tweaks.`,
      weight: gs => 0.3 + Math.max(0, 40 - gs.aiVisibility) / 40,
      options: [
        { id: 'aeo', label: 'Create clear, structured answer content', cost: 1000, benefit: 'Better answer clarity and structure.', risk: 'Limited without a strong content base.',
          run(gs) { add(gs, 'aiClarity', randInt(7, 11)); add(gs, 'aiStructured', randInt(5, 8)); return { tone: 'success', summary: 'Clearer, better structured answers improved your odds of being cited.' }; } },
        { id: 'entity', label: 'Build brand and entity mentions', cost: 1200, benefit: 'Stronger entity recognition and a little authority.', risk: 'Results are gradual.',
          run(gs) { add(gs, 'aiEntity', randInt(7, 11)); add(gs, 'authority', 1); return { tone: 'success', summary: 'Consistent brand mentions made your entity easier to recognise.' }; } },
        { id: 'core', label: 'Stay focused on core SEO', cost: 0, benefit: 'Keeps the team on proven fundamentals.', risk: 'Rivals may own AI mindshare.',
          run(gs) { if (gs.aiVisibility >= 40) { add(gs, 'aiClarity', -2); return { tone: 'warn', summary: 'Competitors took a little AI mindshare while you focused elsewhere.' }; }
            add(gs, 'reputation', 1); return { tone: 'neutral', summary: 'With AI visibility still small, staying on the fundamentals was reasonable.' }; } }
      ]
    },
    {
      id: 'core_update_rumor', title: 'Core Update Rumours', icon: 'fa-bullhorn',
      situation: 'Industry chatter suggests a major core update is coming. Sites with thin content are expected to suffer.',
      context: gs => `Content debt is ${gs.contentDebt >= 10 ? 'significant' : 'low'} and content quality is ${gs.contentScore}.`,
      weight: gs => 0.3 + (gs.contentDebt > 8 ? 0.8 : 0) + (gs.contentScore < 45 ? 0.4 : 0),
      options: [
        { id: 'prune', label: 'Audit and prune thin pages', cost: 1000, benefit: 'Cleans up content debt and lifts quality.', risk: 'You may lose a few ranking keywords.',
          run(gs) { gs.contentDebt = Math.max(0, gs.contentDebt - randInt(8, 12)); add(gs, 'contentScore', randInt(2, 4)); add(gs, 'rankingKeywords', -randInt(2, 4)); add(gs, 'seoHealth', 2);
            return { tone: 'success', summary: 'Removing weak pages left a leaner, stronger site.' }; } },
        { id: 'links', label: 'Buy extra links "to be safe"', cost: 2500, benefit: 'A small authority bump.', risk: 'High: it does nothing for content and may backfire.',
          run(gs) { gs.toxicity = clamp(gs.toxicity + 12, 0, 100); add(gs, 'authority', 2);
            if (Math.random() < 0.5) { add(gs, 'seoHealth', -5); add(gs, 'reputation', -5); return { tone: 'bad', summary: 'The rushed links looked manipulative and drew negative attention.' }; }
            return { tone: 'warn', summary: 'The links added a little authority but also some risk.' }; } },
        { id: 'wait', label: 'Wait and watch', cost: 0, benefit: 'Saves budget while you see what happens.', risk: 'Sites with content debt are exposed.',
          run(gs) { if (gs.contentDebt > 10 && gs.contentScore < 45) { gs.rankShock += 2; return { tone: 'warn', summary: 'The update nibbled at your weaker pages.' }; }
            return { tone: 'neutral', summary: 'Your content was healthy enough that the rumour came to nothing.' }; } }
      ]
    },
    {
      id: 'cannibalization_choice', title: 'Two Pages, One Query', icon: 'fa-clone',
      situation: 'Two of your pages are targeting the same query and competing against each other in rankings.',
      context: gs => `You have about ${gs.rankingKeywords} ranking keywords. Technical health is ${gs.technicalScore}.`,
      weight: gs => 0.3 + gs.rankingKeywords / 150,
      options: [
        { id: 'merge', label: 'Merge the pages and redirect', cost: 600, benefit: 'Consolidates ranking signals.', risk: 'Sloppy redirects on a weak site cause issues.',
          run(gs) { add(gs, 'internalLinking', 4); add(gs, 'contentScore', 2); add(gs, 'rankingKeywords', -1); add(gs, 'technicalScore', gs.technicalScore < 30 ? -2 : 2);
            return { tone: 'success', summary: 'Consolidating the pages concentrated their strength.' }; } },
        { id: 'differentiate', label: 'Differentiate both pages', cost: 1000, benefit: 'Each page targets a distinct intent and adds keywords.', risk: 'More work than a merge.',
          run(gs) { add(gs, 'contentScore', 4); add(gs, 'rankingKeywords', 4); add(gs, 'topicalAuthority', 2); return { tone: 'success', summary: 'Two clearly distinct pages now cover more ground together.' }; } },
        { id: 'leave', label: 'Leave things as they are', cost: 0, benefit: 'No cost.', risk: 'Mixed signals can slowly hold both pages back.',
          run(gs) { if (gs.rankingKeywords < 30) return { tone: 'neutral', summary: 'At your size, the overlap barely mattered.' };
            scaleTraffic(gs, 0.98); add(gs, 'rankingKeywords', -2); return { tone: 'warn', summary: 'The overlap quietly cost you some keywords.' }; } }
      ]
    },
    {
      id: 'seasonal_campaign', title: 'A Seasonal Window Opens', icon: 'fa-calendar-check',
      situation: 'Demand for a seasonal topic is rising in your niche. Do you chase it?',
      context: gs => `Content quality is ${gs.contentScore} and technical health is ${gs.technicalScore}.`,
      weight: () => 0.4,
      options: [
        { id: 'rush', label: 'Rush a seasonal landing page', cost: 1200, benefit: 'A quick traffic bump.', risk: 'Hasty pages can age badly and add content debt.',
          run(gs) { gs.trafficBoostThisMonth += 0.08; gs.contentDebt = clamp(gs.contentDebt + 3, 0, 100); return { tone: 'warn', summary: 'The rush page caught some demand but will not last.' }; } },
        { id: 'evergreen', label: 'Create an evergreen guide with a seasonal angle', cost: 1800, benefit: 'Short-term lift with lasting value.', risk: 'Costs more and takes more effort.',
          run(gs) { gs.trafficBoostThisMonth += 0.06; add(gs, 'contentScore', 5); add(gs, 'rankingKeywords', 6); return { tone: 'success', summary: 'A well-built guide caught the wave and will keep paying off.' }; } },
        { id: 'skip', label: 'Skip it', cost: 0, benefit: 'Keeps focus on your plan.', risk: 'You miss a possible bump.',
          run() { return { tone: 'neutral', summary: 'You stayed focused on your own roadmap.' }; } }
      ]
    }
  ];

  function weakestLabel(gs) {
    const comps = SR.COMPONENTS.map(c => ({ c, v: c.key === 'authNorm' ? S.authNorm(gs) : gs[c.key] }));
    return comps.sort((a, b) => a.v - b.v)[0].c.label;
  }

  E.rollDecision = function (gs) {
    const since = gs.month - gs.lastDecisionMonth;
    const chance = clamp(0.3 + Math.max(0, since - 2) * 0.15, 0, 0.85);
    if (Math.random() > chance) return null;
    const pool = E.DECISIONS.map(d => ({ d, w: Math.max(0.05, d.weight(gs)) * (gs.seenDecisions.includes(d.id) ? 0.25 : 1) }));
    const total = pool.reduce((a, x) => a + x.w, 0);
    let r = Math.random() * total;
    const d = (pool.find(x => (r -= x.w) <= 0) || pool[0]).d;
    gs.lastDecisionMonth = gs.month;
    return d.id;
  };

  E.getDecision = id => E.DECISIONS.find(d => d.id === id);

  E.chooseOption = function (gs, decisionId, optionId) {
    const d = E.getDecision(decisionId);
    const opt = d.options.find(o => o.id === optionId);
    if (gs.budget < opt.cost) return { ok: false, reason: `You need ${SR.money(opt.cost)}.` };
    const before = E.snap(gs);
    const beforeIndex = S.valueIndex(gs);
    gs.budget -= opt.cost;
    const res = opt.run(gs);
    R.refreshDerived(gs);
    const impact = +(S.valueIndex(gs) - beforeIndex).toFixed(1);
    gs.seenDecisions.push(d.id);
    gs.stats.decisions += 1;
    gs.ledger.push({ month: gs.month, kind: 'decision', title: `${d.title}: ${opt.label}`, detail: res.summary, impact });
    return { ok: true, summary: res.summary, tone: res.tone, impact, chips: E.diffChips(before, E.snap(gs)), choice: opt.label, title: d.title };
  };

  E.situationHint = weakestLabel;
})();
