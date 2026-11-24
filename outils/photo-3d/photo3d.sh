#!/usr/bin/env bash
# Vidéo (ou dossier de photos) d'un terrain -> décor 3D en « Gaussian splats » (.ply), 100 % gratuit et open source.
#   ./photo3d.sh <video.mp4 | dossier_photos> <dossier_sortie> [iterations=3000]
# Outils : ffmpeg, COLMAP (positions des caméras), OpenSplat (entraînement des splats). Voir README.md.
set -euo pipefail
SRC=$1; OUT=$2; N=${3:-3000}
OPENSPLAT=${OPENSPLAT:-opensplat}
mkdir -p "$OUT/images"
if [ -d "$SRC" ]; then cp "$SRC"/*.[jJpP][pPnN]*[gG] "$OUT/images/"
else ffmpeg -loglevel error -i "$SRC" -vf "fps=2,scale='min(1280,iw)':-2" -q:v 2 "$OUT/images/i_%04d.jpg"; fi   # 2 images/s suffisent
echo "$(ls "$OUT/images" | wc -l) images"
[ "$(ls "$OUT/images" | wc -l)" -ge 20 ] || { echo "Il faut au moins 20 photos (idéal : 60 à 150)."; exit 1; }
GPU=0; command -v nvidia-smi >/dev/null && GPU=1
DB="$OUT/database.db"; rm -f "$DB"; rm -rf "$OUT/sparse"; mkdir -p "$OUT/sparse"
colmap feature_extractor --database_path "$DB" --image_path "$OUT/images" --ImageReader.single_camera 1 --SiftExtraction.use_gpu $GPU
if [ -d "$SRC" ]; then colmap exhaustive_matcher --database_path "$DB" --SiftMatching.use_gpu $GPU
else colmap sequential_matcher --database_path "$DB" --SiftMatching.use_gpu $GPU --SequentialMatching.overlap 15; fi
# Seuils assouplis : sinon les murs lisses (enduit, ciel) coupent la scène en plusieurs morceaux.
colmap mapper --database_path "$DB" --image_path "$OUT/images" --output_path "$OUT/sparse" \
  --Mapper.min_num_matches 10 --Mapper.init_min_num_inliers 40 --Mapper.abs_pose_min_num_inliers 12 --Mapper.abs_pose_min_inlier_ratio 0.1
[ -f "$OUT/sparse/0/images.bin" ] || { echo "COLMAP n'a pas retrouvé les caméras : photos floues ou trop peu de recouvrement."; exit 1; }
# Plusieurs blocs possibles si le parcours est coupé : on garde le plus grand (sparse/0 est en général le bon).
# Densifier souvent : sur processeur on fait peu d'itérations, il faut quand même assez de détails.
"$OPENSPLAT" "$OUT" -n "$N" --downscale-factor "${DOWNSCALE:-2}" --refine-every 100 --densify-from 200 --loss-thresh 0.05 -o "$OUT/decor.ply"
echo "Décor prêt : $OUT/decor.ply"
