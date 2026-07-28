import { describe, expect, it } from 'vitest';
import { ALL_TYPES, migrateState } from './storage';

describe('migrazione dati V1', () => {
  it('preserva impianti, tecnico e storico associando una campagna legacy', () => {
    const old = {
      version: 1,
      plants: [{ id: 'p1', description: 'Impianto' }],
      interventions: [{ id: 'i1', plantId: 'p1', type: 'manutenzione', date: '2026-01-01' }],
      selectedTechnician: 'Paolo'
    };
    const migrated = migrateState(old);
    expect(migrated.version).toBe(2);
    expect(migrated.plants).toEqual(old.plants);
    expect(migrated.selectedTechnician).toBe('Paolo');
    expect(migrated.interventions[0].campaignId).toBe('legacy');
    expect(migrated.activeCampaignByType.manutenzione).toBe('legacy');
  });

  it('completa le categorie mancanti senza alterare quelle presenti', () => {
    const migrated = migrateState({
      plants: [], interventions: [], campaigns: [{ id: 'c1', name: '2027' }],
      activeCampaignByType: { manutenzione: 'c1' }
    });
    expect(migrated.activeCampaignByType.manutenzione).toBe('c1');
    expect(Object.keys(migrated.activeCampaignByType)).toEqual(expect.arrayContaining(ALL_TYPES));
  });
});
