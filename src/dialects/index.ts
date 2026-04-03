export type { Dialect } from './types';
export { postgresql } from './postgresql';
export { mysql } from './mysql';
export { sqlite } from './sqlite';
export { oracle } from './oracle';
export { sqlserver } from './sqlserver';

import type { Dialect } from './types';
import { postgresql } from './postgresql';
import { mysql } from './mysql';
import { sqlite } from './sqlite';
import { oracle } from './oracle';
import { sqlserver } from './sqlserver';

export const DIALECTS: Record<string, Dialect> = {
  postgresql,
  mysql,
  sqlite,
  oracle,
  sqlserver,
};

export const DIALECT_NAMES = Object.keys(DIALECTS);
