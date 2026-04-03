# CLAUDE.md — Tabloid

## Qu’est-ce que Tabloid ?

Tabloid est un outil visuel de conception de schémas de bases de données relationnelles.
Il tourne 100% côté client (React + TypeScript), déployé en static sur GitHub Pages.

## Stack

- React 18+ / TypeScript (strict) / Vite
- React Flow (`@xyflow/react`) pour le canvas
- Zustand pour le state
- Tailwind CSS pour le styling
- Vitest pour les tests

## Commandes

```bash
npm run dev          # Serveur de dev (Vite)
npm run build        # Build production
npm run preview      # Preview du build
npm run test         # Tests (Vitest)
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
```

## Conventions de code

### TypeScript

- `strict: true` — pas de `any`, jamais
- Tous les types métier dans `src/types/schema.ts`
- Utiliser des `interface` pour les objets, `type` pour les unions/intersections
- Préfixer les types de props par le nom du composant : `TableNodeProps`, `ToolbarProps`

### Composants React

- Fonctionnels uniquement (pas de classes)
- Un composant par fichier, nommé comme le fichier : `TableNode.tsx` → `export default function TableNode()`
- Hooks custom dans `src/hooks/`, préfixés `use` : `useAutoLayout.ts`
- Pas de `useEffect` pour de la logique synchrone — préférer `useMemo` ou des dérivations Zustand

### State (Zustand)

- Un store principal : `src/store/useSchemaStore.ts`
- Actions nommées en verbes : `addTable`, `removeColumn`, `updateRelation`
- Le store contient la source de vérité ; les composants ne maintiennent pas de state dupliqué
- Pour l’undo/redo, utiliser le middleware `temporal` de Zustand

### Styling (Tailwind)

- Pas de CSS custom sauf nécessité absolue (animations React Flow, etc.)
- Utiliser les classes utilitaires Tailwind directement dans le JSX
- Thème clair/sombre via la classe `dark` sur `<html>` et les variantes `dark:`

### Nommage

- Fichiers composants : PascalCase (`TableNode.tsx`)
- Fichiers utils/hooks : camelCase (`export-sql.ts`, `useAutoLayout.ts`)
- Variables et fonctions : camelCase
- Types et interfaces : PascalCase
- Constantes globales : UPPER_SNAKE_CASE

### Tests

- Colocalisés dans `tests/` à la racine, miroir de `src/`
- Nommage : `export-sql.test.ts`
- Tester en priorité : les utils d’export (SQL, JSON), le store Zustand, l’auto-layout
- Pas besoin de tester le rendu React Flow (trop couplé au DOM)

## Architecture clé

```
src/
  types/schema.ts      ← Types : Table, Column, Relation, ColumnType, etc.
  store/useSchemaStore  ← Source de vérité unique
  components/Canvas/    ← Wrapper React Flow
  components/TableNode/ ← Custom node (affichage d'une table)
  components/RelationEdge/ ← Custom edge (lien entre tables)
  utils/export-sql.ts   ← Génération CREATE TABLE
  utils/export-json.ts  ← Sérialisation/désérialisation du schéma
  utils/auto-layout.ts  ← Positionnement automatique (Dagre/ELK)
```

## Modèle de données central

```typescript
interface Table {
  id: string;
  name: string;
  columns: Column[];
  color?: string;
  notes?: string;
  position: { x: number; y: number };
}

interface Column {
  id: string;
  name: string;
  type: ColumnType;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue?: string;
}

interface Relation {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}
```

## Pièges connus

- **React Flow** : les custom nodes doivent être mémoïsés (`React.memo`) sinon le canvas lag avec beaucoup de nœuds
- **React Flow** : ne pas recréer le `nodeTypes` / `edgeTypes` object à chaque render — le déclarer hors du composant ou dans un `useMemo`
- **Zustand** : utiliser des sélecteurs granulaires (`useSchemaStore(s => s.tables)`) pour éviter les re-renders inutiles
- **Vite + GitHub Pages** : configurer `base: '/tabloid/'` dans `vite.config.ts`
- **localStorage** : les schémas volumineux (100+ tables) peuvent approcher la limite de 5 Mo — prévoir un fallback fichier

## Déploiement

GitHub Pages via GitHub Actions. Le workflow est dans `.github/workflows/deploy.yml`.
Le build doit passer `npm run type-check && npm run build` sans erreur.
