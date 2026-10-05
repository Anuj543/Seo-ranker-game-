# SEO RANKER: The SEO Specialist Game

*Build the strategy. Grow the traffic. Own the rankings.*

A free, browser-based SEO strategy simulation. You are the SEO strategist and have 12 months to turn a struggling website into an organic growth machine. Built with plain HTML, CSS and vanilla JavaScript. There is no backend, no database, no API keys and no paid services.

> **Disclaimer:** SEO Ranker is an educational simulation. Rankings, traffic, AI visibility and SEO scores are fictional game mechanics and do not represent Google's actual ranking systems or real-world performance predictions. The "GSC" screen is simulated data, and "AI Visibility" is a fictional metric.

## Run it

Open `index.html` in any modern browser. No install or build step. To publish on GitHub Pages, push the repository and enable Pages for the root folder.

Icons use Font Awesome from a CDN (the only external request). The game still works if the CDN is unreachable, just without icons.

## How it plays

1. **Onboarding:** choose a website type (E-commerce, SaaS, Local Business, Content Website), a difficulty (Beginner, Standard, Expert), then review your mission.
2. **Each month:** read the situation and recommended focus, spend 3 action points and your budget, then end the month.
3. **Month end:** competitors move, rankings shift, traffic follows with a delay, and an event and/or strategic decision may occur. You get a report that explains what worked, what hurt, the biggest win and risk, and a locally generated analyst note.
4. **After month 12:** a client-style final report with a grade (S to F), best decisions, mistakes and a copyable share result.

### Systems

- **10 actions** with costs, action points, risk, and an **impact preview** showing ranges (never exact results). Content and backlinks have quality tiers: thin content builds *content debt*, and bulk links raise *link toxicity*.
- **SEO Score** = Technical 25%, Content 30%, Authority 20%, Internal Linking 15%, User Experience 10%, with a score breakdown screen.
- **Keyword ranking simulation** with fictional keywords: position, previous, change, search potential, difficulty, top movers and losing keywords.
- **Competitors:** three rivals with authority, content, technical health and growth. Pressure is capped and rubber-banded so it stays fair.
- **15 context-aware events** (technical issues are likelier on weak sites, backlink offers on strong ones) and **9 strategic decisions** with situation, context, cost, benefit and risk.
- **AI Visibility** (simulated) from five factors, **monthly missions**, **reputation**, **14 achievements** with progress, and a persistent **player profile** (XP and level).
- Auto-save after every action, event decision and month; manual save, continue and reset.
- Tooltips (`?`) explain SEO terms in plain language.

## Project structure

```
index.html        page shell
style.css         design system (baby pink, white, dark plum, premium pink)
js/config.js      constants, website types, difficulty, keywords, glossary
js/scoring.js     SEO score, AI visibility, explanations
js/ranking.js     state creation, keyword ranking, traffic model, competitors, economy
js/actions.js     actions, previews and execution
js/events.js      random events and decisions
js/missions.js    monthly missions
js/achievements.js achievements and player profile
js/save.js        localStorage save system
js/engine.js      month flow, reports, GSC data, final report
js/charts.js      SVG charts
js/ui.js          UI infrastructure and dashboard views
js/screens.js     onboarding and modals
js/main.js        event handling and start-up
```

The game-logic files (`config` to `engine`) never touch the DOM, so the simulation can be run headless for balance testing.

## Limitations

- Everything is a simplified model for learning. Balance has been tuned with automated simulations, but it is not a prediction of real SEO outcomes.
- Saves live in one browser's `localStorage`. Clearing site data removes them. Saves from the previous version are not compatible.
