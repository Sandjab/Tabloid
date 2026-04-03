import yaml from 'js-yaml';
import type { Table, Relation } from '@/types/schema';
import { buildSchema } from './export-json';

export function exportYAML(
  tables: Table[],
  relations: Relation[],
  name: string,
): string {
  return yaml.dump(buildSchema(tables, relations, name), { lineWidth: 120, noRefs: true });
}
