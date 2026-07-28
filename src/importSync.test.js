import { describe, expect, it, vi } from 'vitest';
import { planPlantImport } from './importSync';

vi.stubGlobal('crypto', { randomUUID: () => 'new-id' });

const existing = {
  id: 'old-id',
  description: 'Scuola Verdi',
  comune: 'Pavia',
  via: 'Via Roma 1',
  cap: '27100',
  amministratore: 'Comune',
  tecnicoResponsabile: 'ARCOLIN PAOLO',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z'
};

describe('planPlantImport', () => {
  it('preserva id e storico quando cambia il tecnico', () => {
    const plan = planPlantImport(
      [{ ...existing, id: 'excel-id', tecnicoResponsabile: 'BIANCHI LUCA' }],
      [existing],
      [{ technician_name: 'BIANCHI LUCA' }]
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]).toMatchObject({ id: 'old-id', tecnicoResponsabile: 'BIANCHI LUCA' });
    expect(plan.additions).toHaveLength(0);
  });

  it('aggiunge soltanto gli impianti realmente nuovi', () => {
    const plan = planPlantImport(
      [{ ...existing, description: 'Municipio', via: 'Piazza Italia 1' }],
      [existing],
      []
    );
    expect(plan.additions).toHaveLength(1);
    expect(plan.additions[0].id).toBe('new-id');
  });

  it('ignora righe duplicate e non elimina gli impianti assenti', () => {
    const imported = [{ ...existing }, { ...existing }];
    const other = { ...existing, id: 'other-id', description: 'Palestra' };
    const plan = planPlantImport(imported, [existing, other], [{ technician_name: 'ARCOLIN PAOLO' }]);
    expect(plan.unchanged).toHaveLength(1);
    expect(plan.duplicates).toHaveLength(1);
    expect(plan.rows).toHaveLength(0);
  });

  it('segnala tecnici senza account associato', () => {
    const plan = planPlantImport(
      [{ ...existing, tecnicoResponsabile: 'NUOVO TECNICO' }],
      [existing],
      [{ technician_name: 'ARCOLIN PAOLO' }]
    );
    expect(plan.unassignedTechnicians).toEqual(['NUOVO TECNICO']);
  });
});
