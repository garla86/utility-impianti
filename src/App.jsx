import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveRestore, ChevronDown, Download, FileSpreadsheet, Grid2X2, History, Info,
  List, Map, MapPin, Menu, Navigation, Pencil, Plus, RotateCcw, Search, Settings,
  Upload, UserRound, Wrench, X
} from 'lucide-react';
import { readPlantsFromExcel } from './excel';
import { ALL_TYPES, downloadBackup, loadState, migrateState, saveState } from './storage';

const TYPES = [
  ['manutenzione', 'Manutenzione'], ['verifica', 'Verifica'], ['prova-fumi', 'Prova fumi'],
  ['accensione', 'Accensione'], ['spegnimento', 'Spegnimento'], ['altro', 'Altro']
];
const blankPlant = { description: '', comune: '', via: '', cap: '', amministratore: '', tecnicoResponsabile: '', active: true };
const fmt = (date) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
const typeLabel = (id) => TYPES.find(([key]) => key === id)?.[1] || id;
const addressOf = (plant) => [plant.via, plant.cap, plant.comune].filter(Boolean).join(', ');
const mapsUrl = (plant) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressOf(plant) || plant.description)}`;

export default function App() {
  const [state, setState] = useState(loadState);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);
  const [historyPlant, setHistoryPlant] = useState(null);
  const [panel, setPanel] = useState(null);
  const [notice, setNotice] = useState('');
  const excelInput = useRef(); const backupInput = useRef();
  useEffect(() => saveState(state), [state]);

  const technicians = useMemo(() => [...new Set(state.plants.map((p) => p.tecnicoResponsabile).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [state.plants]);
  const isDone = (plantId, interventionType) => state.interventions.some((item) =>
    item.plantId === plantId && item.type === interventionType &&
    item.campaignId === state.activeCampaignByType[interventionType]
  );
  const visible = useMemo(() => state.plants.filter((plant) => {
    const matchesTech = state.selectedTechnician === 'Tutti' || plant.tecnicoResponsabile === state.selectedTechnician;
    const q = query.toLowerCase();
    const matchesQuery = !q || [plant.description, plant.comune, plant.via, plant.cap, plant.amministratore].some((value) => value?.toLowerCase().includes(q));
    const done = type !== 'all' && isDone(plant.id, type);
    return plant.active && matchesTech && matchesQuery && (type === 'all' || status === 'all' || (status === 'done' ? done : !done));
  }), [state, query, type, status]);
  const progressPool = state.plants.filter((plant) => plant.active && (state.selectedTechnician === 'Tutti' || plant.tecnicoResponsabile === state.selectedTechnician));
  const completed = type === 'all' ? 0 : progressPool.filter((plant) => isDone(plant.id, type)).length;
  const flash = (text) => { setNotice(text); window.setTimeout(() => setNotice(''), 2800); };
  const record = (plant, interventionType) => {
    const intervention = {
      id: crypto.randomUUID(), plantId: plant.id, type: interventionType, date: new Date().toISOString(),
      campaignId: state.activeCampaignByType[interventionType]
    };
    setState((current) => ({ ...current, interventions: [intervention, ...current.interventions] }));
    flash(`${typeLabel(interventionType)} registrata.`);
  };
  const savePlant = (plant) => {
    const prepared = { ...plant, id: plant.id || crypto.randomUUID(), active: plant.active !== false, createdAt: plant.createdAt || new Date().toISOString() };
    setState((current) => ({ ...current, plants: current.plants.some((item) => item.id === prepared.id) ? current.plants.map((item) => item.id === prepared.id ? prepared : item) : [prepared, ...current.plants] }));
    setEditing(null); flash('Impianto salvato.');
  };
  const importExcel = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const plants = await readPlantsFromExcel(file);
      if (!window.confirm(`Importare ${plants.length} impianti? L?elenco attuale verr? sostituito. Prima ? consigliato esportare un backup.`)) return;
      setState((current) => ({ ...current, plants })); flash(`${plants.length} impianti importati.`);
    } catch (error) { alert(error.message); } finally { event.target.value = ''; }
  };
  const importBackup = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const migrated = migrateState(data);
      if (!Array.isArray(data.plants) || !Array.isArray(data.interventions)) throw new Error();
      if (window.confirm('Ripristinare questo backup? I dati presenti saranno sostituiti.')) {
        setState(migrated); setPanel(null); flash('Backup ripristinato e aggiornato.');
      }
    } catch { alert('Questo file non ? un backup valido di Utility Impianti.'); } finally { event.target.value = ''; }
  };
  const startSeason = (name, categories) => {
    const id = crypto.randomUUID();
    const campaign = { id, name: name.trim(), startedAt: new Date().toISOString(), categories };
    setState((current) => ({
      ...current, campaigns: [campaign, ...current.campaigns],
      activeCampaignByType: { ...current.activeCampaignByType, ...Object.fromEntries(categories.map((category) => [category, id])) }
    }));
    setPanel(null); flash(`Nuova stagione avviata per ${categories.length} categorie.`);
  };
  const setView = (view) => setState((current) => ({ ...current, preferences: { ...current.preferences, view } }));

  return <main className="app-shell">
    <header className="topbar">
      <div><p className="eyebrow"><Wrench size={15}/> Gestione interventi</p><h1>Utility Impianti</h1></div>
      <button className="icon-button" aria-label="Apri impostazioni" onClick={() => setPanel('settings')}><Menu size={22}/></button>
    </header>
    <section className="controls">
      <label className="select-wrap">Tecnico <select value={state.selectedTechnician} onChange={(e) => setState((current) => ({ ...current, selectedTechnician: e.target.value }))}><option>Tutti</option>{technicians.map((tech) => <option key={tech}>{tech}</option>)}</select><ChevronDown size={18}/></label>
      <label className="search"><Search size={19}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca nome, via, comune?" />{query && <button onClick={() => setQuery('')} aria-label="Cancella ricerca"><X size={17}/></button>}</label>
    </section>
    <section className="filters">
      <div className="chips">{[['all', 'Tutti'], ...TYPES].map(([id, label]) => <button className={type === id ? 'chip active' : 'chip'} key={id} onClick={() => { setType(id); if (id === 'all') setStatus('all'); }}>{label}</button>)}</div>
      {type !== 'all' && <div className="status-tabs"><button className={status === 'all' ? 'selected' : ''} onClick={() => setStatus('all')}>Tutti</button><button className={status === 'todo' ? 'selected' : ''} onClick={() => setStatus('todo')}>Da fare</button><button className={status === 'done' ? 'selected' : ''} onClick={() => setStatus('done')}>Completati</button></div>}
    </section>
    {type !== 'all' && <section className="progress"><div><strong>{typeLabel(type)}</strong><span>{completed} di {progressPool.length} completati</span></div><div className="bar"><i style={{ width: `${progressPool.length ? completed / progressPool.length * 100 : 0}%` }} /></div></section>}
    <section className="list-head">
      <span>{visible.length} impianti</span>
      <div className="list-tools"><button title="Vista schede" className={state.preferences.view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}><Grid2X2 size={17}/></button><button title="Vista elenco" className={state.preferences.view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={18}/></button><button title="Vista mappa" onClick={() => setPanel('map')}><Map size={18}/></button><button className="add" onClick={() => setEditing(blankPlant)}><Plus size={18}/> Nuovo</button></div>
    </section>
    <section className={state.preferences.view === 'list' ? 'plant-list compact' : 'plant-list'}>
      {visible.map((plant) => state.preferences.view === 'list'
        ? <PlantRow key={plant.id} plant={plant} onEdit={() => setEditing(plant)} onHistory={() => setHistoryPlant(plant)}/>
        : <PlantCard key={plant.id} plant={plant} interventions={state.interventions.filter((item) => item.plantId === plant.id && item.campaignId === state.activeCampaignByType[item.type])} onRecord={record} onEdit={() => setEditing(plant)} onHistory={() => setHistoryPlant(plant)}/>)}
      {!visible.length && <div className="empty"><FileSpreadsheet size={35}/><h2>Nessun impianto trovato</h2><p>Importa il tuo Excel o modifica i filtri.</p></div>}
    </section>
    <input ref={excelInput} type="file" accept=".xlsx,.xls,.csv" hidden onChange={importExcel}/>
    <input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={importBackup}/>
    {notice && <div className="toast">{notice}</div>}
    {editing && <PlantEditor plant={editing} technicians={technicians} onClose={() => setEditing(null)} onSave={savePlant}/>}
    {historyPlant && <HistoryModal plant={historyPlant} interventions={state.interventions.filter((item) => item.plantId === historyPlant.id)} campaigns={state.campaigns} onClose={() => setHistoryPlant(null)} onDelete={(id) => setState((current) => ({ ...current, interventions: current.interventions.filter((item) => item.id !== id) }))}/>}
    {panel === 'settings' && <SettingsModal state={state} technicians={technicians} onClose={() => setPanel(null)} onTechnician={(value) => setState((current) => ({ ...current, selectedTechnician: value }))} onExcel={() => excelInput.current.click()} onExport={() => downloadBackup(state)} onRestore={() => backupInput.current.click()} onSeason={() => setPanel('season')} onMap={() => setPanel('map')}/>}
    {panel === 'season' && <SeasonModal onClose={() => setPanel('settings')} onStart={startSeason}/>}
    {panel === 'map' && <MapModal plants={visible} technician={state.selectedTechnician} type={type} status={status} onClose={() => setPanel(null)}/>}
  </main>;
}

function PlantCard({ plant, interventions, onRecord, onEdit, onHistory }) {
  const done = (id) => interventions.find((item) => item.type === id);
  return <article className="plant-card"><PlantHeading plant={plant} onEdit={onEdit} onHistory={onHistory}/><div className="interventions">{TYPES.map(([id, label]) => <button key={id} className={done(id) ? 'intervention done' : 'intervention'} onClick={() => onRecord(plant, id)} title={done(id) ? `Ultima registrazione: ${fmt(done(id).date)}` : `Registra ${label}`}><span>{done(id) ? '?' : '+'}</span>{label}</button>)}</div></article>;
}
function PlantRow({ plant, onEdit, onHistory }) {
  return <article className="plant-row"><a href={mapsUrl(plant)} target="_blank" rel="noreferrer"><h2>{plant.description}</h2><p><MapPin size={14}/>{addressOf(plant) || 'Indirizzo non indicato'}</p><small>{plant.tecnicoResponsabile}</small></a><div className="card-actions"><button onClick={onEdit} aria-label="Modifica"><Pencil size={16}/></button><button onClick={onHistory} aria-label="Storico"><History size={17}/></button></div></article>;
}
function PlantHeading({ plant, onEdit, onHistory }) {
  return <div className="plant-title"><div><h2>{plant.description}</h2><a href={mapsUrl(plant)} target="_blank" rel="noreferrer"><MapPin size={15}/>{addressOf(plant) || 'Indirizzo non indicato'}</a><small>{plant.tecnicoResponsabile}</small></div><div className="card-actions"><button aria-label="Modifica impianto" onClick={onEdit}><Pencil size={17}/></button><button aria-label="Vedi storico" onClick={onHistory}><History size={18}/></button></div></div>;
}
function SettingsModal({ state, technicians, onClose, onTechnician, onExcel, onExport, onRestore, onSeason, onMap }) {
  return <Modal title="Impostazioni" onClose={onClose}><div className="settings-list">
    <label className="settings-select"><UserRound/><span><strong>Tecnico</strong><small>Impianti visualizzati</small></span><select value={state.selectedTechnician} onChange={(e) => onTechnician(e.target.value)}><option>Tutti</option>{technicians.map((tech) => <option key={tech}>{tech}</option>)}</select></label>
    <SettingButton icon={<Upload/>} title="Importa Excel" note="Aggiorna l?elenco impianti" onClick={onExcel}/>
    <SettingButton icon={<Download/>} title="Esporta backup" note="Salva impianti, storico e stagioni" onClick={onExport}/>
    <SettingButton icon={<ArchiveRestore/>} title="Ripristina backup" note="Compatibile anche con i backup V1" onClick={onRestore}/>
    <SettingButton icon={<RotateCcw/>} title="Nuova stagione" note="Azzera i contatori scelti, conserva lo storico" onClick={onSeason}/>
    <SettingButton icon={<Map/>} title="Mappa impianti" note="Usa i filtri attualmente selezionati" onClick={onMap}/>
    <div className="app-info"><Info/><div><strong>Utility Impianti</strong><small>Versione 1.1 ? dati salvati sul dispositivo</small></div></div>
  </div></Modal>;
}
function SettingButton({ icon, title, note, onClick }) { return <button className="setting-button" onClick={onClick}>{icon}<span><strong>{title}</strong><small>{note}</small></span><span>?</span></button>; }
function SeasonModal({ onClose, onStart }) {
  const [name, setName] = useState(`Stagione ${new Date().getFullYear() + 1}`);
  const [selected, setSelected] = useState([...ALL_TYPES]);
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <Modal title="Nuova stagione" onClose={onClose}><p className="modal-subtitle">Gli interventi gi? registrati resteranno nello storico. Solo i contatori delle categorie scelte ripartiranno da zero.</p><div className="form"><label>Nome stagione<input value={name} onChange={(e) => setName(e.target.value)}/></label><fieldset><legend>Categorie da riavviare</legend>{TYPES.map(([id, label]) => <label className="check" key={id}><input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)}/>{label}</label>)}</fieldset><div className="modal-actions"><button className="secondary" onClick={onClose}>Annulla</button><button disabled={!name.trim() || !selected.length} onClick={() => { if (window.confirm(`Avviare ?${name}? per ${selected.length} categorie?`)) onStart(name, selected); }}>Avvia stagione</button></div></div></Modal>;
}
function MapModal({ plants, technician, type, status, onClose }) {
  const openAll = () => {
    const addresses = plants.slice(0, 9).map(addressOf).filter(Boolean);
    if (!addresses.length) return;
    const [destination, ...waypoints] = addresses.reverse();
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${waypoints.length ? `&waypoints=${encodeURIComponent(waypoints.join('|'))}` : ''}`, '_blank', 'noopener');
  };
  return <Modal title="Mappa impianti" onClose={onClose}><p className="modal-subtitle">{plants.length} risultati ? {technician}{type !== 'all' ? ` ? ${typeLabel(type)} ${status === 'todo' ? 'da fare' : status === 'done' ? 'completati' : ''}` : ''}</p><button className="route-button" disabled={!plants.length} onClick={openAll}><Navigation size={18}/> Apri itinerario (massimo 9 tappe)</button><div className="map-list">{plants.map((plant) => <a key={plant.id} href={mapsUrl(plant)} target="_blank" rel="noreferrer"><MapPin/><span><strong>{plant.description}</strong><small>{addressOf(plant) || 'Indirizzo non indicato'}</small></span><Navigation size={17}/></a>)}</div></Modal>;
}
function PlantEditor({ plant, technicians, onClose, onSave }) {
  const [draft, setDraft] = useState(plant); const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  return <Modal title={plant.id ? 'Modifica impianto' : 'Nuovo impianto'} onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); onSave(draft); }} className="form"><Field label="Descrizione *" value={draft.description} onChange={(value) => set('description', value)} required/><Field label="Comune" value={draft.comune} onChange={(value) => set('comune', value)}/><Field label="Via / Indirizzo" value={draft.via} onChange={(value) => set('via', value)}/><Field label="CAP" value={draft.cap} onChange={(value) => set('cap', value)}/><Field label="Amministratore" value={draft.amministratore} onChange={(value) => set('amministratore', value)}/><label>Tecnico responsabile<input list="technicians" value={draft.tecnicoResponsabile} onChange={(e) => set('tecnicoResponsabile', e.target.value)} required/><datalist id="technicians">{technicians.map((tech) => <option key={tech} value={tech}/>)}</datalist></label><label className="check"><input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)}/> Impianto attivo</label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Annulla</button><button type="submit">Salva impianto</button></div></form></Modal>;
}
function Field({ label, value, onChange, required }) { return <label>{label}<input value={value || ''} onChange={(e) => onChange(e.target.value)} required={required}/></label>; }
function HistoryModal({ plant, interventions, campaigns, onClose, onDelete }) {
  const campaignName = (id) => campaigns.find((campaign) => campaign.id === id)?.name || 'Dati precedenti';
  return <Modal title={plant.description} onClose={onClose}><p className="modal-subtitle">Storico interventi completo</p><div className="history">{interventions.length ? interventions.map((item) => <div className="history-row" key={item.id}><div><strong>{typeLabel(item.type)}</strong><span>{fmt(item.date)} ? {campaignName(item.campaignId)}</span></div><button onClick={() => { if (window.confirm('Eliminare questa registrazione?')) onDelete(item.id); }} aria-label="Elimina intervento">?</button></div>) : <p>Nessun intervento registrato.</p>}</div></Modal>;
}
function Modal({ title, onClose, children }) { return <div className="overlay" role="dialog" aria-modal="true"><section className="modal"><header><h2>{title}</h2><button onClick={onClose} aria-label="Chiudi"><X/></button></header>{children}</section></div>; }
