import * as XLSX from 'xlsx';

const clean = (value) => String(value ?? '').trim();
const normalise = (value) => clean(value).toLowerCase().replace(/[àá]/g, 'a').replace(/[èé]/g, 'e').replace(/\s+/g, ' ');
const headerFor = (row, names) => Object.keys(row).find((key) => names.includes(normalise(key)));

export async function readPlantsFromExcel(file) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  if (!rows.length) throw new Error('Il file non contiene righe da importare.');
  const first = rows[0];
  const keys = {
    description: headerFor(first, ['descrizione', 'nome impianto', 'impianto']),
    comune: headerFor(first, ['comune', 'citta', 'città']),
    via: headerFor(first, ['via', 'indirizzo']),
    cap: headerFor(first, ['cap']),
    amministratore: headerFor(first, ['amministratore', 'referente']),
    tecnicoResponsabile: headerFor(first, ['tecnico responsabile', 'tecnico di riferimento', 'tecnico'])
  };
  if (!keys.description) throw new Error('Manca la colonna obbligatoria “Descrizione”.');
  return rows.filter((row) => clean(row[keys.description])).map((row) => ({
    id: crypto.randomUUID(), description: clean(row[keys.description]), comune: clean(row[keys.comune]),
    via: clean(row[keys.via]), cap: clean(row[keys.cap]), amministratore: clean(row[keys.amministratore]),
    tecnicoResponsabile: clean(row[keys.tecnicoResponsabile]) || 'Non assegnato', active: true, createdAt: new Date().toISOString()
  }));
}
