// MMUUSD Labs: Cannon Recoil Lab (Grade 6, Forces and Motion, MS-PS2-2).
// WebXR passthrough on Quest 3, with a preview on any screen. No student data: nothing is sent or saved.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UI } from './i18n.js';
import { LabPanel, Loupe } from './ui3d.js';
import { buildLab, MUZZLE, BACKSTOP_X, BALL_R, RULER_Z, RULER_CM, VENT, WHEEL_R } from './scene.js';
import { VARS, VAR_KEYS, DEFAULTS, level, shot, trial, challengeTarget, onTheLine, G } from './physics.js';
import { unlockAudio, boom } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const UP = new THREE.Vector3(0, 1, 0);
const flag = (v, def) => (v == null ? def : !/^(0|off|false|no)$/i.test(v));

// ═════════════ settings (from the ArborXR link, then the student's own choices) ═════════════
// ?lang=en|es  ?sizes=desk,half,life  ?size=desk  ?lock=ball|cannon|powder|wheels  ?text=big  ?calm=on  ?number=on  ?fire=button  ?start=plan  ?debug=1
const SIZE_SCALE = { desk: 1 / 7, half: 0.5, life: 1 };
const allowed = (params.get('sizes') || 'desk,half,life').split(',').map((s) => s.trim()).filter((s) => s in SIZE_SCALE);
const SIZES = allowed.length ? allowed : ['desk'];
const S = {
  lang: params.get('lang') === 'es' ? 'es' : 'en',
  size: SIZES.includes(params.get('size')) ? params.get('size') : SIZES[0],
  lock: VAR_KEYS.includes(params.get('lock')) ? params.get('lock') : null,
  big: params.get('text') === 'big',
  calm: flag(params.get('calm'), matchMedia('(prefers-reduced-motion: reduce)').matches),
  num: flag(params.get('number'), false),
  lanyard: params.get('fire') !== 'button',
};
const DEBUG = params.get('debug') === '1';
const T = () => UI[S.lang];
const labScale = () => SIZE_SCALE[S.size];

// ═════════════ renderer / scene ═════════════
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const BG = new THREE.Color(0x24211d);
scene.background = BG;
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.02, 80);
scene.add(camera);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 1.5; controls.maxDistance = 14;
// preview/VR floor
const ground = new THREE.Mesh(new THREE.CircleGeometry(12, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4d5a3a, roughness: 1 }));
ground.position.y = -0.002; scene.add(ground);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6));

const L = buildLab((f) => { const s = $('status'); if (s && f < 1) s.textContent = `${Math.round(f * 100)}%`; });
const lab = L.lab; scene.add(lab);
let model = null, wheels = null;

// ═════════════ panels ═════════════
const panel = new LabPanel(); scene.add(panel.mesh); panel.mesh.renderOrder = 32;
const hint = new LabPanel(400); hint.mesh.visible = false; scene.add(hint.mesh); hint.mesh.renderOrder = 33;
const loupe = new Loupe(); scene.add(loupe.mesh); loupe.mesh.renderOrder = 31;
const reticle = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.15, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xd4af6a, transparent: true, opacity: 0.9, depthTest: false }));
reticle.renderOrder = 20; reticle.visible = false; scene.add(reticle);

// ═════════════ lab state ═════════════
const START = params.get('start') === 'plan' ? 'plan' : 'try';   // ?start=plan skips "Try it" and the 3rd-law question (day 2)
let phase = START;             // try | q3 | watch | answer | plan | test | explain | challenge
let confirmRestart = false;
let optionsOpen = false;
let q3Answer = null;
let settings = { ...DEFAULTS };
let planKey = S.lock;          // the variable being tested
const test = { levelIdx: 0, data: {}, predCm: null, predFor: null, arrows: false };
const ch = { target: null, last: null, result: null };
let lastShot = null;           // the most recent shot (for slow motion)
let rand = Math.random;        // tests can swap in a repeatable one
let anim = null;               // { kind: 'live'|'replay', t, rec, playing }
let triesFired = 0;
let mode = 'desktop';          // desktop | ar | vr
let placing = false, needsLayout = false, xrFrames = 0;

const levels = (k) => VARS[k];
const curLevel = () => levels(planKey)[test.levelIdx];
const rows = () => test.data;
const countFor = (id) => (rows()[id] || []).length;
const allRowsDone = () => planKey && levels(planKey).every((l) => countFor(l.id) >= 3);
function settingsForTest() { const s = { ...DEFAULTS }; if (planKey) s[planKey] = curLevel().id; return s; }

// ═════════════ the panel: what it shows in each phase ═════════════
function panelSpec() {
  const t = T();
  if (optionsOpen) return optionsSpec();
  const kicker = t.labTitle;
  const busy = !!anim && anim.kind === 'live';
  if (anim && anim.kind === 'replay') return replaySpec();
  const fireRow = (enabled = true) => ({ row: [{ id: 'fire', label: triesFired ? t.fireAgain : t.fire, primary: true, disabled: busy || !enabled }], h: 96 });
  const optRow = { row: [{ id: 'options', label: '⚙ ' + t.options, w: 1 }], h: 70, after: 0 };
  switch (phase) {
    case 'try': return { kicker, title: t.tryTitle, blocks: [...(mode === 'desktop' ? [{ p: t.tryBodyScreen }] : S.lanyard ? [{ p: t.tryBody }] : []), { p: t.tryHint, style: 'dim' }, fireRow(), optRow] };
    case 'q3': return { kicker, title: t.q3Title, blocks: [{ p: t.q3Body },
      { row: [{ id: 'q3:ball', label: t.q3Ball }, { id: 'q3:cannon', label: t.q3Cannon }, { id: 'q3:same', label: t.q3Same }], h: 96 }, optRow] };
    case 'answer': return { kicker, title: q3Answer === 'same' ? t.ansRight : t.ansSurprise, blocks: [{ p: t.ansBody }, { p: t.ansThink, style: 'em' },
      { row: [{ id: 'replay', label: '⟲ ' + t.slowmo, w: 1 }, { id: 'toPlan', label: t.toPlan + ' ▶', primary: true, w: 1.4 }], h: 92 }, optRow] };
    case 'plan': return planSpec();
    case 'test': return testSpec();
    case 'explain': return { kicker, title: t.explainTitle, blocks: [{ p: t.explainBody }, { p: t.wordBank, style: 'label', after: 8 }, { chips: t.words }, { p: t.newQuestion, style: 'em' },
      { row: [{ id: 'testOther', label: t.testOther }, { id: 'challenge', label: t.challenge + ' ▶', primary: true }], h: 92 }, optRow] };
    case 'challenge': return challengeSpec();
  }
  return { kicker, title: '', blocks: [] };
}
function planSpec() {
  const t = T(), blocks = [];
  if (S.lock) blocks.push({ p: t.lockedAsk });
  else {
    blocks.push({ p: t.planAsk });
    blocks.push({ row: VAR_KEYS.map((k) => ({ id: 'plan:' + k, label: t.vars[k], sel: planKey === k })), h: 88 });
  }
  if (planKey) {
    const kept = VAR_KEYS.filter((k) => k !== planKey).map((k) => `${t.vars[k]}: ${t.levels[DEFAULTS[k]]}`);
    blocks.push({ kv: [[t.willChange, `${t.varsThe[planKey]} (${levels(planKey).map((l) => t.levels[l.id]).join(', ')})`], [t.willMeasure, t.measureWhat], [t.keptSame, kept.join(' · ')]] });
    blocks.push({ p: t.notebook, style: 'dim' });
    blocks.push({ p: t.roles, style: 'dim' });
    blocks.push({ row: [{ id: 'startTest', label: t.startTesting + ' ▶', primary: true }], h: 92 });
  }
  blocks.push({ row: [{ id: 'options', label: '⚙ ' + t.options }], h: 70, after: 0 });
  return { kicker: t.labTitle, title: t.planTitle, blocks };
}
function tableBlock() {
  const t = T();
  return { table: {
    title: t.tableTitle,
    head: [t.vars[planKey], t.trial(1), t.trial(2), t.trial(3), t.average],
    rows: levels(planKey).map((l) => [t.levels[l.id], ...[0, 1, 2].map((i) => { const v = (rows()[l.id] || [])[i]; return v == null ? '' : S.num ? String(Math.round(v)) : '✓'; }), t.youCalc]),
    current: test.levelIdx,
  } };
}
function testStep() {
  const t = T(), n = countFor(curLevel().id);
  if (allRowsDone()) return t.allDone;
  if (n >= 3) return t.stepRowDone + ' ' + t.stepPick;
  const screen = mode === 'desktop', fireStep = screen || !S.lanyard ? t.stepFireScreen : t.stepFire;
  if (test.predFor !== curLevel().id) return screen ? t.stepPredictScreen : t.stepPredict;
  if (lastShot && lastShot.forLevel === curLevel().id && lastShot.n === n && n > 0 && !anim) return t.stepRead(n) + ' ' + (n < 3 ? fireStep : '');
  return fireStep;
}
function testSpec() {
  const t = T(), busy = !!anim;
  const lvRow = { row: levels(planKey).map((l, i) => ({ id: 'level:' + i, label: (countFor(l.id) >= 3 ? '✓ ' : '') + t.levels[l.id], sel: i === test.levelIdx, disabled: busy })), h: 84 };
  const canFire = !busy && test.predFor === curLevel().id && countFor(curLevel().id) < 3;
  return { kicker: t.labTitle, title: `${t.testing} ${t.vars[planKey]}`, blocks: [
    lvRow,
    { p: testStep(), style: 'em' },
    { row: [{ id: 'fire', label: t.fire, primary: true, disabled: !canFire, w: 1.2 }, { id: 'replay', label: '⟲ ' + t.slowmo, disabled: busy || !lastShot }, { id: 'arrows', label: test.arrows ? t.arrowsOn : t.arrowsOff, sel: test.arrows }], h: 88 },
    tableBlock(),
    { row: [{ id: 'backPlan', label: '◀ ' + t.back }, { id: 'explain', label: t.explain + ' ▶', primary: allRowsDone() }], h: 80 },
    { row: [{ id: 'options', label: '⚙ ' + t.options }], h: 70, after: 0 },
  ] };
}
function challengeSpec() {
  const t = T(), busy = !!anim, blocks = [{ p: t.chBody(ch.target.cm) }];
  for (const k of VAR_KEYS) {
    blocks.push({ p: t.vars[k], style: 'label', after: 6 });
    blocks.push({ row: levels(k).map((l) => ({ id: `set:${k}:${l.id}`, label: t.levels[l.id], sel: settings[k] === l.id, disabled: busy })), h: 70, after: 10 });
  }
  if (ch.result) {
    const cm = Math.round(ch.result.cm), o = ch.result.hit ? 'Hit' : ch.result.cm > ch.target.cm ? 'Far' : 'Short';
    blocks.push({ p: S.num ? t['ch' + o](cm) : t['ch' + o + 'NoNum'], style: ch.result.hit ? 'good' : 'bad' });
  }
  blocks.push({ row: [{ id: 'fire', label: t.fire, primary: true, disabled: busy }, { id: 'replay', label: '⟲ ' + t.slowmo, disabled: busy || !lastShot }, { id: 'newTarget', label: t.newTarget, disabled: busy }], h: 88 });
  blocks.push({ row: [{ id: 'backExplain', label: '◀ ' + t.back }, { id: 'options', label: '⚙ ' + t.options }], h: 70, after: 0 });
  return { kicker: t.labTitle, title: t.chTitle, blocks };
}
function replaySpec() {
  const t = T(), a = anim;
  const playing = a.playing;
  return { kicker: t.labTitle, title: t.replayTitle, blocks: [
    { p: phase === 'watch' ? t.watchBody : realTimeText(), style: phase === 'watch' ? 'body' : 'gold' },
    ...(phase === 'watch' ? [{ p: realTimeText(), style: 'gold' }] : []),
    { row: [{ id: 'rp:restart', label: '⟲ ' + t.restart }, { id: 'rp:back', label: '◀ ' + t.back }, { id: 'rp:toggle', label: playing ? t.pause : t.play + ' ▶', primary: true }, { id: 'rp:step', label: t.step + ' ▶' }], h: 92 },
    { row: [{ id: 'rp:done', label: t.done }], h: 84, after: 0 },
  ] };
}
function realTimeText() { return T().realTime(anim ? replayRealTime(anim.t, anim.rec).toFixed(3) : '0.000'); }
function optionsSpec() {
  const t = T(), blocks = [];
  blocks.push({ p: t.lang, style: 'label', after: 6 });
  blocks.push({ row: [{ id: 'lang:en', label: 'English', sel: S.lang === 'en' }, { id: 'lang:es', label: 'Español', sel: S.lang === 'es' }], h: 80 });
  if (SIZES.length > 1) {
    blocks.push({ p: t.size, style: 'label', after: 6 });
    blocks.push({ row: SIZES.map((s) => ({ id: 'size:' + s, label: t.sizes[s], sel: S.size === s })), h: 80 });
    blocks.push({ p: t.sizeNotes[S.size], style: 'dim' });
  }
  blocks.push({ p: t.supports, style: 'label', after: 6 });
  blocks.push({ row: [{ id: 'acc:big', label: t.bigText, sel: S.big }, { id: 'acc:calm', label: t.calm, sel: S.calm }, { id: 'acc:num', label: t.number, sel: S.num }], h: 80 });
  if (mode !== 'desktop') blocks.push({ row: [{ id: 'move', label: t.move }, { id: 'exit', label: t.exit }], h: 80 });
  blocks.push({ row: [{ id: 'restart', label: confirmRestart ? t.restartSure : '⟲ ' + t.startOver, sel: confirmRestart }], h: 80 });
  blocks.push({ row: [{ id: 'closeOptions', label: t.close, primary: true }], h: 84 });
  blocks.push({ p: t.credit, style: 'dim', after: 0 });
  return { kicker: t.labTitle, title: t.options, blocks };
}
function refresh() {
  panel.setZoom(S.big ? 1.3 : 1);
  panel.show(panelSpec());
  document.body.classList.toggle('big-text', S.big);
}

// ═════════════ button handling ═════════════
function onButton(id) {
  if (!id || !panel.buttons.some((b) => b.id === id && !b.disabled)) return;   // only what the panel shows right now
  unlockAudio();
  const [a, b, c] = id.split(':');
  if (a !== 'restart') confirmRestart = false;
  if (a === 'options') { optionsOpen = true; return refresh(); }
  if (a === 'closeOptions') { optionsOpen = false; return refresh(); }
  if (a === 'restart') { if (!confirmRestart) { confirmRestart = true; return refresh(); } return startOver(); }
  if (a === 'lang') { S.lang = b; relabel(); syncPage(); return refresh(); }
  if (a === 'size') { setSize(b); return refresh(); }
  if (a === 'acc') { S[b] = !S[b]; syncPage(); updateLoupe(); return refresh(); }
  if (a === 'move') { optionsOpen = false; refresh(); return replace(); }
  if (a === 'exit') { renderer.xr.getSession()?.end(); return; }
  if (a === 'fire') return fire();
  if (a === 'q3') { q3Answer = b; phase = 'watch'; return startReplay(true); }
  if (a === 'replay') return startReplay(phase === 'answer' || test.arrows || phase === 'challenge');
  if (a === 'rp') return replayControl(b);
  if (a === 'toPlan') { phase = 'plan'; resetShots(); return refresh(); }
  if (a === 'plan') { planKey = b; return refresh(); }
  if (a === 'startTest') return startTest();
  if (a === 'level') { test.levelIdx = +b; test.predCm = null; test.predFor = null; L.predFlag.visible = false; loupe.mesh.visible = false; applySettings(settingsForTest()); return refresh(); }
  if (a === 'arrows') { test.arrows = !test.arrows; return refresh(); }
  if (a === 'backPlan') { phase = 'plan'; resetShots(); return refresh(); }
  if (a === 'explain') { phase = 'explain'; resetShots(); return refresh(); }
  if (a === 'testOther') { phase = 'plan'; if (!S.lock) planKey = null; test.data = {}; return refresh(); }
  if (a === 'challenge' || a === 'newTarget') return startChallenge();
  if (a === 'backExplain') { phase = 'explain'; resetShots(); L.target.visible = false; applySettings({ ...DEFAULTS }); return refresh(); }
  if (a === 'set') { settings[b] = c; applySettings(settings); ch.result = null; return refresh(); }
}
// "Start over": a fresh lab for the next pair (the table and predictions are cleared; nothing was saved anyway)
function startOver() {
  confirmRestart = false; optionsOpen = false;
  anim = null; smoke = null; L.puffs.forEach((p) => { p.visible = false; });
  phase = START; q3Answer = null; planKey = S.lock; triesFired = 0;
  test.levelIdx = 0; test.data = {}; test.predCm = null; test.predFor = null; test.arrows = false;
  ch.target = null; ch.result = null;
  applySettings({ ...DEFAULTS });
  resetShots(); L.target.visible = false;
  refresh();
}
function startTest() {
  phase = 'test'; test.levelIdx = 0; test.data = {}; test.predCm = null; test.predFor = null;
  resetShots(); applySettings(settingsForTest()); refresh();
}
function startChallenge() {
  phase = 'challenge'; resetShots();
  let tg; do { tg = challengeTarget(rand); } while (ch.target && tg.cm === ch.target.cm);
  ch.target = tg; ch.result = null;
  settings = { ...DEFAULTS }; applySettings(settings);
  L.target.position.x = -tg.cm / 100; L.target.visible = true;
  refresh();
}
function resetShots() {
  anim = null; lastShot = null; L.clearGhosts(); L.predFlag.visible = false; loupe.mesh.visible = false;
  hideArrows(); L.setCannonX(0, wheels); L.ball.visible = false; L.target.visible = phase === 'challenge';
}
function applySettings(st) { settings = { ...st }; L.showSettings(settings, T()); sizeLabels(); }
function relabel() {
  const t = T();
  L.setLabelText(L.arrows.ball.userData.label, t.pushBall); L.setLabelText(L.arrows.cannon.userData.label, t.pushCannon);
  L.setLabelText(L.arrows.friction.userData.label, settings.wheels === 'blocked' ? t.groundPush : t.friction);
  L.setLabelText(L.predFlag.userData.label, t.predicted); L.setLabelText(L.target.userData.label, t.target);
  L.showSettings(settings, t);
  sizeLabels();
}

// ═════════════ firing ═════════════
function fire() {
  if (anim) return;
  if (phase === 'test' && (test.predFor !== curLevel().id || countFor(curLevel().id) >= 3)) return;
  const st = phase === 'test' ? settingsForTest() : { ...settings };
  const r = trial(st, rand);
  lastShot = { st, r, cm: r.d * 100, forLevel: phase === 'test' ? curLevel().id : null, n: 0 };
  L.setCannonX(0, wheels); hideArrows(); loupe.mesh.visible = false;
  anim = { kind: 'live', t: 0, rec: lastShot, playing: true, smoked: false };
  boom({ calm: S.calm, size: r.scoops });
  triesFired++;
  refresh();
}
function shotDone(rec) {
  const cm = rec.cm;
  if (phase === 'try') { phase = 'q3'; }
  else if (phase === 'test') {
    const id = curLevel().id; (test.data[id] = test.data[id] || []).push(cm);
    rec.n = test.data[id].length;
    L.addGhost(cm, test.levelIdx, rec.n); sizeLabels();
  } else if (phase === 'challenge') {
    ch.result = { cm, hit: onTheLine(cm, ch.target.cm) };
    L.addGhost(cm, 0, L.ghosts.length + 1); sizeLabels();
  }
  if (phase === 'test' || phase === 'challenge') { loupe.mesh.visible = true; updateLoupe(); }
  refresh();
}
function updateLoupe() { if (lastShot) loupe.set(Math.max(0, -L.cannonX * 100), S.num, phase === 'test' ? test.predCm : phase === 'challenge' ? ch.target?.cm : null, phase === 'challenge' ? '#2fae5a' : '#2f7de1'); }
function hideArrows() { for (const a of Object.values(L.arrows)) a.visible = false; }

// cannon position during the roll (real time τ seconds after the push)
function rollX(r, tau) { const a = r.mu * G, tt = Math.min(tau, r.tStop); return -(r.vCannon * tt - 0.5 * a * tt * tt); }

// slow motion timeline (seconds of replay): pause → push → flight → roll → hold
const RP = { pause: 0.6, push: 1.6, flight: 0.9, roll: 4 };
const replayLen = (r) => RP.pause + RP.push + RP.flight + r.tStop * RP.roll + 0.8;
function replayRealTime(t, rec) {   // the real-world time this frame shows
  const r = rec.r, P0 = RP.pause, P1 = P0 + RP.push, P2 = P1 + RP.flight;
  if (t < P0) return 0;
  if (t < P1) return 0.01 * (t - P0) / RP.push;               // the push lasts about 1/100 s
  if (t < P2) return 0.01 + ((BACKSTOP_X - MUZZLE.x) / r.vBall) * (t - P1) / RP.flight;
  return 0.01 + (BACKSTOP_X - MUZZLE.x) / r.vBall + Math.min(r.tStop, (t - P2) / RP.roll);
}
function poseReplay(t, rec, withArrows) {
  const r = rec.r, P0 = RP.pause, P1 = P0 + RP.push, P2 = P1 + RP.flight;
  const kick = -Math.min(0.03, r.d * 0.06);
  let cx = 0;
  L.ball.visible = true;
  if (t < P0) { cx = 0; L.ball.visible = false; }
  else if (t < P1) { const f = (t - P0) / RP.push, e = f * f; cx = kick * e; L.ball.position.set(-0.5 + (MUZZLE.x + 0.5) * e, MUZZLE.y, 0); }
  else if (t < P2) { const f = (t - P1) / RP.flight; cx = kick; L.ball.position.set(MUZZLE.x + (BACKSTOP_X - BALL_R - MUZZLE.x) * f, MUZZLE.y, 0); }
  else {
    const tau = (t - P2) / RP.roll, full = rollX(r, r.tStop) || -1e-6;
    cx = kick + rollX(r, tau) * ((full - kick) / full);   // ends exactly where the real shot stopped
    const drop = Math.min(1, (t - P2) / 0.6);
    L.ball.position.set(BACKSTOP_X - BALL_R - 0.1 * drop, MUZZLE.y - (MUZZLE.y - BALL_R) * drop * drop, 0);
  }
  L.setCannonX(cx, wheels);
  hideArrows();
  if (withArrows && t >= P0 && t < P1 + 0.15) {   // equal and opposite pushes while the powder burns
    const Lp = 1.1;
    const A = L.arrows;
    A.ball.visible = true; A.ball.setLength(Lp); A.ball.position.set(L.ball.position.x + 0.12, MUZZLE.y + 0.32, 0); A.ball.rotation.set(0, 0, 0);
    A.cannon.visible = true; A.cannon.setLength(Lp); A.cannon.position.set(cx + VENT.x - 0.05, MUZZLE.y + 0.32, 0); A.cannon.rotation.set(0, 0, Math.PI);
    A.cannon.userData.label.rotation.set(0, 0, 0);
  }
  if (withArrows && t >= P2 && (t - P2) / RP.roll < r.tStop) {   // friction slows the rolling cannon
    const A = L.arrows.friction, blocked = rec.st.wheels === 'blocked';
    A.visible = true; A.setLength(blocked ? 1.0 : 0.55); A.position.set(cx - WHEEL_R * 0.2, 0.12, 1.02);
  }
}

function startReplay(withArrows) {
  if (!lastShot || (anim && anim.kind === 'live')) return;
  anim = { kind: 'replay', t: 0, rec: lastShot, playing: true, arrows: withArrows };
  loupe.mesh.visible = false;
  refresh();
}
function replayControl(cmd) {
  if (!anim || anim.kind !== 'replay') return;
  const len = replayLen(anim.rec.r), step = 1 / 15;
  if (cmd === 'restart') { anim.t = 0; anim.playing = true; }
  else if (cmd === 'toggle') { if (anim.t >= len) anim.t = 0; anim.playing = !anim.playing; }
  else if (cmd === 'step') { anim.playing = false; anim.t = Math.min(len, anim.t + step); }
  else if (cmd === 'back') { anim.playing = false; anim.t = Math.max(0, anim.t - step); }
  else if (cmd === 'done') return endReplay();
  poseReplay(anim.t, anim.rec, anim.arrows);
  refresh();
}
function endReplay() {
  const rec = anim?.rec; anim = null; hideArrows(); L.ball.visible = false;
  if (rec) L.setCannonX(rollX(rec.r, rec.r.tStop), wheels);
  if (phase === 'watch') phase = 'answer';
  if (rec && (phase === 'test' || phase === 'challenge')) { loupe.mesh.visible = true; updateLoupe(); }
  refresh();
}

let panelTick = 0;
function updateAnim(dt) {
  if (!anim) return;
  if (anim.kind === 'live') {
    const r = anim.rec.r;
    anim.t += dt;
    // ball: a streak from the muzzle to the sandbags for a moment, then it lies at their foot
    L.ball.visible = true;
    if (anim.t < 0.08) L.ball.position.set(MUZZLE.x + (BACKSTOP_X - BALL_R - MUZZLE.x) * Math.min(1, anim.t / 0.03), MUZZLE.y, 0);
    else L.ball.position.set(BACKSTOP_X - BALL_R - 0.1, BALL_R, 0);
    L.setCannonX(rollX(r, anim.t), wheels);
    hideArrows();
    if (test.arrows && phase === 'test') {
      if (anim.t < 0.25) { const A = L.arrows; A.ball.visible = A.cannon.visible = true; A.ball.setLength(1.1); A.cannon.setLength(1.1);
        A.ball.position.set(MUZZLE.x + 0.2, MUZZLE.y + 0.32, 0); A.cannon.position.set(L.cannonX + VENT.x - 0.05, MUZZLE.y + 0.32, 0); A.cannon.rotation.set(0, 0, Math.PI); }
      else if (anim.t < r.tStop) { const A = L.arrows.friction; A.visible = true; A.setLength(anim.rec.st.wheels === 'blocked' ? 1 : 0.55); A.position.set(L.cannonX - WHEEL_R * 0.2, 0.12, 1.02); }
    }
    if (!S.calm && !anim.smoked) { anim.smoked = true; startSmoke(); }
    if (anim.t > Math.max(r.tStop, 0.3) + 0.35) { const rec = anim.rec; anim = null; hideArrows(); L.ball.visible = false; shotDone(rec); }
  } else if (anim.kind === 'replay') {
    if (anim.playing) {
      anim.t += dt;
      const len = replayLen(anim.rec.r);
      if (anim.t >= len) { anim.t = len; anim.playing = false; }
      const P1 = RP.pause + RP.push;
      if (!S.calm && anim.t - dt < P1 && anim.t >= P1) startSmoke();
      poseReplay(anim.t, anim.rec, anim.arrows);
      if ((panelTick += dt) > 0.5 || !anim.playing) { panelTick = 0; refresh(); }
    }
  }
}
// smoke puffs
let smoke = null;
function startSmoke() { smoke = { t: 0 }; L.puffs.forEach((p, i) => { p.visible = true; p.userData.v = new THREE.Vector3(0.6 + Math.random() * 1.4, 0.15 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8); p.position.copy(MUZZLE); p.userData.delay = i * 0.02; }); }
function updateSmoke(dt) {
  if (!smoke) return;
  smoke.t += dt;
  for (const p of L.puffs) {
    const tt = Math.max(0, smoke.t - p.userData.delay);
    p.position.copy(MUZZLE).addScaledVector(p.userData.v, 1 - Math.exp(-tt * 2)); p.position.x += L.cannonX * 0.3;
    p.scale.setScalar(0.25 + tt * 0.6);
    p.material.opacity = Math.max(0, 0.85 * (1 - tt / 2.2));
  }
  if (smoke.t > 2.4) { L.puffs.forEach((p) => { p.visible = false; }); smoke = null; }
}

// ═════════════ sizes, labels, layout ═════════════
const LABEL_W = { desk: 0.085, half: 0.22, life: 0.34 };   // world width of a "worldW = 1" label, per size
function sizeLabels() {
  const s = lab.scale.x, k = mode === 'desktop' ? 0.55 : LABEL_W[S.size];
  for (const l of L.labels) {
    let ps = 1; let p = l.parent; while (p && p !== lab) { ps *= p.scale.x; p = p.parent; }
    l.scale.setScalar(l.userData.worldW * k / s / ps);
  }
}
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
function faceLabels() {   // labels turn to face the student (yaw only), whatever their parent's rotation
  camera.getWorldPosition(_w);
  for (const l of L.labels) {
    if (!l.visible) continue;
    l.getWorldPosition(_v);
    const yaw = Math.atan2(_w.x - _v.x, _w.z - _v.z);
    l.parent.getWorldQuaternion(_q).invert();
    l.quaternion.setFromAxisAngle(UP, yaw).premultiply(_q);
  }
}
function setSize(s) {
  if (!SIZES.includes(s) || s === S.size) return;
  S.size = s; syncPage();
  if (mode === 'desktop') return layoutDesktop();
  lab.scale.setScalar(labScale()); sizeLabels();
  replace();
}
function headForward() { return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize(); }
// put the lab in front of a seated student (desk size): a little below eye level, the side of the cannon toward them
function placeDesk() {
  placing = false; reticle.visible = false; hint.mesh.visible = false;
  const C = camera.position, f = headForward();
  const r = new THREE.Vector3().crossVectors(f, UP).normalize();
  const spot = C.clone().addScaledVector(f, 0.62).addScaledVector(r, -0.1).setY(Math.max(0.3, C.y - 0.5));
  setLabAt(spot);
}
function setLabAt(spot) {
  const C = camera.position;
  const yaw = Math.atan2(C.x - spot.x, C.z - spot.z);   // lab +Z toward the student
  lab.rotation.set(0, yaw, 0);
  lab.scale.setScalar(labScale());
  // centre the whole setup (trail end to sandbags, about x = −0.4) on the spot
  const off = new THREE.Vector3(-0.35 * labScale(), 0, 0).applyAxisAngle(UP, yaw);
  lab.position.copy(spot).sub(off);
  lab.visible = true;
  sizeLabels(); layoutPanel(true); layoutHandle();
  wantAnchor = true;
}
function startPlacing() { placing = true; hint.show({ blocks: [{ p: T().placeFloor, style: 'em', after: 0 }] }); hint.mesh.visible = true; lab.visible = false; dropAnchor(); }
function replace() { if (mode === 'desktop') return; if (S.size === 'desk') placeDesk(); else startPlacing(); }
// the main panel floats to the student's front-right; it comes back if they turn away for a while
let panelGoal = null, awayFor = 0;
function panelSpot() {
  const C = camera.position, f = headForward(), r = new THREE.Vector3().crossVectors(f, UP).normalize();
  const desk = S.size === 'desk';
  return C.clone().addScaledVector(f, desk ? 0.56 : 0.85).addScaledVector(r, desk ? 0.44 : 0.62).setY(C.y - (desk ? 0.08 : 0.05));
}
function layoutPanel(instant) {
  if (mode === 'desktop') return;
  panelGoal = panelSpot();
  if (instant) { panel.mesh.position.copy(panelGoal); panelGoal = null; }
  panel.mesh.lookAt(camera.position);
  panel.setBase(S.size === 'desk' ? 0.72 : 0.95);
}
function followPanel(dt) {
  if (mode === 'desktop') return;
  const C = camera.position, f = headForward();
  const to = panel.mesh.position.clone().sub(C).setY(0); const d = to.length();
  const off = d > 0.01 ? f.angleTo(to.normalize()) : 0;
  awayFor = (off > 1.15 || d > 2.2) && !panelGoal ? awayFor + dt : 0;
  if (awayFor > 1.5) { awayFor = 0; panelGoal = panelSpot(); }
  if (panelGoal) {
    panel.mesh.position.lerp(panelGoal, 1 - Math.exp(-dt * (S.calm ? 2.5 : 5)));
    if (panel.mesh.position.distanceTo(panelGoal) < 0.01) panelGoal = null;
  }
  panel.mesh.lookAt(C);
  // keep the panel's top edge where it is when its height changes
}
// the lanyard handle: always within reach, in front of the student and a little to the right
let handleLocal = new THREE.Vector3(1.0, 0.9, 2.2);
function layoutHandle() {
  if (mode === 'desktop') { handleLocal.set(-0.1, 0.95, 1.75); }
  else {
    const C = camera.position, f = headForward(), r = new THREE.Vector3().crossVectors(f, UP).normalize();
    const desk = S.size === 'desk';
    const w = C.clone().addScaledVector(f, desk ? 0.34 : 0.42).addScaledVector(r, desk ? 0.02 : 0.12).setY(C.y - (desk ? 0.3 : 0.42));
    handleLocal = lab.worldToLocal(w.clone());
  }
  L.handle.position.copy(handleLocal);
  const s = (mode === 'desktop' ? 0.4 : S.size === 'desk' ? 0.06 : 0.085) / lab.scale.x;   // world size: 6–12 cm long grip
  L.handle.scale.setScalar(s);
}
function updateRope() {
  const v = L.cannon.position.clone().add(VENT), h = L.handle.position;
  const pos = L.rope.geometry.attributes.position; pos.setXYZ(0, v.x, v.y, v.z); pos.setXYZ(1, h.x, h.y, h.z); pos.needsUpdate = true;
  const showHandle = S.lanyard && !optionsOpen && (phase === 'try' || phase === 'test' || phase === 'challenge');
  L.handle.visible = L.rope.visible = showHandle;
  L.handle.userData.glow.visible = showHandle && !anim && !S.calm ? true : showHandle && !anim;
  L.handle.userData.glow.material.opacity = S.calm ? 0.16 : 0.12 + 0.1 * Math.sin(performance.now() / 300);
}
// loupe: floats over the stopping point, facing the student
function placeLoupe() {
  if (!loupe.mesh.visible) return;
  const p = lab.localToWorld(new THREE.Vector3(L.cannonX, 0, RULER_Z));
  const up = mode === 'desktop' ? 0.45 : { desk: 0.07, half: 0.2, life: 0.32 }[S.size];
  p.y += up;
  loupe.mesh.position.copy(p);
  loupe.mesh.scale.setScalar(mode === 'desktop' ? 3 : { desk: 0.75, half: 1.3, life: 1.8 }[S.size]);
  loupe.mesh.lookAt(camera.getWorldPosition(_w));
}

// ═════════════ input: controllers, hands and mouse ═════════════
const raycaster = new THREE.Raycaster();
const controllers = [];
const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
  line.scale.z = 3; c.add(line);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
  dot.visible = false; scene.add(dot);
  c.userData = { line, dot, src: null, hitSrc: null, target: null };
  c.addEventListener('connected', (e) => onConnected(c, e.data));
  c.addEventListener('disconnected', () => { c.userData.hitSrc?.cancel?.(); c.userData.hitSrc = null; c.userData.src = null; });
  c.addEventListener('selectstart', () => onSelectStart(c));
  c.addEventListener('selectend', () => onSelectEnd(c));
  scene.add(c); controllers.push(c);
}
function onConnected(c, src) {
  c.userData.src = src;
  c.userData.line.visible = src.targetRayMode === 'tracked-pointer';
  const session = renderer.xr.getSession();
  if (mode === 'ar' && session?.requestHitTestSource) session.requestHitTestSource({ space: src.targetRaySpace }).then((h) => { c.userData.hitSrc = h; }).catch(() => {});
}
const tmpM = new THREE.Matrix4();
function setRayFrom(c) {
  tmpM.identity().extractRotation(c.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
  raycaster.far = 12;
}
const panelHit = () => raycaster.intersectObject(panel.mesh, false)[0] || null;
const handleHit = () => (L.handle.visible && !anim ? raycaster.intersectObject(L.handle.userData.glow, false)[0] : null);
const trackHit = () => (phase === 'test' && !anim && countFor(curLevel().id) < 3 ? raycaster.intersectObject(L.track, false)[0] : null);
let pull = null, drag = null;   // pulling the lanyard; dragging the prediction flag
function onSelectStart(c) {
  if (!renderer.xr.isPresenting) return;
  unlockAudio();
  setRayFrom(c);
  const ph = panel.mesh.visible ? panelHit() : null;
  if (ph) { c.userData.pressed = panel.buttonAt(ph.uv); return; }
  if (placing) { if (c.userData.target) finishPlacing(c.userData.target.clone()); return; }
  if (handleHit()) { pull = { c, start: new THREE.Vector3().setFromMatrixPosition(c.matrixWorld) }; return; }
  const th = trackHit(); if (th) { drag = { c }; setPrediction(th.point); }
}
function onSelectEnd(c) {
  if (c.userData.pressed !== undefined) {
    setRayFrom(c); const ph = panelHit(); const id = ph ? panel.buttonAt(ph.uv) : null;
    const was = c.userData.pressed; c.userData.pressed = undefined;
    if (id && id === was) onButton(id);
    return;
  }
  if (pull && pull.c === c) { pull = null; L.handle.position.copy(handleLocal); }
  if (drag && drag.c === c) drag = null;
}
function setPrediction(worldPoint) {
  const p = lab.worldToLocal(worldPoint.clone());
  const cm = Math.max(0, Math.min(RULER_CM, Math.round(-p.x * 100)));
  test.predCm = cm; test.predFor = curLevel().id;
  L.predFlag.position.set(-cm / 100, 0, RULER_Z + 0.06); L.predFlag.visible = true; sizeLabels();
  loupe.mesh.visible = false;
  refresh();
}
function updatePull() {
  if (!pull) return;
  const now = new THREE.Vector3().setFromMatrixPosition(pull.c.matrixWorld);
  L.handle.position.copy(lab.worldToLocal(now.clone()));
  if (now.distanceTo(pull.start) > 0.12) {   // a firm tug (12 cm) fires the cannon
    pull = null; L.handle.position.copy(handleLocal);
    if (phase === 'test' && test.predFor !== curLevel().id) return;   // place a prediction first
    fire();
  }
}
function findTarget(c, frame) {
  const ref = renderer.xr.getReferenceSpace();
  if (frame && c.userData.hitSrc && ref) {
    for (const r of frame.getHitTestResults(c.userData.hitSrc)) {
      const pose = r.getPose(ref); if (!pose) continue;
      tmpM.fromArray(pose.transform.matrix);
      if (new THREE.Vector3(0, 1, 0).transformDirection(tmpM).y > 0.85) return new THREE.Vector3().setFromMatrixPosition(tmpM);
    }
  }
  setRayFrom(c);
  const { origin, direction } = raycaster.ray;
  if (direction.y < -0.05) { const d = -origin.y / direction.y; if (d > 0 && d < 10) return origin.clone().addScaledVector(direction, d); }
  return null;
}
function finishPlacing(target) { placing = false; reticle.visible = false; hint.mesh.visible = false; setLabAt(target); }

function xrUpdate(frame, dt) {
  xrFrames++;
  if (needsLayout && xrFrames > 3) { needsLayout = false; replace(); layoutPanel(true); }
  if (wantAnchor) makeAnchor(frame);
  followAnchor(frame);
  for (const c of controllers) {
    const u = c.userData; if (!u.src) { u.dot.visible = false; continue; }
    setRayFrom(c);
    const hit = panel.mesh.visible ? panelHit() : null;
    const other = hit ? null : handleHit() || trackHit();
    const h = hit || other;
    u.line.scale.z = h ? h.distance : 3; u.dot.visible = !!h; if (h) u.dot.position.copy(h.point);
    u.panelHit = hit;
    if (drag && drag.c === c) { const th = raycaster.intersectObject(L.track, false)[0]; if (th) setPrediction(th.point); }
  }
  const hits = controllers.map((c) => c.userData.panelHit).filter(Boolean);
  panel.setHover(hits[0] ? panel.buttonAt(hits[0].uv) : null);
  if (placing) {
    for (const x of controllers) x.userData.target = x.userData.src ? findTarget(x, frame) : null;
    const c = controllers.find((x) => x.userData.target);
    reticle.visible = !!c;
    if (c) { reticle.position.copy(c.userData.target).y += 0.004; }
    hint.mesh.position.copy(camera.position).addScaledVector(headForward(), 1.0).setY(camera.position.y + 0.05);
    hint.mesh.lookAt(camera.position);
  } else if (S.size === 'desk') {   // desk size: the right thumbstick raises or lowers the lab to sit on the real desk
    for (const c of controllers) { const gp = c.userData.src?.gamepad; const y = gp && gp.axes.length >= 4 ? gp.axes[3] : 0; if (Math.abs(y) > 0.3) { lab.position.y -= y * dt * 0.25; } }
  }
  updatePull();
  followPanel(dt);
}

// mouse / touch on the preview
const pointer = new THREE.Vector2();
function pointerRay(e) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}
let downAt = null, mouseDrag = false;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (mode !== 'desktop') return;
  downAt = [e.clientX, e.clientY]; pointerRay(e);
  const th = !panelHit() && trackHit(); if (th) { mouseDrag = true; controls.enabled = false; setPrediction(th.point); }
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (mode !== 'desktop') return;
  pointerRay(e);
  const ph = panelHit(); panel.setHover(ph ? panel.buttonAt(ph.uv) : null);
  if (mouseDrag) { const th = raycaster.intersectObject(L.track, false)[0]; if (th) setPrediction(th.point); }
  renderer.domElement.style.cursor = ph && panel.buttonAt(ph.uv) || handleHit() || trackHit() ? 'pointer' : 'grab';
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (mode !== 'desktop' || !downAt) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null;
  if (mouseDrag) { mouseDrag = false; controls.enabled = true; return; }
  if (moved > 6) return;
  unlockAudio(); pointerRay(e);
  const ph = panelHit(); if (ph) return onButton(panel.buttonAt(ph.uv));
  if (handleHit()) { if (phase !== 'test' || test.predFor === curLevel().id) fire(); }
});

// ═════════════ anchors: keep the lab fixed to the real room if the headset recentres ═════════════
let anchor = null, anchorLast = null, wantAnchor = false, anchorGen = 0;
function dropAnchor() { anchorGen++; wantAnchor = false; if (anchor) { try { anchor.delete(); } catch { /* gone */ } } anchor = null; anchorLast = null; }
async function makeAnchor(frame) {
  wantAnchor = false;
  const ref = renderer.xr.getReferenceSpace();
  if (mode !== 'ar' || !frame?.createAnchor || !ref || typeof XRRigidTransform === 'undefined') return;
  dropAnchor();
  const gen = anchorGen, q = new THREE.Quaternion().setFromAxisAngle(UP, lab.rotation.y), P = lab.position;
  try {
    const a = await frame.createAnchor(new XRRigidTransform({ x: P.x, y: P.y, z: P.z }, { x: q.x, y: q.y, z: q.z, w: q.w }), ref);
    if (gen !== anchorGen) { a.delete(); return; }
    anchor = a; anchorLast = null;
  } catch (e) { console.warn('anchor not available', e); }
}
function followAnchor(frame) {
  if (!anchor || placing || !frame) return;
  const ref = renderer.xr.getReferenceSpace();
  if (frame.trackedAnchors && !frame.trackedAnchors.has(anchor)) return;
  const pose = ref && frame.getPose(anchor.anchorSpace, ref); if (!pose) return;
  const tp = pose.transform.position, o = pose.transform.orientation;
  const now = { p: new THREE.Vector3(tp.x, tp.y, tp.z), yaw: new THREE.Euler().setFromQuaternion(new THREE.Quaternion(o.x, o.y, o.z, o.w), 'YXZ').y };
  if (anchorLast) {
    const dy = now.yaw - anchorLast.yaw;
    if (now.p.distanceTo(anchorLast.p) > 0.002 || Math.abs(dy) > 0.002) {   // the room "moved": move the lab and panel with it
      for (const obj of [lab, panel.mesh]) {
        const rel = obj.position.clone().sub(anchorLast.p).applyAxisAngle(UP, dy);
        obj.position.copy(now.p).add(rel); obj.rotation.y += dy;
      }
    }
  }
  anchorLast = now;
}

// ═════════════ sessions ═════════════
async function enterXR(type) {
  if (renderer.xr.isPresenting) return;
  unlockAudio();
  const init = type === 'ar'
    ? { requiredFeatures: ['local-floor'], optionalFeatures: ['hit-test', 'hand-tracking', 'anchors'] }
    : { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] };
  try {
    const session = await navigator.xr.requestSession(type === 'ar' ? 'immersive-ar' : 'immersive-vr', init);
    mode = type;
    session.addEventListener('end', onSessionEnd);
    await renderer.xr.setSession(session);
    onSessionStart();
  } catch (e) { console.error(e); mode = 'desktop'; $('status').textContent = `${type === 'ar' ? 'Passthrough' : 'VR'}: ${e.message || e}`; }
}
function onSessionStart() {
  $('start').hidden = true; $('menu').hidden = true;
  controls.enabled = false;
  if (panel.mesh.parent !== scene) scene.add(panel.mesh);
  if (mode === 'ar') { scene.background = null; ground.visible = false; renderer.setClearColor(0x000000, 0); }
  else { scene.background = BG; ground.visible = true; }
  lab.visible = false; needsLayout = true; xrFrames = 0; anchor = null; anchorLast = null; wantAnchor = false; anchorGen++;
  renderer.xr.getReferenceSpace()?.addEventListener?.('reset', () => { if (!anchor && !placing && !needsLayout) replace(); });
  refresh();
}
function onSessionEnd() {
  mode = 'desktop'; placing = false; pull = null; drag = null;
  anchor = null; anchorLast = null; wantAnchor = false; anchorGen++;
  scene.background = BG; ground.visible = true; reticle.visible = false; hint.mesh.visible = false;
  controls.enabled = true; layoutDesktop(); onResize(); refresh();
  $('start').hidden = false;
}

// ═════════════ preview on a screen (Chromebook, projector) ═════════════
function layoutDesktop() {
  lab.position.set(0, 0, 0); lab.rotation.set(0, 0, 0); lab.scale.setScalar(1); lab.visible = true;
  camera.position.set(-0.9, 2.9, 5.6); controls.target.set(-0.5, 0.35, 0.4); controls.update();
  camera.add(panel.mesh); panel.mesh.position.set(0, 0, -1.3); panel.mesh.rotation.set(0, 0, 0);
  sizeLabels(); layoutHandle(); placeDesktopPanel();
}
function placeDesktopPanel() {   // the panel sits on the right of the screen
  if (panel.mesh.parent !== camera) return;
  const dist = 1.3, h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), w = h * camera.aspect;
  if (panel.base !== 1) panel.setBase(1);
  const pw = panel.mW * panel.zoom;
  const narrow = camera.aspect < 1.1;
  const s = narrow ? Math.min(1, (w * 0.96) / pw) : Math.min(1, (h * 0.95) / (panel.heightM() || 1), (w * 0.42) / pw);
  panel.mesh.scale.x = panel.zoom * s; panel.mesh.scale.y = panel.zoom * s * panel.usedH / panel.canvas.height;
  const top = h / 2 - 0.02;
  panel.mesh.position.set(narrow ? 0 : w / 2 - pw * s / 2 - 0.02, top - panel.heightM() * s / 2, -dist);
}
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  placeDesktopPanel();
}
window.addEventListener('resize', onResize);

// ═════════════ the 2D start page ═════════════
function syncPage() {
  const t = T();
  document.documentElement.lang = S.lang;
  document.body.classList.toggle('big-text', S.big);
  $('title').textContent = t.labTitle; $('kicker').textContent = t.labSub; $('intro').textContent = t.intro;
  $('l-lang').textContent = t.language; $('l-size').textContent = t.size; $('l-acc').textContent = t.supports;
  $('btn-ar').textContent = t.enterAR; $('btn-vr').textContent = t.enterVR; $('btn-preview').textContent = t.preview;
  $('credit').textContent = t.credit; $('privacy').textContent = t.privacy;
  document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('sel', b.dataset.lang === S.lang));
  const sz = $('size-seg'); sz.innerHTML = '';
  for (const s of SIZES) { const b = document.createElement('button'); b.textContent = t.sizes[s]; b.classList.toggle('sel', s === S.size); b.onclick = () => { setSize(s); syncPage(); refresh(); }; sz.appendChild(b); }
  $('size-row').hidden = SIZES.length < 2; $('size-note').textContent = t.sizeNotes[S.size];
  const acc = $('acc-seg'); acc.innerHTML = '';
  for (const k of ['big', 'calm', 'num']) { const b = document.createElement('button'); b.textContent = t[{ big: 'bigText', calm: 'calm', num: 'number' }[k]]; b.classList.toggle('sel', S[k]); b.onclick = () => { S[k] = !S[k]; syncPage(); updateLoupe(); refresh(); placeDesktopPanel(); }; acc.appendChild(b); }
  $('menu').textContent = '☰ ' + t.labTitle;
}
document.querySelectorAll('[data-lang]').forEach((b) => { b.onclick = () => { S.lang = b.dataset.lang; relabel(); syncPage(); refresh(); placeDesktopPanel(); }; });
$('btn-ar').onclick = () => enterXR('ar');
$('btn-vr').onclick = () => enterXR('vr');
$('btn-preview').onclick = () => { unlockAudio(); $('start').hidden = true; $('menu').hidden = false; };
$('menu').onclick = () => { $('start').hidden = false; $('menu').hidden = true; };
async function checkXR() {
  const ar = await navigator.xr?.isSessionSupported?.('immersive-ar').catch(() => false);
  const vr = !ar && await navigator.xr?.isSessionSupported?.('immersive-vr').catch(() => false);
  $('btn-ar').hidden = !ar; $('btn-vr').hidden = !vr;
  $('noxr').hidden = !!(ar || vr); $('noxr').textContent = T().noXR;
}

// ═════════════ main loop ═════════════
const clock = new THREE.Clock();
renderer.setAnimationLoop((time, frame) => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (renderer.xr.isPresenting) xrUpdate(frame, dt);
  else { controls.update(); }
  updateAnim(dt); updateSmoke(dt); updateRope(); placeLoupe(); faceLabels();
  if (mode === 'desktop') placeDesktopPanel();
  renderer.render(scene, camera);
});

// ═════════════ start ═════════════
syncPage(); checkXR();
layoutDesktop();
applySettings(settings);
relabel();
refresh();
L.ball.visible = false;
L.ready.then((m) => {
  model = m.model; wheels = m.wheels;
  $('status').textContent = '';
  window.__labReady = true;
}).catch((e) => { console.error(e); $('status').textContent = 'Could not load the cannon model.'; });

// test hooks (used by tests/; harmless otherwise)
window.__dbg = {
  THREE, S, L, panel, loupe, hint, camera, lab, scene,
  state: () => ({ phase, optionsOpen, planKey, levelIdx: test.levelIdx, data: JSON.parse(JSON.stringify(test.data)), predCm: test.predCm, predFor: test.predFor,
    anim: anim ? { kind: anim.kind, t: anim.t, playing: anim.playing } : null, cannonX: L.cannonX, mode, placing, size: S.size, lang: S.lang,
    lastCm: lastShot?.cm ?? null, challenge: ch.target ? { target: ch.target.cm, result: ch.result } : null, settings: { ...settings },
    panelOverflow: panel.overflow, labVisible: lab.visible, handleVisible: L.handle.visible, loupe: loupe.mesh.visible }),
  press: (id) => onButton(id),
  predictCm: (cm) => setPrediction(lab.localToWorld(new THREE.Vector3(-cm / 100, 0, RULER_Z))),
  handleWorld: () => L.handle.getWorldPosition(new THREE.Vector3()).toArray(),
  trackWorld: (cm) => lab.localToWorld(new THREE.Vector3(-cm / 100, 0, RULER_Z)).toArray(),
  shot, level,
  seed: (n) => { let a = n >>> 0; rand = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
};
if (DEBUG) console.log('debug on');
