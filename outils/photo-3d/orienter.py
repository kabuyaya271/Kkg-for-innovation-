# Redresse le décor : le « haut » est la normale du plan des positions de caméra (on filme à hauteur constante).
#   python3 orienter.py <cameras.json d'OpenSplat> <nom> "<titre>"  →  écrit <nom>.json pour decors/
import json, sys
import numpy as np

cams = json.load(open(sys.argv[1]))
P = np.array([c['position'] for c in cams])
centre = P.mean(0)
haut = np.linalg.svd(P - centre)[2][2]                       # plus petite variance = normale du plan
if haut @ np.mean([np.array(c['rotation'])[:, 1] for c in cams], 0) > 0: haut = -haut   # axe y caméra (OpenCV) = bas

# Quaternion qui amène `haut` sur +Y (repère three.js)
y = np.array([0.0, 1.0, 0.0]); axe = np.cross(haut, y); s = np.linalg.norm(axe); c = haut @ y
q = ([0, 0, 0, 1] if c > 0 else [1, 0, 0, 0]) if s < 1e-9 else [*(axe / s * np.sin(np.arctan2(s, c) / 2)), np.cos(np.arctan2(s, c) / 2)]

def tourner(v):
    x, yq, z, w = q; u = np.array([x, yq, z])
    return v + 2 * np.cross(u, np.cross(u, v) + w * v)

C = np.array([tourner(p - centre) for p in P])
rayon = float(np.median(np.linalg.norm(C[:, [0, 2]], axis=1)))
assert np.ptp(C[:, 1]) < rayon, 'caméras pas à peu près à plat : vérifier la vidéo'
conf = {
    'titre': sys.argv[3] if len(sys.argv) > 3 else sys.argv[2],
    'splat': f'decors/{sys.argv[2]}.ply',
    'rotation': [round(float(v), 5) for v in q],
    'position': [round(float(v), 4) for v in -tourner(centre)],
    'echelle': 1,
    'camera': {'position': [0, round(rayon * 0.6, 2), round(rayon * 1.2, 2)], 'cible': [0, 0, 0]},
}
json.dump(conf, open(f'{sys.argv[2]}.json', 'w'), ensure_ascii=False, indent=2)
print(json.dumps(conf, ensure_ascii=False))
