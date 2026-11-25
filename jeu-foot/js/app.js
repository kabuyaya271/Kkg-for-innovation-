/* Interface du jeu : création du joueur, commandes, sons, boucle de match. */
import {
  Match, DT, W, H, BOX_D, BOX_W, POSTES, ARCHETYPES, ATTR_INFO, MIN_PTS, MAX_PTS, TOTAL_PTS, SLOTS, SLOT_POSTE, SLOT_ARCH, SLOT_NUM,
  attrsFor, sumAttrs, validateProfile
} from './moteur.js';
import { Rendu3D, KITS } from './rendu3d.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const DIFFS = [{ id: 'easy', label: 'Facile', skill: 0.3 }, { id: 'normal', label: 'Normal', skill: 0.6 }, { id: 'hard', label: 'Difficile', skill: 0.9 }];
const DURS = [{ s: 180, label: '3 min' }, { s: 300, label: '5 min' }, { s: 480, label: '8 min' }];

function makeProfile(poste, archId, base) {
  const a = ARCHETYPES[poste].find(x => x.id === archId) || ARCHETYPES[poste][0];
  return { name: (base && base.name) || 'Toi', numero: (base && base.numero) || 10, poste, archetype: a.id, attrs: Object.assign({}, a.attrs) };
}
function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }
let profile = load('fp-profile'); if (!profile || validateProfile(profile).length) profile = makeProfile('ATT', 'renard');
const settings = Object.assign({ diff: 'normal', dur: 300, cam: 'tv', auto: false, mute: false, shadows: true, qualite: 'haute', vol: 80, volFoule: 100, volFx: 100, btn: 'm', gaucher: false, vib: true }, load('fp-settings') || {});
if (!DURS.some(d => d.s === settings.dur)) settings.dur = 300;

function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id)); window.scrollTo(0, 0);
  document.body.classList.toggle('en-match', id === 'game');
  if (id !== 'game') { renderHub(); demarrerVitrine(); }
}

/* ---------- écran de création ---------- */
function renderCreate() {
  $('#f-name').value = profile.name; $('#f-num').value = profile.numero;
  $('#f-poste').innerHTML = Object.entries(POSTES).map(([k, v]) => `<button data-poste="${k}" class="${profile.poste === k ? 'on' : ''}">${v.label}</button>`).join('');
  $('#f-arch').innerHTML = ARCHETYPES[profile.poste].map(a => `<button class="chip ${profile.archetype === a.id ? 'on' : ''}" data-arch="${a.id}"><b>${a.name}</b><small>${a.desc}</small></button>`).join('') +
    (profile.archetype === 'custom' ? '<button class="chip on" disabled><b>Personnalisé</b><small>Ta propre répartition</small></button>' : '');
  $('#f-diff').innerHTML = DIFFS.map(d => `<button data-diff="${d.id}" class="${settings.diff === d.id ? 'on' : ''}">${d.label}</button>`).join('');
  $('#f-dur').innerHTML = DURS.map(d => `<button data-dur="${d.s}" class="${settings.dur === d.s ? 'on' : ''}">${d.label}</button>`).join('');
  $('#compo').textContent = `Ton équipe : toi (${POSTES[profile.poste].label.toLowerCase()}) + 10 robots en 4-4-2. Adversaire : 11 robots. Pas encore de fautes ni de hors-jeu dans ce prototype.`;
  renderAttrs();
}
function renderAttrs() {
  const tot = sumAttrs(profile);
  $('#f-attrs').innerHTML = attrsFor(profile.poste).map(k => {
    const v = profile.attrs[k]; return `<div class="attr">
    <div><b>${ATTR_INFO[k][0]}</b><small>${ATTR_INFO[k][1]}</small></div>
    <button class="pm" data-k="${k}" data-d="-1" ${v <= MIN_PTS ? 'disabled' : ''} aria-label="Retirer un point">−</button>
    <span class="val">${v}</span>
    <button class="pm" data-k="${k}" data-d="1" ${v >= MAX_PTS || tot >= TOTAL_PTS ? 'disabled' : ''} aria-label="Ajouter un point">+</button>
    <div class="bar"><i style="width:${v / MAX_PTS * 100}%"></i></div></div>`;
  }).join('');
  updateTotal();
}
function updateTotal() {
  const tot = sumAttrs(profile), el = $('#f-total'); el.textContent = tot + ' / ' + TOTAL_PTS; el.className = 'n ' + (tot === TOTAL_PTS ? 'ok' : 'ko');
  const errs = validateProfile(profile);
  $('#f-err').textContent = errs.length ? (tot < TOTAL_PTS ? `Il te reste ${TOTAL_PTS - tot} point(s) à placer.` : errs[0]) : '';
  $('#go-play').disabled = errs.length > 0; save('fp-profile', profile);
}
function bump(k, d) {
  const v = profile.attrs[k] + d, tot = sumAttrs(profile) + d; if (v < MIN_PTS || v > MAX_PTS || tot > TOTAL_PTS) return false;
  profile.attrs[k] = v; if (profile.archetype !== 'custom') { profile.archetype = 'custom'; renderCreate(); } else renderAttrs(); return true;
}
$('#f-poste').addEventListener('click', e => { const b = e.target.closest('[data-poste]'); if (!b) return; profile = makeProfile(b.dataset.poste, null, profile); renderCreate(); });
$('#f-arch').addEventListener('click', e => { const b = e.target.closest('[data-arch]'); if (!b) return; profile = makeProfile(profile.poste, b.dataset.arch, profile); renderCreate(); });
$('#f-diff').addEventListener('click', e => { const b = e.target.closest('[data-diff]'); if (!b) return; settings.diff = b.dataset.diff; save('fp-settings', settings); renderCreate(); });
$('#f-dur').addEventListener('click', e => { const b = e.target.closest('[data-dur]'); if (!b) return; settings.dur = +b.dataset.dur; save('fp-settings', settings); renderCreate(); });
$('#f-name').addEventListener('input', e => { profile.name = e.target.value; updateTotal(); });
$('#f-num').addEventListener('input', e => { profile.numero = parseInt(e.target.value, 10); updateTotal(); });
let holdT = null;
$('#f-attrs').addEventListener('pointerdown', e => {
  const b = e.target.closest('.pm'); if (!b || b.disabled) return; e.preventDefault();
  const k = b.dataset.k, d = +b.dataset.d; bump(k, d); let delay = 350;
  const rep = () => { if (!bump(k, d)) return; delay = Math.max(60, delay * 0.8); holdT = setTimeout(rep, delay); }; holdT = setTimeout(rep, delay);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => $('#f-attrs').addEventListener(t, () => { clearTimeout(holdT); holdT = null; }));
$('#go-create').onclick = () => { renderCreate(); show('create'); };
$('#c-back').onclick = () => show('home');
$('#go-quick').onclick = () => { if (validateProfile(profile).length) { renderCreate(); show('create'); return; } audioInit(); startMatch(); };
$('#go-reglages').onclick = () => ouvrirReglages();
$('#go-aide').onclick = () => $('#aide').classList.add('on');
$('#a-close').onclick = $('#a-ok').onclick = () => $('#aide').classList.remove('on');
function renderHub() {
  const ok = !validateProfile(profile).length;
  $('#h-profil').textContent = ok ? `${profile.name || 'Toi'} · n°${profile.numero} · ${POSTES[profile.poste].label}` : 'Poste, archétype et 100 points à répartir';
  $('#h-quick').textContent = ok ? `Coup d'envoi avec ${profile.name || 'ton joueur'} : toi + 10 robots contre 11 robots.` : "Crée d'abord ton joueur, puis coup d'envoi.";
}
$('#go-play').onclick = () => { if (validateProfile(profile).length) return; audioInit(); startMatch(); };

/* ---------- configuration du match ---------- */
function teamSlots(humanSlot) {
  const slots = {};
  for (const s of SLOTS) {
    if (s === humanSlot) { slots[s] = { profile: JSON.parse(JSON.stringify(Object.assign({}, profile, { name: profile.name.trim() }))), controller: 'human' }; continue; }
    const pr = makeProfile(SLOT_POSTE[s], SLOT_ARCH[s]); pr.name = 'Robot'; pr.numero = SLOT_NUM[s];
    if (humanSlot && pr.numero === profile.numero) pr.numero = SLOT_NUM[humanSlot];
    slots[s] = { profile: pr, controller: 'bot' };
  }
  return slots;
}
function buildConfig() {
  const diff = DIFFS.find(d => d.id === settings.diff) || DIFFS[1];
  return {
    seed: (Math.random() * 4294967296) >>> 0, duration: settings.dur, kickoffTeam: 0,
    teams: [{ name: 'Ton équipe', skill: 0.6, slots: teamSlots(POSTES[profile.poste].slot) }, { name: 'Robots FC', skill: diff.skill, slots: teamSlots(null) }]
  };
}

/* ---------- sons (synthétisés, aucun fichier) ---------- */
const SND = { ctx: null };
function audioInit() {
  if (SND.ctx) return;
  try {
    const A = window.AudioContext || window.webkitAudioContext, c = new A(); SND.ctx = c;
    SND.master = c.createGain(); SND.master.connect(c.destination); SND.fx = c.createGain(); SND.fx.connect(SND.master); appliquerSon();
    const n = c.sampleRate * 2, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; SND.noise = buf;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.5;
    const g = c.createGain(); g.gain.value = 0; src.connect(bp); bp.connect(g); g.connect(SND.master); src.start(); SND.crowd = g;
  } catch (e) { SND.ctx = null; }
}
function crowd(level, tc) { if (!SND.ctx) return; const t = SND.ctx.currentTime; SND.crowd.gain.cancelScheduledValues(t); SND.crowd.gain.setTargetAtTime(level * settings.volFoule / 100, t, tc || 0.4); }
function kickSnd(strong) {
  if (!SND.ctx) return; const c = SND.ctx, t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(strong ? 150 : 120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(strong ? 0.9 : 0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14); o.connect(g); g.connect(SND.fx); o.start(t); o.stop(t + 0.16);
  const s = c.createBufferSource(); s.buffer = SND.noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500; const g2 = c.createGain();
  g2.gain.setValueAtTime(strong ? 0.25 : 0.12, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f); f.connect(g2); g2.connect(SND.fx); s.start(t, Math.random()); s.stop(t + 0.06);
}
function whistle(times) {
  if (!SND.ctx) return; const c = SND.ctx; let t = c.currentTime;
  for (let i = 0; i < (times || 1); i++) {
    const d = times > 1 && i === times - 1 ? 0.9 : 0.3, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    o.frequency.value = 2900; lfo.frequency.value = 30; lg.gain.value = 200; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.13, t + 0.02); g.gain.setValueAtTime(0.13, t + d - 0.05); g.gain.linearRampToValueAtTime(0, t + d);
    o.connect(g); g.connect(SND.fx); o.start(t); lfo.start(t); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05); t += d + 0.15;
  }
}
function appliquerSon() { if (!SND.ctx) return; SND.master.gain.value = settings.mute ? 0 : settings.vol / 100; SND.fx.gain.value = settings.volFx / 100; }
function setMute(m) { settings.mute = m; save('fp-settings', settings); $('#b-snd').textContent = m ? '🔇' : '🔊'; appliquerSon(); }
function vib(ms) { if (settings.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* non pris en charge */ } }

/* ---------- rendu 3D ---------- */
let rendu = null;
function ensureRendu() {
  if (rendu) return true;
  try { rendu = new Rendu3D($('#scene')); rendu.setShadows(settings.shadows); rendu.setQualite(settings.qualite); return true; }
  catch (e) { console.error(e); $('#nogl').style.display = 'flex'; return false; }
}

/* ---------- boucle de jeu ---------- */
let G = null;
function startMatch(cfg) {
  cfg = cfg || buildConfig();
  const match = new Match(cfg), humanId = match.players.findIndex(p => p.controller === 'human');
  G = { cfg, match, mode: 'live', rec: [], humanId, acc: 0, last: performance.now(), speed: 1, evIdx: 0, paused: false, endShown: false };
  lastCtx = null; resetInputs(); show('game');
  if (!ensureRendu()) return;
  rendu.setMatch(match, humanId);
  $('#controls').style.display = ''; $('#replaybar').style.display = 'none'; $('#stam').style.display = '';
  $('#end').classList.remove('on'); $('#pause').classList.remove('on');
  crowd(0.1, 0.8); info(innerHeight > innerWidth ? 'Astuce : tiens ton téléphone à l\'horizontale' : 'Maintiens TIR pour doser la puissance', 3000);
  requestAnimationFrame(loop);
}
function startReplay() {
  const keep = G.mode === 'replay' ? G.orig : { hash: G.match.hash() };
  G = { cfg: G.cfg, match: new Match(G.cfg), mode: 'replay', rec: G.rec, orig: keep, humanId: G.humanId, acc: 0, last: performance.now(), speed: 1, evIdx: 0, paused: false, endShown: false };
  rendu.setMatch(G.match, G.humanId);
  $('#end').classList.remove('on'); $('#controls').style.display = 'none'; $('#replaybar').style.display = 'flex'; $('#stam').style.display = 'none'; $('#power').style.display = 'none';
  $$('.replaybar [data-speed]').forEach(b => b.classList.toggle('on', b.dataset.speed === '1')); requestAnimationFrame(loop);
}
function loop(t) {
  if (!G || !$('#game').classList.contains('on')) return;
  let dt = (t - G.last) / 1000; G.last = t; if (dt > 0.25) dt = 0.25; if (dt < 0) dt = 0;
  if (!G.paused && !G.match.over) { G.acc += dt * G.speed; let n = 0; while (G.acc >= DT && !G.match.over && n < 40) { G.acc -= DT; tickOnce(); n++; } }
  draw(G.paused ? 0 : dt * Math.min(G.speed, 4)); handleEvents(); updateButtons();
  if (G.match.over && !G.endShown) { G.endShown = true; setTimeout(showEnd, G.mode === 'live' ? 1500 : 300); }
  requestAnimationFrame(loop);
}
function tickOnce() {
  const inputs = {};
  if (G.mode === 'live') { const q = readHumanInput(); G.rec.push(q); inputs[G.humanId] = decodeInput(q); }
  else { const q = G.rec[G.match.tick]; if (q) inputs[G.humanId] = decodeInput(q); }
  G.match.step(inputs);
}
/* Entrées compactes [mx*100, my*100, drapeaux, puissance] : c'est ce qu'un client enverrait au serveur */
function decodeInput(q) { const f = q[2]; return { mx: q[0] / 100, my: q[1] / 100, sprint: !!(f & 1), pass: !!(f & 2), shoot: !!(f & 4), tackle: !!(f & 8), lob: !!(f & 16), press: !!(f & 32), help: !!(f & 64), auto: !!(f & 128), power: (q[3] || 0) / 100 }; }

/* ---------- entrées humaines ---------- */
const keys = new Set(), act = { pass: false, shoot: false, tackle: false, lob: false, help: false, power: 0 }, joy = { active: false, x: 0, y: 0, id: null, cx: 0, cy: 0 };
let sprintBtn = false, pressHold = false, charge = null;
function resetInputs() { keys.clear(); Object.assign(act, { pass: false, shoot: false, tackle: false, lob: false, help: false, power: 0 }); joy.active = false; joy.x = joy.y = 0; sprintBtn = false; pressHold = false; charge = null; knobReset(); $$('.btns button').forEach(b => b.classList.remove('act')); }
function attacking() { if (!G) return false; const m = G.match, b = m.ball; return b.owner >= 0 && m.players[b.owner].team === m.players[G.humanId].team; }
function chargePower() { return charge ? Math.min(1, Math.max(0.15, (performance.now() - charge.start) / 850)) : 0; }
function btnDown(id) {
  if (!G || G.mode !== 'live' || G.paused) return; const att = attacking();
  if (id === 'b1') { if (att) act.pass = true; else pressHold = true; }
  else if (id === 'b2') { if (att) charge = { start: performance.now() }; else act.tackle = true; }
  else if (id === 'b3') { if (att) act.lob = true; else act.help = true; }
  else if (id === 'bs') sprintBtn = true;
}
function btnUp(id) {
  if (id === 'b1') pressHold = false;
  else if (id === 'b2' && charge) { act.shoot = true; act.power = chargePower(); charge = null; }
  else if (id === 'bs') sprintBtn = false;
}
function readHumanInput() {
  let sx = 0, sy = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) sx -= 1; if (keys.has('ArrowRight') || keys.has('KeyD')) sx += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) sy -= 1; if (keys.has('ArrowDown') || keys.has('KeyS')) sy += 1;
  if (joy.active) { sx += joy.x; sy += joy.y; }
  const mag = Math.hypot(sx, sy); if (mag > 1) { sx /= mag; sy /= mag; }
  const [mx, my] = rendu ? rendu.screenDirToWorld(sx, sy) : [sx, sy];
  const sprint = sprintBtn || keys.has('ShiftLeft') || keys.has('ShiftRight');
  const f = (sprint ? 1 : 0) | (act.pass ? 2 : 0) | (act.shoot ? 4 : 0) | (act.tackle ? 8 : 0) | (act.lob ? 16 : 0) | (pressHold ? 32 : 0) | (act.help ? 64 : 0) | (settings.auto ? 128 : 0);
  const pw = act.shoot ? Math.round(act.power * 100) : 0;
  act.pass = act.shoot = act.tackle = act.lob = act.help = false; act.power = 0;
  return [Math.round(mx * 100), Math.round(my * 100), f, pw];
}
const KEYBTN = { Space: 'b1', KeyJ: 'b1', KeyK: 'b2', KeyL: 'b3' };
addEventListener('keydown', e => {
  if (!G || G.mode !== 'live' || !$('#game').classList.contains('on')) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyO' && !e.repeat) { toggleAuto(); return; }
  if (KEYBTN[e.code]) { e.preventDefault(); if (!e.repeat) btnDown(KEYBTN[e.code]); return; }
  if (e.code.startsWith('Arrow')) e.preventDefault(); keys.add(e.code);
});
addEventListener('keyup', e => { keys.delete(e.code); if (KEYBTN[e.code]) btnUp(KEYBTN[e.code]); });
addEventListener('blur', () => keys.clear());
const zone = $('#stick-zone'), base = $('#stick-base'), knob = $('#knob');
function knobReset() { base.style.left = base.style.top = ''; knob.style.left = '50%'; knob.style.top = '50%'; base.style.opacity = ''; }
zone.addEventListener('pointerdown', e => {
  e.preventDefault(); zone.setPointerCapture(e.pointerId); const r = zone.getBoundingClientRect();
  joy.id = e.pointerId; joy.active = true; joy.cx = e.clientX; joy.cy = e.clientY; joy.x = joy.y = 0;
  base.style.left = (e.clientX - r.left) + 'px'; base.style.top = (e.clientY - r.top) + 'px'; base.style.opacity = '1'; knob.style.left = '50%'; knob.style.top = '50%';
});
zone.addEventListener('pointermove', e => {
  if (!joy.active || e.pointerId !== joy.id) return; const R = 48; let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const d = Math.hypot(dx, dy);
  if (d > R) { dx = dx / d * R; dy = dy / d * R; } joy.x = dx / R; joy.y = dy / R; knob.style.left = `calc(50% + ${dx}px)`; knob.style.top = `calc(50% + ${dy}px)`;
});
['pointerup', 'pointercancel'].forEach(t => zone.addEventListener(t, e => { if (e.pointerId !== joy.id) return; joy.active = false; joy.x = joy.y = 0; joy.id = null; knobReset(); }));
['b1', 'b2', 'b3', 'bs'].forEach(id => {
  const b = $('#' + id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) { /* rien */ } b.classList.add('act'); btnDown(id); });
  ['pointerup', 'pointercancel'].forEach(t => b.addEventListener(t, () => { b.classList.remove('act'); btnUp(id); }));
});
function toggleAuto() { settings.auto = !settings.auto; save('fp-settings', settings); renderAuto(); info(settings.auto ? 'Auto-pressing activé : lâche le joystick, ton joueur presse seul' : 'Auto-pressing désactivé', 2200); }
function renderAuto() { const a = $('#auto'); a.textContent = 'AUTO-PRESSING : ' + (settings.auto ? 'ON' : 'OFF'); a.classList.toggle('on', settings.auto); }
$('#auto').addEventListener('click', e => { e.preventDefault(); toggleAuto(); });
renderAuto();
let lastCtx = null;
function updateButtons() {
  if (!G || G.mode !== 'live') return; const att = attacking();
  if (att !== lastCtx) {
    lastCtx = att; const b1 = $('#b1'), b2 = $('#b2'), b3 = $('#b3');
    if (att) { b1.textContent = 'PASSE'; b1.className = 'c-pass'; b2.textContent = 'TIR'; b2.className = 'c-shoot'; b3.innerHTML = 'PROFON-<br>DEUR'; b3.className = 'sm'; }
    else { b1.textContent = 'PRESSING'; b1.className = 'c-press sm'; b2.textContent = 'TACLE'; b2.className = 'c-def'; b3.textContent = 'AIDE'; b3.className = ''; charge = null; }
  }
  const pw = $('#power');
  if (charge) { const v = chargePower(); pw.style.display = 'block'; $('#power-i').style.width = (v * 100) + '%'; $('#power-t').textContent = v > 0.9 ? 'TROP FORT : AU-DESSUS !' : 'PUISSANCE'; }
  else pw.style.display = 'none';
}
$('#game').addEventListener('contextmenu', e => e.preventDefault());

/* ---------- pause / fin / replay ---------- */
function togglePause() { if (!G || G.match.over) return; G.paused = !G.paused; $('#pause').classList.toggle('on', G.paused); if (!G.paused) { G.last = performance.now(); resetInputs(); } crowd(G.paused ? 0 : 0.1); }
$('#b-pause').onclick = () => { if (G && G.mode === 'replay') { G.speed = 60; return; } togglePause(); };
$('#b-snd').onclick = () => { audioInit(); setMute(!settings.mute); }; setMute(settings.mute);
$('#b-cam').onclick = () => { settings.cam = settings.cam === 'tv' ? 'tac' : 'tv'; save('fp-settings', settings); info(settings.cam === 'tv' ? 'Caméra TV' : 'Vue tactique (tout le terrain)', 1500); };
$('#p-reglages').onclick = () => ouvrirReglages();
$('#p-resume').onclick = togglePause;
$('#p-quit').onclick = () => { $('#pause').classList.remove('on'); G = null; crowd(0); show('home'); };
$$('.replaybar [data-speed]').forEach(b => b.onclick = () => { G.speed = +b.dataset.speed; $$('.replaybar [data-speed]').forEach(x => x.classList.toggle('on', x === b)); });
$('#rp-quit').onclick = () => { if (G && !G.match.over) G.speed = 60; };
function showEnd() {
  if (!G) return; const m = G.match, me = m.players[G.humanId], s = me.stats, [a, b] = m.score;
  $('#e-ta').textContent = m.cfg.teams[0].name; $('#e-tb').textContent = m.cfg.teams[1].name; $('#e-score').textContent = a + ' – ' + b;
  $('#e-verdict').textContent = a > b ? 'Victoire !' : a < b ? 'Défaite' : 'Match nul';
  $('#e-verdict').style.color = a > b ? 'var(--acc)' : a < b ? 'var(--red)' : 'var(--acc2)';
  const cells = me.slot === 'GK'
    ? [['Arrêts', s.arrets], ['Buts encaissés', b], ['Passes', s.passesOk + '/' + s.passes], ['Ballons', s.ballons], ['Tacles', s.taclesOk + '/' + s.tacles], ['Énergie', Math.round(me.stamina * 100) + '%']]
    : [['Buts', s.buts], ['Tirs', s.tirs], ['Passes', s.passesOk + '/' + s.passes], ['Tacles', s.taclesOk + '/' + s.tacles], ['Ballons', s.ballons], ['Énergie', Math.round(me.stamina * 100) + '%']];
  $('#e-stats').innerHTML = cells.map(([l, v]) => `<div><b>${v}</b><small>${l}</small></div>`).join('');
  if (G.mode === 'replay') {
    const same = G.orig.hash === m.hash();
    $('#e-replay').textContent = same ? '✓ Replay identique au match : même graine + mêmes entrées = même résultat.' : '⚠ Le replay diffère du match original.';
    $('#e-replay').style.color = same ? 'var(--acc)' : 'var(--acc2)';
  } else $('#e-replay').textContent = '';
  $('#end').classList.add('on'); crowd(0.05, 1);
}
$('#e-replay-btn').onclick = () => { if (G) startReplay(); };
$('#e-again').onclick = () => startMatch();
$('#e-menu').onclick = () => { $('#end').classList.remove('on'); G = null; crowd(0); show('home'); };
$('#e-edit').onclick = () => { $('#end').classList.remove('on'); G = null; crowd(0); renderCreate(); show('create'); };

/* ---------- événements : messages, sons, animations ---------- */
let toastT = null, infoT = null;
function toast(big, small) { const t = $('#toast'); t.innerHTML = big + (small ? `<small>${small}</small>` : ''); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800); }
function info(text, ms) { const t = $('#info'); t.textContent = text; t.classList.add('on'); clearTimeout(infoT); infoT = setTimeout(() => t.classList.remove('on'), ms || 1400); }
function pname(p) { return p.controller === 'human' ? p.name : 'Robot n°' + p.numero; }
function handleEvents() {
  const m = G.match;
  while (G.evIdx < m.events.length) {
    const e = m.events[G.evIdx++];
    if (e.type === 'pass') { kickSnd(false); rendu.kick(e.by); if (e.by === G.humanId) vib(20); }
    else if (e.type === 'shot') { kickSnd(true); rendu.kick(e.by); crowd(0.3, 0.1); setTimeout(() => crowd(0.1, 0.6), 900); if (e.header) info('Tête !', 900); }
    else if (e.type === 'goal') {
      const sc = e.scorer >= 0 ? m.players[e.scorer] : null;
      toast('BUT !', (sc ? pname(sc) : '') + (e.own ? ' (contre son camp)' : '') + ' · ' + m.cfg.teams[e.team].name);
      crowd(0.75, 0.05); setTimeout(() => crowd(0.1, 1.2), 2800); whistle(1); rendu.celebrate(); vib([80, 60, 160]);
    }
    else if (e.type === 'save') { info('Arrêt de ' + pname(m.players[e.by]) + ' !', 1300); crowd(0.35, 0.08); setTimeout(() => crowd(0.1, 0.8), 700); }
    else if (e.type === 'tackle' && e.ok) { kickSnd(false); if (e.by === G.humanId) info('Tacle réussi', 1000); else if (e.on === G.humanId) { info('Ballon perdu', 1000); vib(60); } }
    else if (e.type === 'throw') info('Touche · ' + m.cfg.teams[e.team].name, 1300);
    else if (e.type === 'corner') { info('Corner · ' + m.cfg.teams[e.team].name, 1500); whistle(1); }
    else if (e.type === 'goalkick') info('Sortie de but', 1200);
    else if (e.type === 'kickoff') { if (m.tick < 5) whistle(1); }
    else if (e.type === 'end') { toast('Fin du match'); whistle(3); }
  }
}

/* ---------- dessin : 3D + mini-carte + tableau d'affichage ---------- */
const mini = $('#mini'), mctx = mini.getContext('2d');
function draw(dt) {
  rendu.update(dt, { cam: settings.cam });
  const m = G.match, me = m.players[G.humanId];
  const lab = $('#label'), sp = rendu.toScreen(me.x, me.y, 2.6);
  if (sp && G.mode === 'live') { lab.style.display = ''; lab.textContent = me.name.toUpperCase(); lab.style.left = sp[0] + 'px'; lab.style.top = sp[1] + 'px'; } else lab.style.display = 'none';
  drawMini(m, me);
  $('#h-score').textContent = m.score[0] + ' – ' + m.score[1];
  $('#h-clock').textContent = Math.min(90, Math.floor(m.tick / m.maxTick * 90)) + "'";
  const st = $('#h-stam'); st.style.width = Math.round(me.stamina * 100) + '%'; st.style.background = me.stamina < 0.3 ? 'var(--red)' : me.stamina < 0.6 ? 'var(--acc2)' : 'var(--acc)';
  $('#b-pause').textContent = G.mode === 'replay' ? '⏭' : '❚❚';
  mini.style.display = settings.cam === 'tac' ? 'none' : '';
  mini.style.bottom = G.mode === 'replay' ? '74px' : '';
}
function drawMini(m, me) {
  const dpr = Math.min(2, devicePixelRatio || 1), w = mini.clientWidth, h = mini.clientHeight;
  if (mini.width !== Math.round(w * dpr)) { mini.width = Math.round(w * dpr); mini.height = Math.round(h * dpr); }
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0); mctx.clearRect(0, 0, w, h);
  mctx.fillStyle = 'rgba(0,0,0,.5)'; mctx.fillRect(0, 0, w, h); mctx.fillStyle = 'rgba(40,140,75,.6)'; mctx.fillRect(3, 3, w - 6, h - 6);
  const sx = (w - 6) / W, sy = (h - 6) / H, X = x => 3 + x * sx, Y = y => 3 + y * sy;
  mctx.strokeStyle = 'rgba(255,255,255,.55)'; mctx.lineWidth = 1; mctx.strokeRect(3, 3, w - 6, h - 6);
  mctx.beginPath(); mctx.moveTo(X(W / 2), 3); mctx.lineTo(X(W / 2), h - 3); mctx.stroke();
  mctx.strokeRect(X(0), Y(H / 2 - BOX_W / 2), BOX_D * sx, BOX_W * sy); mctx.strokeRect(X(W - BOX_D), Y(H / 2 - BOX_W / 2), BOX_D * sx, BOX_W * sy);
  for (const p of m.players) { if (p === me) continue; mctx.fillStyle = KITS[p.team].css; mctx.beginPath(); mctx.arc(X(p.x), Y(p.y), 2.3, 0, 7); mctx.fill(); }
  mctx.fillStyle = '#ffd23f'; mctx.beginPath(); mctx.arc(X(me.x), Y(me.y), 3.6, 0, 7); mctx.fill();
  mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(X(m.ball.x), Y(m.ball.y), 2, 0, 7); mctx.fill();
}
/* ---------- paramètres ---------- */
const OUI_NON = [[true, 'Oui'], [false, 'Non']];
const REGLAGES = {
  jeu: [
    { k: 'cam', t: 'Caméra', o: [['tv', 'TV (suit le ballon)'], ['tac', 'Tactique']] },
    { k: 'auto', t: 'Auto-pressing', d: 'Joystick lâché : ton joueur presse ou se replace seul', o: OUI_NON },
    { k: 'diff', t: 'Niveau des robots adverses', o: DIFFS.map(d => [d.id, d.label]) },
    { k: 'dur', t: 'Durée du match', o: DURS.map(d => [d.s, d.label]) }
  ],
  graph: [
    { k: 'qualite', t: "Qualité d'image", d: 'Baisse-la si le jeu saccade', o: [['basse', 'Basse'], ['moyenne', 'Moyenne'], ['haute', 'Haute']] },
    { k: 'shadows', t: 'Ombres', o: OUI_NON }
  ],
  son: [
    { k: 'mute', t: 'Son', o: [[false, 'Activé'], [true, 'Coupé']] },
    { k: 'vol', t: 'Volume général', r: true },
    { k: 'volFoule', t: 'Ambiance du stade', r: true },
    { k: 'volFx', t: 'Frappes et sifflet', r: true }
  ],
  cmd: [
    { k: 'btn', t: 'Taille des boutons', o: [['s', 'Petite'], ['m', 'Normale'], ['l', 'Grande']] },
    { k: 'gaucher', t: 'Main', d: 'Gaucher : joystick à droite, boutons à gauche', o: [[false, 'Droitier'], [true, 'Gaucher']] },
    { k: 'vib', t: 'Vibrations', d: 'Passes, ballons perdus et buts', o: OUI_NON }
  ]
};
let onglet = 'jeu';
function renderReglages() {
  $$('#r-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === onglet));
  $('#r-body').innerHTML = REGLAGES[onglet].map(r => `<div class="reg"><span>${r.t}${r.d ? `<small><br>${r.d}</small>` : ''}</span>` +
    (r.r ? `<input type="range" min="0" max="100" step="5" value="${settings[r.k]}" data-k="${r.k}" aria-label="${r.t}">`
      : `<div class="seg">${r.o.map(([v, l], i) => `<button data-k="${r.k}" data-i="${i}" class="${settings[r.k] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`) + '</div>').join('');
}
function appliquerReglages() {
  save('fp-settings', settings); setMute(settings.mute); renderAuto();
  if (rendu) { rendu.setShadows(settings.shadows); rendu.setQualite(settings.qualite); }
  document.body.classList.toggle('btn-s', settings.btn === 's'); document.body.classList.toggle('btn-l', settings.btn === 'l');
  document.body.classList.toggle('gaucher', settings.gaucher);
}
function ouvrirReglages() { renderReglages(); $('#reglages').classList.add('on'); }
function fermerReglages() { $('#reglages').classList.remove('on'); if ($('#create').classList.contains('on')) renderCreate(); }
$('#r-tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { onglet = b.dataset.tab; renderReglages(); } };
$('#r-body').addEventListener('click', e => {
  const b = e.target.closest('[data-k][data-i]'); if (!b) return;
  const r = REGLAGES[onglet].find(x => x.k === b.dataset.k); settings[r.k] = r.o[+b.dataset.i][0]; appliquerReglages(); renderReglages();
});
$('#r-body').addEventListener('input', e => { if (e.target.dataset.k) { settings[e.target.dataset.k] = +e.target.value; appliquerReglages(); } });
$('#r-close').onclick = $('#r-ok').onclick = fermerReglages;
appliquerReglages();

/* ---------- stade en fond des menus ---------- */
let vitrineOn = false, vitrineT = 0;
function demarrerVitrine() {
  if (vitrineOn || !ensureRendu()) return; vitrineOn = true; vitrineT = performance.now();
  const tour = t => {
    if ($('#game').classList.contains('on')) { vitrineOn = false; return; }
    rendu.vitrine(Math.min(0.1, (t - vitrineT) / 1000)); vitrineT = t; requestAnimationFrame(tour);
  };
  requestAnimationFrame(tour);
}
show('home');

/* Accès de test (console du navigateur) */
window.jeu = { etat: () => G, rendu: () => rendu, settings };
