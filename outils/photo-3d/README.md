# Photo → décor 3D (gratuit, open source)

Transforme une **vidéo du terrain d'un client** (ou 20 à 150 photos) en décor 3D réel, affiché sur le site avec la maquette KKG posée dedans.
Remplace un service payant type « Atlas » : ici tout vient des vraies images, rien n'est inventé.

| Étape | Outil (licence) | Rôle |
|---|---|---|
| 1 | ffmpeg (LGPL) | découpe la vidéo en images (2 par seconde) |
| 2 | COLMAP (BSD) | retrouve la position de la caméra sur chaque image |
| 3 | OpenSplat (AGPL, utilisé comme programme, non modifié) | construit la scène en « Gaussian splats » (`decor.ply`) |
| 4 | GaussianSplats3D (MIT) | affiche le décor dans le navigateur (`decor-3d.html`) |

## Filmer le terrain (consignes à envoyer au client)
- Une minute environ, en marchant lentement **tout autour** du terrain, téléphone à hauteur d'yeux, puis un second tour plus large.
- En plein jour, sans contre-jour ; ne pas zoomer ; éviter les passants et voitures qui bougent.
- Format paysage ou portrait, peu importe. Envoyer la vidéo d'origine (pas la version compressée de WhatsApp si possible).

## Installation (Linux, une fois)
```
sudo apt install colmap libopencv-dev cmake build-essential ffmpeg
# LibTorch CPU (ou CUDA si carte NVIDIA) : https://pytorch.org/get-started/locally/ → LibTorch
git clone https://github.com/pierotofy/OpenSplat && cd OpenSplat && mkdir build && cd build
cmake -DCMAKE_PREFIX_PATH=/chemin/libtorch -DGPU_RUNTIME=CPU .. && make -j$(nproc)
```

## Utilisation
```
OPENSPLAT=/chemin/OpenSplat/build/opensplat ./photo3d.sh terrain.mp4 sortie/ 3000
```
Sans carte graphique : compter 1 à 3 h par terrain. Avec une carte NVIDIA : quelques minutes (et `-n 30000` pour la qualité maximale).

## Publier sur le site
1. Copier `sortie/decor.ply` dans `decors/<nom>.ply` (fichier lourd : viser moins de 30 Mo).
2. Créer `decors/<nom>.json` : titre, `rotation` (le « haut » de COLMAP est souvent inversé : essayer `[1,0,0,0]`), position de la caméra et, si besoin, la maquette à poser (`maquette.url`, `position`, `rotY`, `echelle`).
3. Lien : `decor-3d.html?d=<nom>`.

Les vidéos des clients sont des données privées : ne publier un décor qu'avec l'accord du client.
