# Tabloid

Éditeur visuel de schémas de bases de données relationnelles, entièrement dans le navigateur. Concevez vos tables, définissez vos colonnes, tracez vos relations et exportez en SQL ou JSON.

Pas de backend. Pas de compte. Ouvrez et concevez.

## Fonctionnalités

- **Canvas infini** — déplacez-vous, zoomez et organisez votre schéma librement
- **Éditeur de tables visuel** — créez des tables, ajoutez des colonnes, définissez types et contraintes en ligne
- **Relations par glisser-déposer** — reliez les colonnes entre tables avec des relations one-to-one, one-to-many ou many-to-many, affichées en notation crow’s foot
- **Auto-arrangement** — disposez automatiquement vos tables pour plus de lisibilité
- **Export SQL** — génération de `CREATE TABLE` pour PostgreSQL ou MySQL
- **Export JSON / YAML** — sérialisation complète du schéma pour intégration avec d’autres outils
- **Export image** — téléchargez votre schéma en PNG ou SVG
- **Import** — chargez un fichier `.tabloid.json` sauvegardé pour reprendre l’édition
- **Sauvegarde automatique locale** — votre travail est persisté dans le navigateur
- **Mode sombre** — parce que c’est indispensable
- **Annuler / Rétablir** — Ctrl+Z / Ctrl+Shift+Z

## Démarrage rapide

```bash
git clone https://github.com/<votre-pseudo>/tabloid.git
cd tabloid
npm install
npm run dev
```

Ouvrez `http://localhost:5173` et commencez à concevoir.

## Stack technique

|Couche     |Technologie                      |
|-----------|---------------------------------|
|Interface  |React 18 + TypeScript            |
|Canvas     |React Flow (`@xyflow/react`)     |
|État       |Zustand                          |
|Styling    |Tailwind CSS                     |
|Build      |Vite                             |
|Tests      |Vitest                           |
|Déploiement|GitHub Pages (via GitHub Actions)|

## Raccourcis clavier

|Raccourci                |Action                     |
|-------------------------|---------------------------|
|`Ctrl + Z`               |Annuler                    |
|`Ctrl + Shift + Z`       |Rétablir                   |
|`Suppr`                  |Supprimer la sélection     |
|`Ctrl + A`               |Tout sélectionner          |
|`Ctrl + D`               |Dupliquer la sélection     |
|`Ctrl + S`               |Sauvegarder dans un fichier|
|`Ctrl + +/-`             |Zoom avant/arrière         |
|Double-clic sur le canvas|Créer une nouvelle table   |

## Formats d’export

### SQL

```sql
CREATE TABLE utilisateurs (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    cree_le TIMESTAMP DEFAULT NOW()
);

CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    auteur_id INT NOT NULL REFERENCES utilisateurs(id),
    titre VARCHAR(255) NOT NULL,
    contenu TEXT
);
```

### JSON

```json
{
  "tables": [
    {
      "name": "utilisateurs",
      "columns": [
        { "name": "id", "type": "SERIAL", "isPrimaryKey": true },
        { "name": "email", "type": "VARCHAR", "isUnique": true, "isNullable": false }
      ]
    }
  ],
  "relations": [
    {
      "source": { "table": "articles", "column": "auteur_id" },
      "target": { "table": "utilisateurs", "column": "id" },
      "type": "many-to-one"
    }
  ]
}
```

## Développement

```bash
npm run dev          # Serveur de développement
npm run build        # Build de production
npm run preview      # Prévisualiser le build
npm run test         # Lancer les tests
npm run lint         # Linter
npm run type-check   # Vérification TypeScript
```

## Déploiement

Le projet se déploie automatiquement sur GitHub Pages à chaque push sur `main` via GitHub Actions.

Pour déployer manuellement :

```bash
npm run build
# Le résultat est dans dist/
```

## Licence

MIT
