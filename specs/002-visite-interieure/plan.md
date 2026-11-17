# Implementation Plan: Visite intérieure 3D

**Branch**: `002-visite-interieure` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

## Summary

Ajouter à la visionneuse Three.js existante un mode « première personne » piloté par des repères contenus dans la maquette GLB.

## Technical Context

- **Langage / dépendances** : JavaScript (modules ES), Three.js 0.160 (déjà chargé par importmap) ; aucune nouvelle dépendance.
- **Données** : maquette GLB exportée de Blender avec `export_extras` (propriétés personnalisées → `userData`).
- **Cibles** : navigateurs récents, ordinateur et mobile.
- **Contraintes** : site statique (GitHub Pages), pas de serveur.

## Conventions de la maquette (contrat)

| Nom de nœud | Rôle | userData |
|---|---|---|
| `visite-entree-N` | point dehors de l'entrée N | `libelle` |
| `visite-dedans-N` | point dedans de l'entrée N (hauteur des yeux) | `libelle` |
| `visite-piece-N` | centre d'une pièce (hauteur des yeux) | `libelle`, `niveau` |
| `sol-…` | surfaces praticables (lancer de rayon vertical) | — |
| `porte-…` | vantaux, ignorés par les collisions | — |
| autres maillages | obstacles (lancer de rayon horizontal) | — |

## Structure

- `js/visite.js` (nouveau) : classe `Visite` — détection des repères, pastilles HTML, animation d'entrée, contrôles première personne, sol, collisions, menu des pièces, sortie.
- `js/viewer.js` : la boucle de rendu appelle un « tick » optionnel ; `chargerGLB` conserve la scène glTF.
- `js/projet.js`, `projet.html`, `css/style.css` : bouton « Visite intérieure », panneau de visite, commandes tactiles.

## Approche

1. Contrôles : regard par glisser (yaw/pitch), déplacement clavier + boutons tactiles, clic sur le sol = marche vers le point.
2. Sol : rayon vers le bas depuis 0,6 m au-dessus des pieds sur les maillages `sol-…` ; montée max 0,40 m ; chute douce.
3. Collisions : 5 rayons horizontaux à 0,5 m et 1,2 m au-dessus des pieds, distance mini 0,30 m, obstacles pré-filtrés par sphères englobantes.
4. Lumière : en visite, ombres désactivées, lumière hémisphérique renforcée + lampe ponctuelle attachée à la caméra.
