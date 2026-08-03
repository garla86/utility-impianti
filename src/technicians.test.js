import { describe, expect, it } from 'vitest';
import { sameTechnician, uniqueTechnicians } from './technicians';

describe('normalizzazione tecnici', () => {
  it('unisce varianti maiuscole e minuscole preferendo il nome del profilo', () => {
    expect(uniqueTechnicians(['ARCOLIN PAOLO', 'ENMANUEL MUNOZ'], ['Arcolin Paolo', 'Enmanuel Munoz']))
      .toEqual(['Arcolin Paolo', 'Enmanuel Munoz']);
  });

  it('confronta i tecnici senza distinguere maiuscole e spazi esterni', () => {
    expect(sameTechnician(' ARCOLIN PAOLO ', 'Arcolin Paolo')).toBe(true);
  });
});
