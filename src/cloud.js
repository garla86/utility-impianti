import { supabase } from './supabase';
import { migrateState } from './storage';

const value = (item) => item === '' ? null : item;
const consumptionId = (plantId, seasonId) => `${plantId}:${seasonId || 'legacy'}`;

export async function loadProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function loadCloudState(selectedTechnician = 'Tutti') {
  const [plants, interventions, seasons, consumptions, config] = await Promise.all([
    supabase.from('plants').select('*').order('description'),
    supabase.from('interventions').select('*').order('performed_at', { ascending: false }),
    supabase.from('seasons').select('*').order('started_at', { ascending: false }),
    supabase.from('consumptions').select('*, energy_meters(*)'),
    supabase.from('app_config').select('*')
  ]);
  for (const result of [plants, interventions, seasons, consumptions, config]) if (result.error) throw result.error;
  const settings = Object.fromEntries(config.data.map((item) => [item.key, item.value]));
  return migrateState({
    version: 4,
    selectedTechnician,
    plants: plants.data.map((item) => ({
      id: item.id, description: item.description, comune: item.comune, via: item.via, cap: item.cap,
      amministratore: item.amministratore, tecnicoResponsabile: item.technician_name,
      assignedTo: item.assigned_to, active: item.active, createdAt: item.created_at
    })),
    interventions: interventions.data.map((item) => ({
      id: item.id, plantId: item.plant_id, type: item.type, date: item.performed_at,
      campaignId: item.season_id, performedBy: item.performed_by
    })),
    campaigns: seasons.data.map((item) => ({
      id: item.id, name: item.name, categories: item.categories, startedAt: item.started_at, closedAt: item.closed_at
    })),
    activeCampaignByType: settings.active_campaign_by_type || {},
    activeConsumptionCampaignId: settings.active_consumption_campaign || null,
    consumptions: consumptions.data.map((item) => ({
      id: consumptionId(item.plant_id, item.season_id), cloudId: item.id, plantId: item.plant_id,
      campaignId: item.season_id, gasStart: item.gas_start ?? '', gasEnd: item.gas_end ?? '',
      updatedAt: item.updated_at, energyMeters: (item.energy_meters || []).sort((a, b) => a.sort_order - b.sort_order).map((meter) => ({
        id: meter.id, zone: meter.zone, start: meter.start_value ?? '', end: meter.end_value ?? ''
      }))
    }))
  });
}

export function subscribeToCloud(onChange) {
  let timer;
  const channel = supabase.channel('utility-impianti-data')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => {
      clearTimeout(timer); timer = setTimeout(onChange, 250);
    }).subscribe();
  return () => { clearTimeout(timer); supabase.removeChannel(channel); };
}

export async function cloudRecordIntervention(plant, type, seasonId, userId) {
  const { data, error } = await supabase.from('interventions').insert({
    plant_id: plant.id, type, season_id: seasonId || null, performed_by: userId
  }).select().single();
  if (error) throw error;
  return { id: data.id, plantId: data.plant_id, type: data.type, date: data.performed_at, campaignId: data.season_id, performedBy: data.performed_by };
}

export async function cloudSavePlant(plant, profiles) {
  const assigned = profiles.find((item) => item.technician_name === plant.tecnicoResponsabile);
  const row = {
    id: plant.id, description: plant.description, comune: plant.comune || '', via: plant.via || '',
    cap: plant.cap || '', amministratore: plant.amministratore || '', technician_name: plant.tecnicoResponsabile,
    assigned_to: assigned?.id || null, active: plant.active !== false, updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from('plants').upsert(row).select().single();
  if (error) throw error;
  return { ...plant, id: data.id, assignedTo: data.assigned_to, createdAt: data.created_at };
}

export async function cloudImportPlants(plants, profiles) {
  const rows = plants.map((plant) => ({
    id: plant.id, description: plant.description, comune: plant.comune || '', via: plant.via || '', cap: plant.cap || '',
    amministratore: plant.amministratore || '', technician_name: plant.tecnicoResponsabile || 'Non assegnato',
    assigned_to: profiles.find((item) => item.technician_name === plant.tecnicoResponsabile)?.id || null,
    active: plant.active !== false, created_at: plant.createdAt || new Date().toISOString(), updated_at: new Date().toISOString()
  }));
  for (let index = 0; index < rows.length; index += 250) {
    const result = await supabase.from('plants').upsert(rows.slice(index, index + 250));
    if (result.error) throw result.error;
  }
}

export async function cloudDeleteIntervention(id) {
  const { error } = await supabase.from('interventions').delete().eq('id', id);
  if (error) throw error;
}

export async function cloudSaveConsumption(plantId, seasonId, values, userId, existingCloudId) {
  const row = { plant_id: plantId, season_id: seasonId || null, gas_start: value(values.gasStart), gas_end: value(values.gasEnd), updated_by: userId, updated_at: new Date().toISOString() };
  if (existingCloudId) row.id = existingCloudId;
  const { data, error } = await supabase.from('consumptions').upsert(row, { onConflict: 'plant_id,season_id' }).select().single();
  if (error) throw error;
  const removed = await supabase.from('energy_meters').delete().eq('consumption_id', data.id);
  if (removed.error) throw removed.error;
  if (values.energyMeters.length) {
    const inserted = await supabase.from('energy_meters').insert(values.energyMeters.map((meter, index) => ({
      consumption_id: data.id, zone: meter.zone, start_value: value(meter.start), end_value: value(meter.end), sort_order: index
    })));
    if (inserted.error) throw inserted.error;
  }
  return data.id;
}

export async function cloudStartSeason(name, categories, userId, oldSeasonId) {
  if (oldSeasonId) {
    const closed = await supabase.from('seasons').update({ closed_at: new Date().toISOString() }).eq('id', oldSeasonId);
    if (closed.error) throw closed.error;
  }
  const { data, error } = await supabase.from('seasons').insert({ name, categories, created_by: userId }).select().single();
  if (error) throw error;
  const current = (await supabase.from('app_config').select('*').eq('key', 'active_campaign_by_type').single()).data?.value || {};
  const active = { ...current, ...Object.fromEntries(categories.map((category) => [category, data.id])) };
  const updates = await Promise.all([
    supabase.from('app_config').upsert({ key: 'active_campaign_by_type', value: active, updated_at: new Date().toISOString() }),
    supabase.from('app_config').upsert({ key: 'active_consumption_campaign', value: data.id, updated_at: new Date().toISOString() })
  ]);
  for (const result of updates) if (result.error) throw result.error;
  return data;
}

export async function loadProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name');
  if (error) throw error;
  return data;
}

export async function inviteTechnician(details) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch('/api/invite-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
    body: JSON.stringify(details)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Invito non riuscito');
  return result;
}

export async function migrateLocalToCloud(local, userId, profiles = []) {
  const seasons = local.campaigns.map((item) => ({
    id: item.id === 'legacy' ? crypto.randomUUID() : item.id, name: item.name, categories: item.categories || [],
    started_at: item.startedAt || new Date().toISOString(), closed_at: item.closedAt || null, created_by: userId
  }));
  const seasonMap = new Map(local.campaigns.map((item, index) => [item.id, seasons[index].id]));
  if (seasons.length) { const result = await supabase.from('seasons').upsert(seasons); if (result.error) throw result.error; }
  const plants = local.plants.map((item) => ({
    id: item.id, description: item.description, comune: item.comune || '', via: item.via || '', cap: item.cap || '',
    amministratore: item.amministratore || '', technician_name: item.tecnicoResponsabile || 'Non assegnato',
    assigned_to: profiles.find((profile) => profile.technician_name === item.tecnicoResponsabile)?.id || null,
    active: item.active !== false, created_at: item.createdAt || new Date().toISOString()
  }));
  for (let index = 0; index < plants.length; index += 250) {
    const result = await supabase.from('plants').upsert(plants.slice(index, index + 250)); if (result.error) throw result.error;
  }
  const interventions = local.interventions.map((item) => ({
    id: item.id, plant_id: item.plantId, type: item.type, performed_at: item.date,
    season_id: seasonMap.get(item.campaignId) || null, performed_by: userId
  }));
  for (let index = 0; index < interventions.length; index += 250) {
    const result = await supabase.from('interventions').upsert(interventions.slice(index, index + 250)); if (result.error) throw result.error;
  }
  for (const item of local.consumptions || []) {
    const { data, error } = await supabase.from('consumptions').upsert({
      plant_id: item.plantId, season_id: seasonMap.get(item.campaignId) || null,
      gas_start: value(item.gasStart), gas_end: value(item.gasEnd), updated_by: userId,
      updated_at: item.updatedAt || new Date().toISOString()
    }, { onConflict: 'plant_id,season_id' }).select().single();
    if (error) throw error;
    if (item.energyMeters?.length) {
      const meters = await supabase.from('energy_meters').insert(item.energyMeters.map((meter, index) => ({
        consumption_id: data.id, zone: meter.zone || `Contatore ${index + 1}`,
        start_value: value(meter.start), end_value: value(meter.end), sort_order: index
      })));
      if (meters.error) throw meters.error;
    }
  }
  const activeTypes = Object.fromEntries(Object.entries(local.activeCampaignByType).map(([key, id]) => [key, seasonMap.get(id) || null]));
  await supabase.from('app_config').upsert([
    { key: 'active_campaign_by_type', value: activeTypes },
    { key: 'active_consumption_campaign', value: seasonMap.get(local.activeConsumptionCampaignId) || seasons[0]?.id || null }
  ]);
}
