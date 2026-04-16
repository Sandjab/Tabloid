import yaml from 'js-yaml';
import type { Table, Relation, DialectId } from '@/types/schema';
import { buildSchema } from './export-json';

export function exportYAML(
  tables: Table[],
  relations: Relation[],
  name: string,
  dialect: DialectId = 'generic',
): string {
  return yaml.dump(buildSchema(tables, relations, name, dialect), { lineWidth: 120, noRefs: true });
}
