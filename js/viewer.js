// Visionneuse 3D (Three.js) : scène, lumières, contrôles, vue éclatée, jour/nuit…
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { construireProjet, liberer } from './builder3d.js';

const CIEL_JOUR = new THREE.Color('#dfe6ec');
const CIEL_NUIT = new THREE.Color('#0c1320');

export class Visionneuse {
  constructor(conteneur, { rotationAuto = false, zoom = true, fond = null } = {}) {
    this.conteneur = conteneur;
    this.fond = fond;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !!fond, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    conteneur.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    if (!fond) {
      this.scene.background = CIEL_JOUR.clone();
      this.scene.fog = new THREE.Fog(CIEL_JOUR.clone(), 80, 260);
    }
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
    this.camera.position.set(30, 20, 30);

    this.hemi = new THREE.HemisphereLight('#ffffff', '#8a7f6e', 0.6);
    this.scene.add(this.hemi);
    this.soleil = new THREE.DirectionalLight('#fff4e0', 2.2);
    this.soleil.castShadow = true;
    this.soleil.shadow.mapSize.set(2048, 2048);
    this.soleil.shadow.bias = -0.0004;
    this.soleil.shadow.normalBias = 0.02;
    this.scene.add(this.soleil, this.soleil.target);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.autoRotate = rotationAuto;
    this.controls.autoRotateSpeed = 0.8;
    this.controls.enableZoom = zoom;
    this.controls.enablePan = zoom;

    this.modele = null;
    this.eclatement = 0;
    this.nuit = false;

    this._ro = new ResizeObserver(() => this.redimensionner());
    this._ro.observe(conteneur);
    this.redimensionner();

    this._actif = true;
    const boucle = () => {
      if (!this._actif) return;
      this._raf = requestAnimationFrame(boucle);
      this.controls.update();
      this._animerEclatement();
      this.renderer.render(this.scene, this.camera);
    };
    boucle();
  }

  redimensionner() {
    const w = this.conteneur.clientWidth || 1, h = this.conteneur.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _remplacer(obj) {
    if (this.modele) { this.scene.remove(this.modele); liberer(this.modele); }
    this.modele = obj;
    this.scene.add(obj);
    this.cadrer();
    this.definirNuit(this.nuit);
  }

  /** Affiche une maquette générée à partir des paramètres "modele" d'un projet. */
  afficherProjet(parametres, { garderVue = false } = {}) {
    const pos = this.camera.position.clone(), cible = this.controls.target.clone();
    this._remplacer(construireProjet(parametres));
    if (garderVue) { this.camera.position.copy(pos); this.controls.target.copy(cible); }
  }

  /** Charge un modèle .glb / .gltf exporté depuis SketchUp, Revit, Blender, ArchiCAD… */
  chargerGLB(url) {
    return new Promise((ok, ko) => {
      new GLTFLoader().load(url, (gltf) => {
        const obj = gltf.scene;
        const b = new THREE.Box3().setFromObject(obj);
        const taille = b.getSize(new THREE.Vector3());
        const centre = b.getCenter(new THREE.Vector3());
        obj.position.sub(new THREE.Vector3(centre.x, b.min.y, centre.z));
        const groupe = new THREE.Group();
        groupe.add(obj);
        const sol = new THREE.Mesh(
          new THREE.CircleGeometry(Math.max(taille.x, taille.z) * 2, 64),
          new THREE.MeshStandardMaterial({ color: '#7e9b5c', roughness: 0.95 }),
        );
        sol.rotation.x = -Math.PI / 2;
        sol.position.y = -0.01;
        sol.receiveShadow = true;
        groupe.add(sol);
        obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        // niveaux éventuels nommés "niveau-0", "niveau-1"… dans le fichier 3D
        const niveaux = [];
        obj.traverse((o) => { const m = /^niveau[-_ ]?(\d+)/i.exec(o.name); if (m) { o.userData.index = +m[1]; niveaux.push(o); } });
        niveaux.forEach((o) => { o.userData.y0 = o.position.y; });
        groupe.userData = { niveaux, dims: { w: taille.x, d: taille.z, hauteur: taille.y } };
        this._remplacer(groupe);
        ok(groupe);
      }, undefined, ko);
    });
  }

  cadrer() {
    if (!this.modele) return;
    const { dims } = this.modele.userData;
    const r = Math.max(dims.w, dims.d, dims.hauteur) * 0.75 + 6;
    const dist = r / Math.tan((this.camera.fov * Math.PI) / 360) * 0.9;
    this.controls.target.set(0, dims.hauteur * 0.4, 0);
    this.camera.position.set(dist * 0.72, dims.hauteur * 0.4 + dist * 0.42, dist * 0.72);
    this.camera.near = 0.1;
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.controls.maxDistance = dist * 3;
    this.controls.minDistance = 3;

    const s = this.soleil.shadow.camera;
    const e = r * 1.6;
    s.left = -e; s.right = e; s.top = e; s.bottom = -e; s.near = 1; s.far = r * 8;
    s.updateProjectionMatrix();
    this.soleil.position.set(r * 1.2, r * 2.2, r * 0.9);
    this.controls.update();
  }

  vueDessus() {
    if (!this.modele) return;
    const { dims } = this.modele.userData;
    const r = Math.max(dims.w, dims.d) + 12;
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0.01, r * 2.2, 0.01);
  }

  vueFacade() {
    if (!this.modele) return;
    const { dims } = this.modele.userData;
    const r = Math.max(dims.w, dims.hauteur) + 8;
    this.controls.target.set(0, dims.hauteur * 0.45, 0);
    this.camera.position.set(0, dims.hauteur * 0.45 + 1, r * 2);
  }

  /** 0 = assemblé, 1 = niveaux écartés */
  definirEclatement(v) { this.eclatement = v; }

  _animerEclatement() {
    if (!this.modele) return;
    const niveaux = this.modele.userData.niveaux || [];
    for (const g of niveaux) {
      const y0 = g.userData.y0 || 0;
      const cible = y0 + g.userData.index * this.eclatement * 3;
      g.position.y += (cible - g.position.y) * 0.15;
    }
  }

  definirNuit(nuit) {
    this.nuit = nuit;
    const ciel = nuit ? CIEL_NUIT : CIEL_JOUR;
    if (!this.fond) { this.scene.background.copy(ciel); this.scene.fog.color.copy(ciel); }
    this.soleil.intensity = nuit ? 0.25 : 2.2;
    this.soleil.color.set(nuit ? '#9fb4ff' : '#fff4e0');
    this.hemi.intensity = nuit ? 0.15 : 0.6;
    this.scene.environment = nuit ? null : this.envTexture;
    this.renderer.toneMappingExposure = nuit ? 0.8 : 1.05;
    const v = this.modele?.userData.materiaux?.verre;
    if (v) { v.emissiveIntensity = nuit ? 1.6 : 0; v.opacity = nuit ? 0.95 : 0.78; }
  }

  definirFilaire(actif) {
    this.modele?.traverse((o) => {
      if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.wireframe = actif; });
    });
  }

  capture(largeur = 1200) {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = largeur; c.height = Math.round((largeur * src.height) / src.width);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.9);
  }

  detruire() {
    this._actif = false;
    cancelAnimationFrame(this._raf);
    this._ro.disconnect();
    if (this.modele) liberer(this.modele);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

// ---------- Vignettes : un seul moteur hors-écran partagé ----------
let moteurVignette = null;
export function vignette(parametres, largeur = 640, hauteur = 440) {
  if (!moteurVignette) {
    const div = document.createElement('div');
    div.style.cssText = `position:fixed;left:-9999px;top:0;width:${largeur}px;height:${hauteur}px`;
    document.body.appendChild(div);
    moteurVignette = new Visionneuse(div);
    moteurVignette._actif = false; // pas de boucle : rendu à la demande
    cancelAnimationFrame(moteurVignette._raf);
    moteurVignette.renderer.setPixelRatio(1);
    moteurVignette.renderer.setSize(largeur, hauteur, false);
    moteurVignette.camera.aspect = largeur / hauteur;
    moteurVignette.camera.updateProjectionMatrix();
  }
  const v = moteurVignette;
  v._remplacer(construireProjet(parametres));
  v.controls.update();
  v.renderer.render(v.scene, v.camera);
  return v.renderer.domElement.toDataURL('image/jpeg', 0.85);
}
