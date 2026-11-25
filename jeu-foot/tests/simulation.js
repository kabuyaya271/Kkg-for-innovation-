// Tests du moteur : node tests/simulation.js (depuis jeu-foot/)
import assert from 'node:assert/strict';
import { Match, ARCHETYPES, SLOTS, SLOT_POSTE, SLOT_ARCH, SLOT_NUM, validateProfile, W } from '../js/moteur.js';

function equipe(skill, humain) {
  const slots = {};
  for (const s of SLOTS) {
    const a = ARCHETYPES[SLOT_POSTE[s]].find(x => x.id === SLOT_ARCH[s]);
    slots[s] = { profile: { name: 'R', numero: SLOT_NUM[s], poste: SLOT_POSTE[s], attrs: { ...a.attrs } }, controller: s === humain ? 'human' : 'bot' };
  }
  return { name: 'E', skill, slots };
}
function jouer(cfg, entree) {
  const m = new Match(cfg);
  const h = m.players.findIndex(p => p.controller === 'human');
  while (!m.over) {
    m.step(h >= 0 ? { [h]: entree } : {});
    for (const p of m.players) assert.ok(Number.isFinite(p.x + p.y), 'position invalide');
    assert.ok(Number.isFinite(m.ball.x + m.ball.y + m.ball.z), 'ballon invalide');
  }
  return m;
}

// 1. Tous les archétypes respectent la règle des 100 points
for (const [poste, liste] of Object.entries(ARCHETYPES))
  for (const a of liste) assert.deepEqual(validateProfile({ name: 'x', numero: 7, poste, attrs: a.attrs }), [], a.id);
assert.ok(validateProfile({ name: 'x', numero: 7, poste: 'ATT', attrs: { ...ARCHETYPES.ATT[0].attrs, tir: 31 } }).length > 0, 'refuse 101 points');

// 2. Déterminisme : même graine + mêmes entrées = même match
let buts = 0;
for (let i = 0; i < 4; i++) {
  const cfg = { seed: 100 + i, duration: 180, teams: [equipe(0.6, 'BU1'), equipe(0.6)] };
  const a = jouer(cfg, { mx: 0, my: 0, auto: true }), b = jouer(cfg, { mx: 0, my: 0, auto: true });
  assert.equal(a.hash(), b.hash(), 'match non déterministe');
  buts += a.score[0] + a.score[1];
}
assert.ok(buts > 0, 'aucun but en 4 matchs');

// 3. Remises en jeu
function apres(etat) {
  const m = new Match({ seed: 1, duration: 60, teams: [equipe(0.6), equipe(0.6)] });
  m.freeze = 0; Object.assign(m.ball, { owner: -1, z: 0, vz: 0 }, etat);
  for (let i = 0; i < 30; i++) { m.step({}); const e = m.events.find(e => ['throw', 'corner', 'goalkick', 'goal'].includes(e.type)); if (e) return e; }
  return null;
}
assert.equal(apres({ x: 50, y: 2, vx: 0, vy: -15, lastTouch: 3 }).type, 'throw');
assert.equal(apres({ x: 3, y: 20, vx: -15, vy: 0, lastTouch: 2 }).type, 'corner');
assert.equal(apres({ x: 3, y: 20, vx: -15, vy: 0, lastTouch: 13 }).type, 'goalkick');
assert.equal(apres({ x: 2, y: 32, vx: -20, vy: 0, vz: 6, z: 2, lastTouch: 13 }).type, 'goalkick', 'au-dessus de la barre');
assert.equal(apres({ x: 2, y: 32, vx: -20, vy: 0, lastTouch: 13 }).type, 'goal');
void W;
console.log('OK : profils, déterminisme (' + buts + ' buts sur 4 matchs), remises en jeu');
