// Renders the JSON printed by alternatives.ts as the SVG charts in
// docs/best-trade-alternatives. Plain SVG, no dependencies.
//
//   node libs/best-trade/bench/alternatives-charts.mjs <results.json> <out-dir>
import { readFileSync, writeFileSync } from 'node:fs';

const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3];

const C = {
  plain: '#d62728',
  concat: '#ff7f0e',
  hour: '#2ca02c',
  seg: '#1f77b4',
  base: '#b0b0b0',
  grid: '#e5e5e5',
  text: '#222',
};
const FONT =
  'font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fmtUs = (us) =>
  us >= 1000
    ? `${(us / 1000).toFixed(2)} ms`
    : us >= 10
      ? `${us.toFixed(1)} µs`
      : `${us.toFixed(2)} µs`;

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${FONT}>
<rect width="100%" height="100%" fill="#fff"/>
${body}
</svg>
`;
}

// ---------- 1. Query time vs Time Slice length, log scale ----------
function lineChart() {
  const W = 900,
    H = 470,
    L = 80,
    R = 250,
    T = 50,
    B = 70;
  const pw = W - L - R,
    ph = H - T - B;
  const rows = d.rows;
  const yMin = -1,
    yMax = 4; // log10 µs: 0.1 µs … 10 ms
  const x = (i) => L + (i * pw) / (rows.length - 1);
  const y = (us) => T + ph - ((Math.log10(us) - yMin) / (yMax - yMin)) * ph;
  let b = `<text x="${W / 2 - R / 2 + L / 2}" y="28" text-anchor="middle" font-size="17" font-weight="600" fill="${C.text}">Query time vs Time Slice length (log scale)</text>\n`;
  for (let e = yMin; e <= yMax; e++) {
    const yy = y(10 ** e);
    b += `<line x1="${L}" x2="${L + pw}" y1="${yy}" y2="${yy}" stroke="${C.grid}"/>`;
    b += `<text x="${L - 8}" y="${yy + 4}" text-anchor="end" font-size="12" fill="${C.text}">${['0.1 µs', '1 µs', '10 µs', '100 µs', '1 ms', '10 ms'][e + 1]}</text>\n`;
  }
  rows.forEach((r, i) => {
    b += `<text x="${x(i)}" y="${T + ph + 20}" text-anchor="middle" font-size="12" fill="${C.text}">${esc(r.label)}</text>`;
  });
  b += `<text x="${L + pw / 2}" y="${H - 18}" text-anchor="middle" font-size="13" fill="${C.text}">Time Slice length</text>`;
  b += `<text x="20" y="${T + ph / 2}" text-anchor="middle" font-size="13" fill="${C.text}" transform="rotate(-90 20 ${T + ph / 2})">Median query time</text>`;
  // budget
  const by = y(1000);
  b += `<line x1="${L}" x2="${L + pw}" y1="${by}" y2="${by}" stroke="#555" stroke-dasharray="6 4"/>`;
  b += `<text x="${L + 6}" y="${by - 6}" font-size="12" fill="#555">1 ms search budget (ADR-0002)</text>\n`;
  const series = [
    ['concatMs', C.concat, 'Per-hour arrays, concatenated'],
    ['plainMs', C.plain, 'Plain loop'],
    ['hourMs', C.hour, 'Hour summaries (chosen)'],
    ['segMs', C.seg, 'Segment tree'],
  ];
  series.forEach(([k, col, name], si) => {
    const pts = rows.map((r, i) => `${x(i)},${y(r[k] * 1000)}`).join(' ');
    const wdt = k === 'hourMs' ? 4 : 2.5;
    b += `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="${wdt}"/>`;
    rows.forEach(
      (r, i) =>
        (b += `<circle cx="${x(i)}" cy="${y(r[k] * 1000)}" r="${wdt + 0.5}" fill="${col}"/>`),
    );
    const ly = T + 20 + si * 26;
    b += `<line x1="${L + pw + 20}" x2="${L + pw + 44}" y1="${ly}" y2="${ly}" stroke="${col}" stroke-width="${wdt}"/>`;
    b += `<text x="${L + pw + 50}" y="${ly + 4}" font-size="12" fill="${C.text}"${k === 'hourMs' ? ' font-weight="600"' : ''}>${esc(name)}</text>\n`;
  });
  b += `<rect x="${L}" y="${T}" width="${pw}" height="${ph}" fill="none" stroke="#999"/>`;
  return svg(W, H, b);
}

// ---------- horizontal bars ----------
function hbars({ title, subtitle, bars, max, unit, fmt, W = 820 }) {
  const L = 280,
    R = 130,
    T = subtitle ? 70 : 50,
    rowH = 46,
    barH = 26;
  const H = T + bars.length * rowH + 30;
  const pw = W - L - R;
  const sx = (v) => (v / max) * pw;
  let b = `<text x="${W / 2}" y="28" text-anchor="middle" font-size="17" font-weight="600" fill="${C.text}">${esc(title)}</text>\n`;
  if (subtitle)
    b += `<text x="${W / 2}" y="50" text-anchor="middle" font-size="12" fill="#555">${esc(subtitle)}</text>\n`;
  bars.forEach((bar, i) => {
    const yy = T + i * rowH;
    b += `<text x="${L - 10}" y="${yy + barH / 2 + 5}" text-anchor="end" font-size="13" fill="${C.text}"${bar.bold ? ' font-weight="600"' : ''}>${esc(bar.label)}</text>`;
    let xx = L;
    for (const part of bar.parts) {
      const wv = Math.max(sx(part.value), 2);
      b += `<rect x="${xx}" y="${yy}" width="${wv}" height="${barH}" fill="${part.color}" rx="2"/>`;
      xx += wv;
    }
    b += `<text x="${xx + 8}" y="${yy + barH / 2 + 5}" font-size="13" fill="${C.text}"${bar.bold ? ' font-weight="600"' : ''}>${esc(fmt(bar))}</text>\n`;
  });
  b += `<line x1="${L}" x2="${L}" y1="${T - 8}" y2="${T + bars.length * rowH - 12}" stroke="#999"/>`;
  b += `<text x="${L}" y="${H - 8}" font-size="11" fill="#777">linear scale, ${esc(unit)}</text>`;
  return svg(W, H, b);
}

const full = d.rows.at(-1);
const worst = hbars({
  title: 'Worst-case query: the whole Data Period (30 days)',
  subtitle: `${full.length.toLocaleString('en')} Price Points, median of many runs`,
  max: full.concatMs * 1000,
  unit: 'µs',
  fmt: (bar) => fmtUs(bar.us),
  bars: [
    ['Per-hour arrays, concatenated', full.concatMs, C.concat],
    ['Plain loop', full.plainMs, C.plain],
    ['Hour summaries (chosen)', full.hourMs, C.hour, true],
    ['Segment tree', full.segMs, C.seg],
  ].map(([label, ms, color, bold]) => ({
    label,
    us: ms * 1000,
    bold,
    parts: [{ value: ms * 1000, color }],
  })),
});

const mb = (bytes) => bytes / 1e6;
const m = d.memoryBytes;
const memory = hbars({
  title: 'Memory held by the API',
  subtitle: 'grey = the Price History itself; colour = what each option adds',
  max: mb(m.priceHistory + m.segmentTree),
  unit: 'MB',
  fmt: (bar) => `${bar.total.toFixed(1)} MB${bar.note ?? ''}`,
  bars: [
    {
      label: 'Plain loop',
      parts: [{ value: mb(m.priceHistory), color: C.base }],
      total: mb(m.priceHistory),
    },
    {
      label: 'Hour summaries (chosen)',
      bold: true,
      parts: [
        { value: mb(m.priceHistory), color: C.base },
        { value: mb(m.hourSummaries), color: C.hour },
      ],
      total: mb(m.priceHistory + m.hourSummaries),
      note: ` (+${(m.hourSummaries / 1e3).toFixed(1)} KB)`,
    },
    {
      label: 'Per-hour arrays, concatenated',
      parts: [
        { value: mb(m.priceHistory), color: C.base },
        { value: mb(m.perHourArrays), color: C.concat },
      ],
      total: mb(m.priceHistory + m.perHourArrays),
      note: ' + a copy per query',
    },
    {
      label: 'Segment tree',
      parts: [
        { value: mb(m.priceHistory), color: C.base },
        { value: mb(m.segmentTree), color: C.seg },
      ],
      total: mb(m.priceHistory + m.segmentTree),
    },
  ],
});

const startup = hbars({
  title: 'Work done per pod at startup',
  subtitle: 'reading and hashing the Price History is paid by every option',
  max: d.loadAndHashMs + d.segmentTreeBuildMs,
  unit: 'ms',
  fmt: (bar) => `${bar.total.toFixed(0)} ms`,
  bars: [
    {
      label: 'Summaries baked in image (chosen)',
      bold: true,
      parts: [{ value: d.loadAndHashMs, color: C.base }],
      total: d.loadAndHashMs,
    },
    {
      label: 'Summaries built at startup',
      parts: [
        { value: d.loadAndHashMs, color: C.base },
        { value: d.hourSummariesBuildMs, color: C.hour },
      ],
      total: d.loadAndHashMs + d.hourSummariesBuildMs,
    },
    {
      label: 'Segment tree built at startup',
      parts: [
        { value: d.loadAndHashMs, color: C.base },
        { value: d.segmentTreeBuildMs, color: C.seg },
      ],
      total: d.loadAndHashMs + d.segmentTreeBuildMs,
    },
  ],
});

writeFileSync(`${out}/query-time-by-slice-length.svg`, lineChart());
writeFileSync(`${out}/worst-case-query.svg`, worst);
writeFileSync(`${out}/memory.svg`, memory);
writeFileSync(`${out}/startup.svg`, startup);
console.log('wrote 4 charts to', out);
