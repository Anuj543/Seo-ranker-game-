/* ============================================================
   SEO RANKER — config.js
   Constants, game data (website types, difficulty, keywords,
   glossary) and small shared utilities.
   ============================================================ */
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});

  /* ---------- Utilities ---------- */
  SR.clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  SR.cap = (v, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(v)));
  SR.rand = (a, b) => a + Math.random() * (b - a);
  SR.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  SR.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  SR.shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  SR.fmt = n => (n === undefined || n === null || Number.isNaN(n) ? '--' : Math.round(n).toLocaleString('en-IN'));
  SR.money = n => '₹' + SR.fmt(n);
  SR.signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + SR.fmt(Math.abs(n));
  SR.pct = (a, b) => (b ? ((a - b) / b) * 100 : 0);
  SR.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  SR.clone = o => JSON.parse(JSON.stringify(o));

  /* ---------- Core configuration ---------- */
  SR.CONFIG = {
    TOTAL_MONTHS: 12,
    MAX_AP: 3,
    CARRYOVER_RATE: 0.5,
    TRACKED_KEYWORDS: 16,
    MISSIONS_PER_MONTH: 3,
    SAVE_KEY: 'seoRankerSave_v3',
    PROFILE_KEY: 'seoRankerProfile_v1',
    LEGACY_SAVE_KEY: 'seoRankerSave_v2',
    DISCLAIMER:
      'SEO Ranker is an educational simulation. Rankings, traffic, AI visibility and SEO scores are fictional game mechanics and do not represent Google\'s actual ranking systems or real-world performance predictions.'
  };

  /* ---------- Difficulty ---------- */
  SR.DIFFICULTIES = {
    beginner: {
      id: 'beginner', name: 'Beginner', icon: 'fa-seedling',
      blurb: 'A gentle start. Bigger budget, calmer competitors and forgiving recoveries.',
      budget: 9500, competition: 0.8, eventChance: 0.35, negativeBias: 0.8, repair: 1.15,
      competitionLabel: 'Relaxed', eventsLabel: 'Occasional', recoveryLabel: 'Fast recovery'
    },
    standard: {
      id: 'standard', name: 'Standard', icon: 'fa-chess-pawn',
      blurb: 'The balanced experience. Competitors grow steadily and events keep you honest.',
      budget: 8000, competition: 1, eventChance: 0.45, negativeBias: 1, repair: 1,
      competitionLabel: 'Active', eventsLabel: 'Regular', recoveryLabel: 'Normal recovery'
    },
    expert: {
      id: 'expert', name: 'Expert', icon: 'fa-chess-king',
      blurb: 'Tight budget, aggressive rivals and slower recoveries. Demands a sustainable plan.',
      budget: 6500, competition: 1.25, eventChance: 0.55, negativeBias: 1.2, repair: 0.88,
      competitionLabel: 'Aggressive', eventsLabel: 'Frequent', recoveryLabel: 'Slow recovery'
    }
  };

  /* ---------- Website types ---------- */
  // keywords: { t: term, v: monthly search potential, d: difficulty 0-100 }
  SR.WEBSITE_TYPES = {
    ecommerce: {
      id: 'ecommerce', name: 'E-commerce Store', short: 'E-commerce', icon: 'fa-cart-shopping',
      blurb: 'Sell products online. Healthy revenue per visitor, but crowded commercial keywords.',
      challenge: 'Fierce competition on product keywords and thin category pages.',
      dots: 3, traffic: 150, keywords: 12, seoHealth: 55, authority: 10,
      contentScore: 20, technicalScore: 55, internalLinking: 20, userExperience: 40,
      ai: { entity: 8, clarity: 10, structured: 12 }, topical: 14, coverage: 12,
      revenuePerVisitor: 15, reputation: 50,
      taglines: ['Building product page authority...', 'Optimizing category pages...', 'Growing organic product traffic...'],
      competitors: ['ShopNova', 'TrendMart', 'CartCraft', 'UrbanBasket'],
      keywordPool: [
        ['best ecommerce platform', 4400, 80], ['online fashion store', 3600, 70], ['ecommerce fulfillment', 1900, 55],
        ['buy sneakers online', 5400, 85], ['organic cotton t-shirts', 1300, 40], ['same day delivery store', 1000, 45],
        ['cheap home decor online', 2900, 68], ['gift ideas for her', 3300, 72], ['sustainable clothing brands', 2200, 60],
        ['free shipping fashion', 1500, 50], ['kids winter jackets', 1700, 52], ['vegan leather bags', 1100, 42],
        ['wardrobe essentials checklist', 600, 25], ['how to size a running shoe', 800, 28], ['best backpacks for travel', 2800, 66],
        ['affordable watches for men', 2400, 62], ['shopify seo services', 900, 48], ['product page seo tips', 500, 30],
        ['return policy best practices', 450, 22], ['handmade jewelry online', 1800, 50], ['festive season sale deals', 3000, 65],
        ['compare phone deals', 2600, 74], ['eco friendly packaging supplies', 1200, 38], ['men\'s formal shoes online', 3100, 70]
      ]
    },
    saas: {
      id: 'saas', name: 'SaaS Website', short: 'SaaS', icon: 'fa-code',
      blurb: 'Software as a service. High revenue per visitor and long-tail opportunities.',
      challenge: 'Expensive head terms. Authority and topical depth decide who wins.',
      dots: 4, traffic: 100, keywords: 8, seoHealth: 60, authority: 12,
      contentScore: 25, technicalScore: 60, internalLinking: 25, userExperience: 45,
      ai: { entity: 12, clarity: 14, structured: 14 }, topical: 18, coverage: 10,
      revenuePerVisitor: 30, reputation: 55,
      taglines: ['Growing SaaS organic pipeline...', 'Ranking for high-intent keywords...', 'Capturing bottom-of-funnel traffic...'],
      competitors: ['FlowBase', 'Taskwise', 'ClarityCloud', 'Sprintly'],
      keywordPool: [
        ['best project management software', 5000, 88], ['crm for small business', 4200, 82], ['invoice software free', 3600, 76],
        ['team collaboration tool', 2800, 70], ['api documentation tools', 900, 45], ['saas onboarding checklist', 700, 30],
        ['customer churn calculator', 800, 28], ['no code automation platform', 2400, 66], ['time tracking app for freelancers', 1900, 58],
        ['kanban board software', 2100, 60], ['how to reduce saas churn', 1100, 38], ['product analytics tools', 2000, 64],
        ['helpdesk software comparison', 1500, 62], ['workflow automation examples', 1300, 44], ['okr software for startups', 900, 46],
        ['saas pricing page examples', 1000, 36], ['remote team standup tool', 800, 40], ['project status report template', 2700, 50],
        ['burn rate calculator', 600, 24], ['best email scheduling app', 1700, 58], ['agile retrospective ideas', 1600, 34],
        ['client portal software', 1100, 52], ['software demo request tips', 400, 20], ['integration marketplace examples', 500, 32]
      ]
    },
    local: {
      id: 'local', name: 'Local Business', short: 'Local Business', icon: 'fa-location-dot',
      blurb: 'A neighbourhood service business. Local SEO gives an early edge in nearby searches.',
      challenge: 'Small keyword universe. Reviews and local relevance matter more than raw links.',
      dots: 2, traffic: 180, keywords: 15, seoHealth: 65, authority: 8,
      contentScore: 15, technicalScore: 65, internalLinking: 15, userExperience: 50,
      ai: { entity: 6, clarity: 8, structured: 8 }, topical: 10, coverage: 14,
      revenuePerVisitor: 20, reputation: 60,
      taglines: ['Dominating local search results...', 'Building local citation presence...', 'Improving Google Business Profile...'],
      competitors: ['BrightSmile Studio', 'CityDental Hub', 'PearlCare Clinic', 'Urban Dental Co'],
      keywordPool: [
        ['dentist near me', 6000, 75], ['emergency dental care', 2200, 58], ['teeth whitening cost', 2800, 60],
        ['best dental clinic in town', 1800, 52], ['invisalign consultation', 1500, 50], ['family dentist open saturday', 900, 38],
        ['root canal pain relief', 1600, 44], ['kids dentist near me', 1300, 45], ['dental implants price', 2400, 62],
        ['cheap dental checkup', 1100, 42], ['dentist accepting new patients', 700, 30], ['orthodontist reviews', 800, 40],
        ['gum disease symptoms', 2100, 46], ['dental clinic parking', 300, 12], ['walk in dentist', 1400, 48],
        ['wisdom tooth removal recovery', 1900, 45], ['dentist for anxious patients', 500, 26], ['teeth cleaning how often', 1700, 36],
        ['dental insurance accepted', 900, 34], ['braces for adults', 1300, 48], ['same day crown', 700, 40],
        ['pediatric dentist reviews', 600, 30], ['dental x-ray safety', 800, 28], ['emergency dentist open now', 1900, 62]
      ]
    },
    content: {
      id: 'content', name: 'Content Website', short: 'Content Website', icon: 'fa-newspaper',
      blurb: 'A blog or media site. The most starting traffic, but revenue per visitor is low.',
      challenge: 'Broad topics, thin authority and a constant need for content quality.',
      dots: 5, traffic: 250, keywords: 22, seoHealth: 50, authority: 6,
      contentScore: 30, technicalScore: 50, internalLinking: 30, userExperience: 35,
      ai: { entity: 14, clarity: 18, structured: 16 }, topical: 26, coverage: 24,
      revenuePerVisitor: 2, reputation: 45,
      taglines: ['Publishing content at scale...', 'Building topical authority...', 'Growing editorial link profile...'],
      competitors: ['The Daily Nest', 'Wander & Co', 'Habitly Blog', 'Plainly Wise'],
      keywordPool: [
        ['how to start a blog', 4500, 76], ['healthy meal prep ideas', 4000, 72], ['beginner yoga routine', 3200, 64],
        ['work from home tips', 2800, 60], ['best budget travel destinations', 4800, 78], ['how to save money fast', 3800, 70],
        ['easy weeknight dinners', 3500, 68], ['morning routine ideas', 2600, 50], ['minimalist home office setup', 1200, 40],
        ['how to learn guitar', 2400, 56], ['productivity apps compared', 1800, 58], ['solo travel safety tips', 1600, 44],
        ['indoor plants for beginners', 2100, 46], ['ten minute workouts', 2300, 52], ['book club discussion questions', 900, 30],
        ['weekend getaway ideas', 2500, 60], ['how to meditate', 3000, 66], ['cheap healthy recipes', 2200, 54],
        ['digital declutter guide', 700, 26], ['side hustle ideas', 3600, 74], ['how to journal', 1500, 36],
        ['camping checklist', 1900, 42], ['best podcasts for learning', 1200, 38], ['budget planner template', 2100, 48]
      ]
    }
  };

  /* ---------- SEO education glossary (tooltips) ---------- */
  SR.GLOSSARY = {
    traffic: ['Organic Traffic', 'Simulated monthly visitors arriving from search results. It follows your keyword rankings with a delay: SEO takes time.'],
    keywords: ['Ranking Keywords', 'The total number of search queries your site shows up for. Broader coverage means more entry points.'],
    top10: ['Top 10 Keywords', 'Keywords ranking on page one. Most clicks go to the first few results, so page one is where traffic is won.'],
    seoScore: ['SEO Score', 'A weighted blend of Technical SEO (25%), Content Quality (30%), Authority (20%), Internal Linking (15%) and User Experience (10%).'],
    seoHealth: ['SEO Health', 'A simulated overall site-health indicator. It drifts toward your technical and UX quality, so neglected foundations drag it down.'],
    authority: ['Authority', 'A simulated measure of how strongly your website can compete for rankings. Earned mostly through relevant, quality backlinks.'],
    aiVisibility: ['AI Visibility', 'A fictional game metric representing visibility potential in AI-assisted search. It is not a measurement of any real AI search ranking.'],
    revenue: ['Revenue', 'Simulated monthly revenue: organic visitors multiplied by your site type\'s revenue per visitor.'],
    reputation: ['SEO Reputation', 'A secondary 0-100 metric. It rises with sustainable growth, good decisions and completed missions, and falls when risky tactics backfire.'],
    technical: ['Technical SEO', 'A simulated measure of crawlability, indexability and technical health.'],
    content: ['Content Quality', 'How helpful, accurate and in-depth your pages are. Thin or spammy content hurts you over time.'],
    linking: ['Internal Linking', 'How well your own pages link to each other. Good structure helps crawlers discover pages and spreads ranking strength.'],
    ux: ['User Experience', 'Page speed, mobile usability and Core Web Vitals. Poor experience loses visitors and weakens rankings.'],
    topical: ['Topical Authority', 'How completely your site covers a subject. Depth across related pages builds trust on that topic.'],
    coverage: ['Keyword Coverage', 'The share of valuable keywords in your niche that you have content for.'],
    toxicity: ['Link Toxicity', 'A hidden risk meter for low-quality or spammy backlinks. High toxicity reduces effective authority and invites penalties.'],
    debt: ['Content Debt', 'Accumulated thin or low-quality pages. It slowly erodes content quality and can trigger cleanups that cost you traffic.'],
    pressure: ['Competitor Pressure', 'How much stronger rivals are than you right now. High pressure makes ranking harder; being ahead gives a small edge.'],
    entity: ['Entity Coverage', 'How clearly your brand, products and topics are defined as recognisable entities.'],
    clarity: ['Answer Clarity', 'How directly your content answers questions in a concise, quotable way.'],
    structured: ['Structured Content', 'Headings, lists, tables and schema markup that make content easy for machines to parse.'],
    source: ['Source Quality', 'How trustworthy and well-cited your site appears as a source. It follows your authority.'],
    ctr: ['CTR', 'Click-through rate: the percentage of impressions that become clicks.'],
    impressions: ['Impressions', 'How many times your pages appeared in simulated search results.'],
    position: ['Average Position', 'Where your tracked keywords rank on average. Lower is better; 1 is the top result.'],
    difficulty: ['Keyword Difficulty', 'How hard a keyword is to rank for. Harder keywords need more authority and quality.'],
    potential: ['Search Potential', 'A simulated size of the monthly search demand for a keyword.'],
    ap: ['Action Points', 'You have 3 per month. Each action uses at least one, so you must prioritise.'],
    budget: ['Budget', 'Your monthly marketing budget. Half of what you leave unspent carries over.'],
    risk: ['Risk Level', 'How likely an action is to backfire. Shortcuts are cheap but risky; quality work is slower and safer.']
  };

  /* ---------- Component metadata used across UI/logic ---------- */
  SR.COMPONENTS = [
    { id: 'technical', key: 'technicalScore', label: 'Technical SEO', weight: 0.25, icon: 'fa-gear' },
    { id: 'content', key: 'contentScore', label: 'Content Quality', weight: 0.30, icon: 'fa-file-lines' },
    { id: 'authority', key: 'authNorm', label: 'Authority', weight: 0.20, icon: 'fa-shield-halved' },
    { id: 'linking', key: 'internalLinking', label: 'Internal Linking', weight: 0.15, icon: 'fa-diagram-project' },
    { id: 'ux', key: 'userExperience', label: 'User Experience', weight: 0.10, icon: 'fa-mobile-screen' }
  ];
})();
