#!/usr/bin/env python3
"""Recherche et télécharge des ressources 3D libres (CC0, usage commercial autorisé, sans attribution).

Sources : Poly Haven (modèles, matières, ciels HDRI) et ambientCG (matières PBR).
Usage :
  python3 telecharger.py chercher marbre            # liste les ressources correspondantes
  python3 telecharger.py matiere Marble012 [2K]     # matière ambientCG (couleur, rugosité, normale)
  python3 telecharger.py polyhaven potted_plant_04  # modèle / matière / HDRI Poly Haven
Les fichiers vont dans ./ressources/<nom>/ (à ne pas committer : volumineux).
"""
import json, os, sys, urllib.request, zipfile, io
UA = [('User-Agent', 'curl/8.5.0')]
op = urllib.request.build_opener(); op.addheaders = UA; urllib.request.install_opener(op)
DEST = os.path.join(os.getcwd(), 'ressources')
TRAD = {'marbre': 'marble', 'bois': 'wood', 'parquet': 'parquet', 'pierre': 'stone', 'enduit': 'plaster', 'carrelage': 'tiles',
        'beton': 'concrete', 'gazon': 'grass', 'herbe': 'grass', 'paves': 'paving', 'brique': 'brick', 'tissu': 'fabric',
        'cuir': 'leather', 'metal': 'metal', 'plante': 'plant', 'arbre': 'tree', 'arbuste': 'shrub', 'canape': 'sofa',
        'chaise': 'chair', 'table': 'table', 'lit': 'bed', 'lampe': 'lamp', 'fauteuil': 'armchair', 'gravier': 'gravel'}

def lire(url): return json.load(urllib.request.urlopen(url, timeout=60))

def chercher(mot):
    m = TRAD.get(mot.lower(), mot.lower())
    ph = lire('https://api.polyhaven.com/assets')
    for k, v in ph.items():
        if m in k or m in ' '.join(v.get('tags', [])):
            print(f"polyhaven  {k:40s} {['hdri', 'matière', 'modèle'][v['type']]}")
    ac = lire(f'https://ambientcg.com/api/v2/full_json?type=Material&limit=30&q={m}')
    for a in ac.get('foundAssets', []):
        print(f"ambientcg  {a['assetId']:40s} matière")

def matiere(aid, res='2K'):
    a = lire(f'https://ambientcg.com/api/v2/full_json?id={aid}&include=downloadData')['foundAssets'][0]
    zips = [d for d in a['downloadFolders']['default']['downloadFiletypeCategories']['zip']['downloads'] if d['attribute'] == f'{res}-JPG']
    data = urllib.request.urlopen(zips[0]['fullDownloadPath'], timeout=300).read()
    out = os.path.join(DEST, aid); os.makedirs(out, exist_ok=True)
    zipfile.ZipFile(io.BytesIO(data)).extractall(out); print('ok', out)

def polyhaven(aid):
    f = lire(f'https://api.polyhaven.com/files/{aid}'); out = os.path.join(DEST, aid); os.makedirs(out, exist_ok=True)
    def get(u, chemin):
        os.makedirs(os.path.dirname(chemin), exist_ok=True); urllib.request.urlretrieve(u, chemin)
    if 'hdri' in f: get(f['hdri']['4k']['hdr']['url'], os.path.join(out, aid + '.hdr'))
    elif 'blend' in f:
        b = f['blend']['1k']['blend']; get(b['url'], os.path.join(out, aid + '.blend'))
        for c, inc in b.get('include', {}).items(): get(inc['url'], os.path.join(out, c))
    else:
        for carte, cle in (('diff', 'Diffuse'), ('rough', 'Rough'), ('nor', 'nor_gl')):
            if cle in f: get(f[cle]['2k']['jpg']['url'], os.path.join(out, f'{aid}_{carte}.jpg'))
    print('ok', out)

if __name__ == '__main__':
    cmd, *args = sys.argv[1:] or ['aide']
    {'chercher': chercher, 'matiere': matiere, 'polyhaven': polyhaven}.get(cmd, lambda *a: print(__doc__))(*args)
