# Tabloid

Éditeur visuel de schémas de bases de données relationnelles, entièrement dans le navigateur. Concevez vos tables, définissez vos colonnes, tracez vos relations et exportez en SQL ou JSON.

Pas de backend. Pas de compte. Ouvrez et concevez.

## Fonctionnalités

- **Canvas infini** — déplacez-vous, zoomez et organisez votre schéma librement
- **Éditeur de tables visuel** — créez des tables, ajoutez des colonnes, définissez types et contraintes en ligne
- **Types abstraits** — modélisez avec des types agnostiques du SGBD (TEXT, INTEGER, UUID, JSON...) et exportez vers le dialecte de votre choix
- **Export SQL multi-dialecte** — génération de `CREATE TABLE` pour PostgreSQL, MySQL, SQLite, Oracle ou SQL Server
- **Relations par glisser-déposer** — reliez les colonnes entre tables avec des relations one-to-one, one-to-many ou many-to-many, affichées en notation crow's foot
- **Auto-arrangement** — disposez automatiquement vos tables pour plus de lisibilité
- **Export JSON / YAML** — sérialisation complète du schéma pour intégration avec d'autres outils
- **Export image** — téléchargez votre schéma en PNG ou SVG
- **Export Mermaid** — diagramme ER en syntaxe Mermaid, intégrable directement dans un README GitHub
- **Export Excalidraw** — fichier `.excalidraw` pour continuer l'édition dans Excalidraw
- **Import** — chargez un fichier `.tabloid.json` sauvegardé pour reprendre l'édition
- **Sauvegarde automatique locale** — votre travail est persisté dans le navigateur
- **Mode sombre** — parce que c'est indispensable
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

| Couche | Technologie |
|--------|-------------|
| Interface | React 18 + TypeScript |
| Canvas | React Flow (`@xyflow/react`) |
| État | Zustand |
| Styling | Tailwind CSS |
| Build | Vite |
| Tests | Vitest + Playwright |
| Déploiement | GitHub Pages (via GitHub Actions) |

## Raccourcis clavier

| Action | Windows / Linux | macOS |
|--------|----------------|-------|
| Annuler | `Ctrl + Z` | `⌘ + Z` |
| Rétablir | `Ctrl + Y` | `⌘ + Shift + Z` |
| Supprimer la sélection | `Suppr` | `⌫` (Backspace) |
| Tout sélectionner | `Ctrl + A` | `⌘ + A` |
| Dupliquer la sélection | `Ctrl + D` | `⌘ + D` |
| Sauvegarder dans un fichier | `Ctrl + S` | `⌘ + S` |
| Zoom avant/arrière | `Ctrl + +/-` | `⌘ + +/-` |
| Créer une nouvelle table | Double-clic sur le canvas | Double-clic sur le canvas |

## Types abstraits & dialectes SQL

Tabloid utilise un système de **types abstraits** indépendants du SGBD (TEXT, INTEGER, BOOLEAN, UUID, JSON, SERIAL...). Le mapping vers les types natifs se fait automatiquement à l'export selon le dialecte choisi :

| Dialectes supportés |
|---------------------|
| PostgreSQL |
| MySQL |
| SQLite |
| Oracle |
| SQL Server |

## Formats d'export

### SQL (exemple PostgreSQL)

```sql
CREATE TABLE utilisateurs (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    cree_le TIMESTAMP DEFAULT NOW()
);

CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    auteur_id INTEGER NOT NULL REFERENCES utilisateurs(id),
    titre TEXT NOT NULL,
    contenu TEXT
);
```

### JSON (`.tabloid.json`)

Le format de sauvegarde est agnostique du SGBD — les types sont toujours abstraits :

```json
{
  "version": 1,
  "name": "Mon schéma",
  "tables": [
    {
      "id": "t1",
      "name": "utilisateurs",
      "columns": [
        { "id": "t1-c1", "name": "id", "type": "SERIAL", "isPrimaryKey": true },
        { "id": "t1-c2", "name": "email", "type": "TEXT", "isUnique": true, "isNullable": false }
      ]
    }
  ],
  "relations": [
    {
      "sourceTableId": "t2",
      "sourceColumnId": "t2-c2",
      "targetTableId": "t1",
      "targetColumnId": "t1-c1",
      "type": "many-to-one"
    }
  ]
}
}
```

## Développement

```bash
npm run dev          # Serveur de développement
npm run build        # Build de production
npm run preview      # Prévisualiser le build
npm run test         # Tests unitaires
npm run test:e2e     # Tests E2E (Playwright)
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
