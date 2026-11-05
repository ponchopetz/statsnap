import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const getDbName = require('../utils/dbName');

describe('getDbName', () => {
  it('defaults to statsnap', () => {
    expect(getDbName({})).toBe('statsnap');
  });

  it('uses DB_NAME when set', () => {
    expect(getDbName({ DB_NAME: 'statsnap_preview' })).toBe('statsnap_preview');
  });
});
