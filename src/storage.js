const KEY = 'utility-impianti-v1';

export const emptyState = { version: 1, plants: [], interventions: [], selectedTechnician: 'Tutti' };

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved && Array.isArray(saved.plants) && Array.isArray(saved.interventions)
      ? { ...emptyState, ...saved } : emptyState;
  } catch { return emptyState; }
}

export function saveState(state) { localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: new Date().toISOString() })); }
export function downloadBackup(state) {
  const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `utility-impianti-backup-${new Date().toISOString().slice(0, 10)}.json` });
  link.click(); URL.revokeObjectURL(link.href);
}
