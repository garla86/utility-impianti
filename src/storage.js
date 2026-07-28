const KEY = 'utility-impianti-v1';
export const ALL_TYPES = ['manutenzione', 'verifica', 'prova-fumi', 'preaccensione', 'accensione', 'spegnimento'];
const initialCampaign = () => ({
  id: 'legacy',
  name: 'Dati precedenti',
  startedAt: new Date().toISOString(),
  categories: [...ALL_TYPES]
});
export const emptyState = {
  version: 3, plants: [], interventions: [], consumptions: [], selectedTechnician: 'Tutti',
  campaigns: [initialCampaign()], activeCampaignByType: Object.fromEntries(ALL_TYPES.map((type) => [type, 'legacy'])),
  activeConsumptionCampaignId: 'legacy',
  preferences: { view: 'cards' }
};

export function migrateState(saved) {
  if (!saved || !Array.isArray(saved.plants) || !Array.isArray(saved.interventions)) return emptyState;
  const campaigns = Array.isArray(saved.campaigns) && saved.campaigns.length ? saved.campaigns : [initialCampaign()];
  const activeCampaignByType = { ...emptyState.activeCampaignByType, ...(saved.activeCampaignByType || {}) };
  const interventions = saved.interventions.map((item) => ({
    ...item,
    campaignId: item.campaignId || activeCampaignByType[item.type] || 'legacy'
  }));
  return {
    ...emptyState, ...saved, version: 3, campaigns, activeCampaignByType, interventions,
    consumptions: Array.isArray(saved.consumptions) ? saved.consumptions : [],
    activeConsumptionCampaignId: saved.activeConsumptionCampaignId || 'legacy',
    preferences: { ...emptyState.preferences, ...(saved.preferences || {}) }
  };
}

export function loadState() {
  try { return migrateState(JSON.parse(localStorage.getItem(KEY))); }
  catch { return emptyState; }
}
export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify({ ...state, version: 3, savedAt: new Date().toISOString() }));
}
export function downloadBackup(state) {
  const blob = new Blob([JSON.stringify({ ...state, version: 3, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `utility-impianti-backup-${new Date().toISOString().slice(0, 10)}.json` });
  link.click(); URL.revokeObjectURL(link.href);
}
