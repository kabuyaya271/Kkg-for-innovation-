// Décor 3D réel (Gaussian splats reconstruits depuis une vidéo du terrain) + maquette KKG posée dedans.
// decor-3d.html?d=<nom> lit decors/<nom>.json : { titre, intro, splat, rotation:[x,y,z,w], echelle, position:[x,y,z],
//   camera:{ position:[..], cible:[..] }, maquette?:{ url, position:[..], rotY (degrés), echelle } }
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as GS from 'gaussian-splats-3d';
import { initialiserPage, esc } from './ui.js';

initialiserPage();
const nom = new URLSearchParams(location.search).get('d') || '';
const chargement = document.getElementById('chargement');
const erreur = (m) => { chargement.textContent = m; };

if (!/^[\w-]+$/.test(nom)) erreur('Décor introuvable.');
else fetch(`decors/${nom}.json`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(demarrer).catch(() => erreur('Décor introuvable.'));

function demarrer(c) {
  document.title = `${c.titre} — Décor 3D — KKG Innovation`;
  document.getElementById('titre').textContent = c.titre;
  document.getElementById('filTitre').textContent = c.titre;
  if (c.intro) document.getElementById('intro').innerHTML = esc(c.intro);

  const cible = document.getElementById('cible3d');
  const rendu = new THREE.WebGLRenderer({ antialias: false });
  rendu.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  rendu.setSize(cible.clientWidth, cible.clientHeight);
  cible.appendChild(rendu.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xdfe6ea);
  const camera = new THREE.PerspectiveCamera(55, cible.clientWidth / cible.clientHeight, 0.1, 2000);
  camera.position.fromArray(c.camera?.position || [0, 10, 25]);
  const controles = new OrbitControls(camera, rendu.domElement);
  controles.target.fromArray(c.camera?.cible || [0, 0, 0]); controles.enableDamping = true; controles.update();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x887766, 1.6));
  const soleil = new THREE.DirectionalLight(0xffffff, 2.2); soleil.position.set(20, 40, 15); scene.add(soleil);

  // sharedMemoryForWorkers: false car GitHub Pages n'envoie pas les en-têtes COOP/COEP.
  const splats = new GS.DropInViewer({ sharedMemoryForWorkers: false, gpuAcceleratedSort: false });
  scene.add(splats);
  splats.addSplatScene(c.splat, {
    showLoadingUI: false, splatAlphaRemovalThreshold: 5,
    rotation: c.rotation || [0, 0, 0, 1], scale: Array(3).fill(c.echelle || 1), position: c.position || [0, 0, 0],
  }).then(() => chargement.remove()).catch(() => erreur('Le décor n’a pas pu être chargé.'));

  if (c.maquette) {
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(c.maquette.url, (g) => {
      const m = g.scene;
      m.traverse((o) => { if (/^(visite-|sol-escalier)/.test(o.name)) o.visible = false; });
      m.position.fromArray(c.maquette.position || [0, 0, 0]);
      m.rotation.y = THREE.MathUtils.degToRad(c.maquette.rotY || 0);
      m.scale.setScalar(c.maquette.echelle || 1);
      scene.add(m);
    });
  }

  addEventListener('resize', () => {
    camera.aspect = cible.clientWidth / cible.clientHeight; camera.updateProjectionMatrix();
    rendu.setSize(cible.clientWidth, cible.clientHeight);
  });
  rendu.setAnimationLoop(() => { controles.update(); rendu.render(scene, camera); });
}
