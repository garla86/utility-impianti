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
    expect(migrated.version).toBe(3);
    expect(migrated.plants).toEqual(old.plants);
    expect(migrated.selectedTechnician).toBe('Paolo');
    expect(migrated.interventions[0].campaignId).toBe('legacy');
    expect(migrated.activeCampaignByType.manutenzione).toBe('legacy');
    expect(migrated.consumptions).toEqual([]);
    expect(migrated.activeConsumptionCampaignId).toBe('legacy');
  });

  it('completa le categorie mancanti senza alterare quelle presenti', () => {
    const migrated = migrateState({
      plants: [], interventions: [], campaigns: [{ id: 'c1', name: '2027' }],
      activeCampaignByType: { manutenzione: 'c1' }
    });
    expect(migrated.activeCampaignByType.manutenzione).toBe('c1');
    expect(Object.keys(migrated.activeCampaignByType)).toEqual(expect.arrayContaining(ALL_TYPES));
  });

  it('converte la vecchia lettura energia in un contatore nominato', () => {
    const migrated = migrateState({
      plants: [], interventions: [], consumptions: [{
        id: 'p1:legacy', plantId: 'p1', campaignId: 'legacy', energyStart: 10, energyEnd: 15
      }]
    });
    expect(migrated.consumptions[0].energyMeters).toEqual([expect.objectContaining({
      zone: 'Contatore 1', start: 10, end: 15
    })]);
  });

  it('allinea i dati cloud senza stagione alla campagna legacy', () => {
    const migrated = migrateState({
      version: 4,
      plants: [{ id: 'p1', description: 'Impianto' }],
      interventions: [{ id: 'i1', plantId: 'p1', type: 'accensione', campaignId: null }],
      consumptions: [{ id: 'c1', plantId: 'p1', campaignId: null, energyMeters: [] }],
      campaigns: [],
      activeCampaignByType: { accensione: null },
      activeConsumptionCampaignId: null
    });
    expect(migrated.activeCampaignByType.accensione).toBe('legacy');
    expect(migrated.interventions[0].campaignId).toBe('legacy');
    expect(migrated.activeConsumptionCampaignId).toBe('legacy');
    expect(migrated.consumptions[0].campaignId).toBe('legacy');
  });
});
