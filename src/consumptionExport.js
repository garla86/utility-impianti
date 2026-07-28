import * as XLSX from 'xlsx';

const numberOrBlank = (value) => value === '' || value == null ? '' : Number(value);
const difference = (end, start) => end !== '' && end != null && start !== '' && start != null ? Number(end) - Number(start) : '';

export function downloadConsumptions(state) {
  const campaignId = state.activeConsumptionCampaignId;
  const campaign = state.campaigns.find((item) => item.id === campaignId);
  const plants = state.plants.filter((plant) =>
    plant.active && (state.selectedTechnician === 'Tutti' || plant.tecnicoResponsabile === state.selectedTechnician)
  );
  const records = new Map(state.consumptions.filter((item) => item.campaignId === campaignId).map((item) => [item.plantId, item]));
  const summary = plants.map((plant) => {
    const record = records.get(plant.id) || {};
    const meters = record.energyMeters || [];
    return {
      Impianto: plant.description,
      Tecnico: plant.tecnicoResponsabile,
      Comune: plant.comune,
      Indirizzo: plant.via,
      Stagione: campaign?.name || 'Dati precedenti',
      'Gas inizio (m?)': numberOrBlank(record.gasStart),
      'Gas fine (m?)': numberOrBlank(record.gasEnd),
      'Gas consumato (m?)': difference(record.gasEnd, record.gasStart),
      'Contatori energia': meters.length,
      'Energia consumata totale (MWh)': meters.reduce((total, meter) => {
        const amount = difference(meter.end, meter.start);
        return amount === '' ? total : total + amount;
      }, 0)
    };
  });
  const details = plants.flatMap((plant) => {
    const record = records.get(plant.id);
    return (record?.energyMeters || []).map((meter, index) => ({
      Impianto: plant.description,
      Tecnico: plant.tecnicoResponsabile,
      Comune: plant.comune,
      Stagione: campaign?.name || 'Dati precedenti',
      Zona: meter.zone || `Contatore ${index + 1}`,
      'Energia inizio (MWh)': numberOrBlank(meter.start),
      'Energia fine (MWh)': numberOrBlank(meter.end),
      'Energia consumata (MWh)': difference(meter.end, meter.start)
    }));
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), 'Riepilogo consumi');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(details.length ? details : [{ Nota: 'Nessun contatore energia registrato' }]), 'Dettaglio contatori');
  const safeName = (campaign?.name || 'consumi').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  XLSX.writeFile(workbook, `utility-impianti-consumi-${safeName || 'stagione'}.xlsx`);
}
