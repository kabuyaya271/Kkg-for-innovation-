# Bibliothèque 3D — objets et matières pour le réalisme

## Sources utilisées (licence CC0 : usage commercial libre, aucune attribution, redistribution autorisée)
| Site | Contenu | Accès |
|---|---|---|
| **Poly Haven** (polyhaven.com) | ciels HDRI, matières PBR, modèles (plantes, arbres, meubles…) | automatique (`telecharger.py`) |
| **ambientCG** (ambientcg.com) | plus de 2 000 matières PBR (marbre, bois, carrelage, enduits, pierre, béton…) | automatique (`telecharger.py`) |

## Commandes
```
python3 telecharger.py chercher marbre        # cherche dans les deux bibliothèques (mots en français acceptés)
python3 telecharger.py matiere Marble012       # matière ambientCG en 2K
python3 telecharger.py polyhaven sofa_03       # modèle, matière ou ciel Poly Haven
```

## Autres bibliothèques connues (à utiliser avec prudence)
- **3D Warehouse (SketchUp)** : immense, mais compte Trimble obligatoire et licence qui interdit de redistribuer les modèles : utilisables pour des **images**, pas dans les maquettes publiées sur le site.
- **Sketchfab** : licences variables (CC-BY = mention de l'auteur obligatoire ; « Standard » = achat). Vérifier chaque modèle.
- **BlenderKit** : bibliothèque intégrée à Blender (compte gratuit, objets « Royalty Free »), pratique sur un ordinateur personnel.
- **Quaternius, Kenney** : CC0, mais style dessin animé (low poly), peu adapté au rendu réaliste.

Règle : pour tout ce qui est publié sur le site (maquettes GLB), n'utiliser que du **CC0**.
