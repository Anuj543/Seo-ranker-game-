/* ============================================================
   SEO RANKER — charts.js
   Lightweight SVG charts (no libraries, no network).
   ============================================================ */
(function () {
  'use strict';
  const SR = window.SR;
  const C = (SR.charts = {});

  const niceMax = v => {
    if (v <= 0) return 10;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  };

  C.METRICS = {
    traffic: { label: 'Organic Traffic', key: 'traffic', unit: 'visitors' },
    keywords: { label: 'Ranking Keywords', key: 'keywords', unit: 'keywords' },
    seoScore: { label: 'SEO Score', key: 'seoScore', unit: '/ 100', max: 100 },
    authority: { label: 'Authority', key: 'authority', unit: '/ 100', max: 100 }
  };

  /* Tiny inline trend line used in KPI cards */
  C.sparkline = function (values, cls = '') {
    if (values.length < 2) return '<div class="spark spark-empty" aria-hidden="true"></div>';
    const w = 100, h = 30, pad = 3;
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - pad - ((v - min) / range) * (h - pad * 2)]);
    const line = pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
    const last = pts[pts.length - 1];
    return `<svg class="spark ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.4" fill="currentColor"/></svg>`;
  };

  /* Full trend chart. width is measured from the container so text stays readable. */
  C.trend = function (series, metricId, width) {
    const m = C.METRICS[metricId];
    const vals = series.map(s => s[m.key]);
    const compact = width < 480;
    const W = Math.max(260, Math.round(width)), H = compact ? 210 : 250;
    const padL = compact ? 40 : 52, padR = 16, padT = 16, padB = 30;
    const iw = W - padL - padR, ih = H - padT - padB;
    const max = m.max || niceMax(Math.max(...vals) * 1.08);
    const x = i => padL + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw);
    const y = v => padT + ih - (v / max) * ih;
    const fmtAxis = v => (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : String(Math.round(v)));

    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i, yy = y(v);
      grid += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" class="c-grid"/><text x="${padL - 8}" y="${yy + 4}" text-anchor="end" class="c-axis">${fmtAxis(v)}</text>`;
    }
    const step = compact ? 2 : 1;
    let xl = '';
    series.forEach((s, i) => {
      if (i % step === 0 || i === series.length - 1) xl += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="c-axis">${i === 0 ? 'Start' : 'M' + s.month}</text>`;
    });
    const pts = vals.map((v, i) => [x(i), y(v)]);
    const line = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${padL},${padT + ih} ${line} ${pts[pts.length - 1][0].toFixed(1)},${padT + ih}`;
    const dots = pts.map((p, i) => {
      const label = `${i === 0 ? 'Start' : 'Month ' + series[i].month}: ${SR.fmt(vals[i])} ${m.unit}`;
      return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3.5}" class="c-dot${i === pts.length - 1 ? ' last' : ''}" data-i="${i}" tabindex="0" aria-label="${label}"><title>${label}</title></circle>`;
    }).join('');
    const last = pts[pts.length - 1];
    const lastLabel = `<text x="${Math.min(last[0], W - padR - 4)}" y="${Math.max(12, last[1] - 12)}" text-anchor="${last[0] > W - 60 ? 'end' : 'middle'}" class="c-last">${SR.fmt(vals[vals.length - 1])}</text>`;

    const rows = series.map((s, i) => `<tr><td>${i === 0 ? 'Start' : 'Month ' + s.month}</td><td>${SR.fmt(vals[i])}</td></tr>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${m.label} over time, from ${SR.fmt(vals[0])} to ${SR.fmt(vals[vals.length - 1])} ${m.unit}">
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E85D88" stop-opacity=".28"/><stop offset="1" stop-color="#E85D88" stop-opacity="0"/></linearGradient></defs>
      ${grid}${xl}<polygon points="${area}" fill="url(#cg)"/><polyline points="${line}" class="c-line" fill="none"/>${dots}${lastLabel}
    </svg>
    <table class="sr-only"><caption>${m.label} by month</caption><thead><tr><th>Month</th><th>${m.label}</th></tr></thead><tbody>${rows}</tbody></table>`;
  };

  /* Ring gauge for the SEO score */
  C.ring = function (value, size = 132, stroke = 12) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track" stroke-width="${stroke}" fill="none"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fill" stroke-width="${stroke}" fill="none" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - SR.clamp(value, 0, 100) / 100)).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  };
})();
