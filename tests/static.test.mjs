// Files and words: both languages complete, nothing that could send or save data, sizes within GitHub's upload limit.
import fs from 'node:fs';
import path from 'node:path';
import { ok, eq, ROOT } from './lib/helpers.mjs';
import { UI } from '../js/i18n.js';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const shape = (o) => (typeof o === 'function' ? 'fn' : Array.isArray(o) ? ['arr', o.length] : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, shape(o[k])])) : typeof o);

export default (test) => {
  test('English and Spanish have exactly the same words to fill', async () => {
    eq(shape(UI.es), shape(UI.en), 'the Spanish text has the same keys as the English');
    const empty = []; const walk = (o, p) => { for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && !v.trim()) empty.push(p + k); else if (v && typeof v === 'object') walk(v, p + k + '.'); } };
    walk(UI.es, 'es.'); walk(UI.en, 'en.'); eq(empty, [], 'no empty text');
    ok(UI.es.levels.wood !== UI.en.levels.wood, 'the Spanish is really Spanish');
  });
  test('privacy: the code never sends or stores anything', async () => {
    const js = fs.readdirSync(path.join(ROOT, 'js')).map((f) => [f, read('js/' + f)]);
    for (const [f, src] of js) {
      for (const bad of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'getUserMedia', 'firebase', 'gtag(', 'analytics']) {
        ok(!src.includes(bad), `${f} uses ${bad}`);
      }
    }
    const html = read('index.html');
    ok(!/<script[^>]+src="https?:/.test(html) && !/https?:\/\/(?!sketchfab)/.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'index.html loads nothing from other sites');
  });
  test('every file is small enough for GitHub\'s web upload (25 MB)', async () => {
    const big = [];
    const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const s = fs.statSync(p); if (s.isDirectory()) { if (!/node_modules|\.git/.test(f)) walk(p); } else if (s.size > 25e6) big.push(p); } };
    walk(ROOT); eq(big, [], 'files over 25 MB');
    ok(fs.statSync(path.join(ROOT, 'labs/cannon/cannon.glb')).size < 12e6, 'the cannon model stays light for the Quest');
  });
  test('the model credit is on the page and in the README', async () => {
    ok(UI.en.credit.includes('Zack_Hawley') && UI.en.credit.includes('CC BY 4.0'), 'credit (English)');
    ok(UI.es.credit.includes('Zack_Hawley') && UI.es.credit.includes('CC BY 4.0'), 'credit (Spanish)');
    ok(read('README.md').includes('Zack_Hawley'), 'README credit');
  });
};
