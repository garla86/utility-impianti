const text = (value) => String(value ?? '').trim();
const normalise = (value) => text(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\s+/g, ' ');

export const plantImportKey = (plant) => [
  normalise(plant.description),
  normalise(plant.comune),
  normalise(plant.via)
].join('|');

const comparablePlant = (plant) => ({
  description: text(plant.description),
  comune: text(plant.comune),
  via: text(plant.via),
  cap: text(plant.cap),
  amministratore: text(plant.amministratore),
  tecnicoResponsabile: text(plant.tecnicoResponsabile) || 'Non assegnato'
});

const samePlantData = (left, right) => Object.keys(comparablePlant(left))
  .every((key) => normalise(left[key]) === normalise(right[key]));

export function planPlantImport(importedPlants, existingPlants, profiles = []) {
  const existingByKey = new Map();
  for (const plant of existingPlants) {
    const key = plantImportKey(plant);
    if (!existingByKey.has(key)) existingByKey.set(key, []);
    existingByKey.get(key).push(plant);
  }

  const seenImported = new Set();
  const technicianNames = new Set(profiles.map((profile) => normalise(profile.technician_name)).filter(Boolean));
  const additions = [];
  const updates = [];
  const unchanged = [];
  const duplicates = [];
  const conflicts = [];
  const unassignedTechnicians = new Set();

  for (const imported of importedPlants) {
    const prepared = comparablePlant(imported);
    const key = plantImportKey(prepared);
    if (seenImported.has(key)) {
      duplicates.push(prepared);
      continue;
    }
    seenImported.add(key);

    if (normalise(prepared.tecnicoResponsabile) !== 'non assegnato'
      && !technicianNames.has(normalise(prepared.tecnicoResponsabile))) {
      unassignedTechnicians.add(prepared.tecnicoResponsabile);
    }

    const matches = existingByKey.get(key) || [];
    if (matches.length > 1) {
      conflicts.push(prepared);
      continue;
    }
    if (!matches.length) {
      additions.push({ ...imported, ...prepared, id: crypto.randomUUID(), active: true, createdAt: new Date().toISOString() });
      continue;
    }

    const current = matches[0];
    const merged = {
      ...current,
      ...prepared,
      id: current.id,
      active: current.active !== false,
      createdAt: current.createdAt
    };
    if (samePlantData(current, merged)) unchanged.push(merged);
    else updates.push(merged);
  }

  return {
    rows: [...updates, ...additions],
    additions,
    updates,
    unchanged,
    duplicates,
    conflicts,
    unassignedTechnicians: [...unassignedTechnicians].sort((a, b) => a.localeCompare(b))
  };
}

export function importPlanMessage(plan) {
  const lines = [
    'Riepilogo sincronizzazione Excel:',
    `• ${plan.updates.length} impianti esistenti da aggiornare`,
    `• ${plan.additions.length} nuovi impianti da aggiungere`,
    `• ${plan.unchanged.length} impianti già aggiornati`,
    '• gli impianti assenti dall’Excel resteranno invariati'
  ];
  if (plan.duplicates.length) lines.push(`• ${plan.duplicates.length} righe duplicate nell’Excel saranno ignorate`);
  if (plan.conflicts.length) lines.push(`• ${plan.conflicts.length} impianti ambigui saranno ignorati per sicurezza`);
  if (plan.unassignedTechnicians.length) {
    lines.push('', `Tecnici senza account associato: ${plan.unassignedTechnicians.join(', ')}`);
    lines.push('I relativi impianti saranno aggiornati, ma resteranno in sola consultazione finché non verrà creato l’account.');
  }
  lines.push('', 'Procedere con la sincronizzazione?');
  return lines.join('\n');
}
