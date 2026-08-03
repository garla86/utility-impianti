export const technicianKey = (name) => (name || '').trim().toLocaleLowerCase('it');

export function uniqueTechnicians(plantNames, profileNames) {
  const names = new Map();
  for (const name of plantNames) if (technicianKey(name)) names.set(technicianKey(name), name.trim());
  // La grafia configurata nell'account ha la precedenza su quella importata dall'Excel.
  for (const name of profileNames) if (technicianKey(name)) names.set(technicianKey(name), name.trim());
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
}

export const sameTechnician = (left, right) => technicianKey(left) === technicianKey(right);
