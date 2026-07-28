import { beforeEach, describe, expect, it } from 'vitest';
import { isAdminSession, loginAdmin, logoutAdmin } from './admin';

const memory = new Map();
globalThis.sessionStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key)
};

describe('accesso amministratore locale', () => {
  beforeEach(() => { memory.clear(); logoutAdmin(); });

  it('accetta le credenziali configurate senza conservarne la password', async () => {
    expect(await loginAdmin('Luchino', 'cfsimpianti')).toBe(true);
    expect(isAdminSession()).toBe(true);
  });

  it('rifiuta credenziali errate', async () => {
    expect(await loginAdmin('Luchino', 'errata')).toBe(false);
    expect(isAdminSession()).toBe(false);
  });
});
