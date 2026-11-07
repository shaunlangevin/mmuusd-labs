// In an emulated Quest 3 (IWER), driven with the controller like a student would.
import { ok, eq, near, page, ready, st, idle, aim, trigger, setTrigger, tap, CP, sleep, pageErrors } from './lib/helpers.mjs';

export default (test) => {
  test('desk size: the lab appears in front, the lanyard fires it, pointing places the prediction', async () => {
    const p = await page({ xr: true });
    await ready(p);
    ok(await p.evaluate(() => !document.getElementById('btn-ar').hidden), 'the headset button shows');
    await p.click('#btn-ar'); await sleep(2500);
    let s = await st(p); eq([s.mode, s.size, s.labVisible, s.placing], ['ar', 'desk', true, false], 'desk size places itself');
    const lab = await p.evaluate(() => { const D = window.__dbg, C = D.camera.position; return { d: Math.hypot(D.lab.position.x - C.x, D.lab.position.z - C.z), below: C.y - D.lab.position.y, scale: D.lab.scale.x }; });
    ok(lab.d > 0.4 && lab.d < 0.9 && lab.below > 0.3, 'in front, at desk height: ' + JSON.stringify(lab));
    near(lab.scale, 1 / 7, 1e-6, 'desk scale 1:7');
    // pull the lanyard: grab the handle, tug 20 cm
    const h = await p.evaluate(() => window.__dbg.handleWorld());
    await aim(p, CP, h); await setTrigger(p, 1);
    await p.evaluate(() => { const c = window.__xr.controllers.right; c.position.set(c.position.x, c.position.y, c.position.z + 0.2); }); await sleep(500);
    s = await st(p); eq(s.anim?.kind, 'live', 'a tug on the lanyard fires the cannon');
    await setTrigger(p, 0); await idle(p);
    s = await st(p); eq(s.phase, 'q3', 'question next'); ok(s.cannonX < -0.2, 'the cannon rolled back');
    await tap(p, 'q3:same'); eq((await st(p)).phase, 'watch', 'buttons work with the controller');
    await tap(p, 'rp:done'); await tap(p, 'toPlan'); await tap(p, 'plan:ball'); await tap(p, 'startTest');
    s = await st(p); eq([s.phase, s.planKey], ['test', 'ball'], 'testing');
    ok(await p.evaluate(() => window.__dbg.panel.spec.blocks.some((b) => b.p && b.p.includes('pull the trigger'))), 'in the headset, the panel says to point and pull the trigger');
    const at = await p.evaluate(() => window.__dbg.trackWorld(30));
    await aim(p, CP, at); await trigger(p);
    s = await st(p); near(s.predCm, 30, 4, 'pointing at the track places the prediction flag');
    ok(await p.evaluate(() => window.__dbg.L.predFlag.visible), 'flag shows');
    await tap(p, 'fire'); await idle(p);
    s = await st(p); eq(Object.values(s.data)[0].length, 1, 'one trial recorded'); ok(s.loupe, 'magnifier');
    eq(pageErrors(p), [], 'page errors'); eq(p.offsite, [], 'requests to other sites');
    await p.close();
  }, { slow: true });

  test('half size: point at the floor to place it, Spanish from Options, exit', async () => {
    const p = await page({ xr: true });
    await ready(p, '?size=half');
    await p.click('#btn-ar'); await sleep(2500);
    let s = await st(p); eq([s.placing, s.labVisible], [true, false], 'asks the student to point at the floor');
    ok(await p.evaluate(() => window.__dbg.hint.mesh.visible), 'with a hint');
    await aim(p, CP, [0, 0, -2.2]); await trigger(p);
    s = await st(p); eq([s.placing, s.labVisible], [false, true], 'placed');
    const pos = await p.evaluate(() => [window.__dbg.lab.position.toArray(), window.__dbg.lab.scale.x]);
    near(pos[1], 0.5, 1e-6, 'half scale'); near(pos[0][1], 0, 0.01, 'on the floor');
    await tap(p, 'options'); await tap(p, 'lang:es');
    ok(await p.evaluate(() => window.__dbg.panel.spec.title === 'Opciones'), 'Spanish');
    await tap(p, 'acc:big');
    near(await p.evaluate(() => window.__dbg.panel.zoom), 1.3, 1e-6, 'Bigger text makes the panel bigger');
    await tap(p, 'size:life'); s = await st(p); eq([s.size, s.placing], ['life', true], 'changing the size asks to place it again');
    await aim(p, CP, [0, 0, -3]); await trigger(p);
    near(await p.evaluate(() => window.__dbg.lab.scale.x), 1, 1e-6, 'life size');
    await tap(p, 'exit'); await sleep(1500);
    eq((await st(p)).mode, 'desktop', 'Exit leaves the headset view');
    ok(await p.evaluate(() => !document.getElementById('start').hidden), 'back to the start page');
    eq(pageErrors(p), [], 'page errors');
    await p.close();
  }, { slow: true });
};
