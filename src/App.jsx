import { useEffect, useMemo, useRef, useState } from 'react';
import { ArchiveRestore, ChevronDown, Download, FileSpreadsheet, History, MapPin, Pencil, Plus, Search, Upload, Wrench, X } from 'lucide-react';
import { readPlantsFromExcel } from './excel';
import { downloadBackup, loadState, saveState } from './storage';

const TYPES = [
  ['manutenzione', 'Manutenzione'], ['verifica', 'Verifica'], ['prova-fumi', 'Prova fumi'],
  ['accensione', 'Accensione'], ['spegnimento', 'Spegnimento'], ['altro', 'Altro']
];
const blankPlant = { description: '', comune: '', via: '', cap: '', amministratore: '', tecnicoResponsabile: '', active: true };
const fmt = (date) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));

export default function App() {
  const [state, setState] = useState(loadState);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);
  const [historyPlant, setHistoryPlant] = useState(null);
  const [notice, setNotice] = useState('');
  const excelInput = useRef(); const backupInput = useRef();
  useEffect(() => saveState(state), [state]);
  const technicians = useMemo(() => [...new Set(state.plants.map((p) => p.tecnicoResponsabile).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [state.plants]);
  const visible = useMemo(() => state.plants.filter((plant) => {
    const matchesTech = state.selectedTechnician === 'Tutti' || plant.tecnicoResponsabile === state.selectedTechnician;
    const q = query.toLowerCase(); const matchesQuery = !q || [plant.description, plant.comune, plant.via, plant.cap, plant.amministratore].some((v) => v?.toLowerCase().includes(q));
    const done = type !== 'all' && state.interventions.some((i) => i.plantId === plant.id && i.type === type);
    const matchesStatus = type === 'all' || status === 'all' || (status === 'done' ? done : !done);
    return plant.active && matchesTech && matchesQuery && matchesStatus;
  }), [state, query, type, status]);
  const progressPool = state.plants.filter((p) => p.active && (state.selectedTechnician === 'Tutti' || p.tecnicoResponsabile === state.selectedTechnician));
  const completed = type === 'all' ? 0 : progressPool.filter((p) => state.interventions.some((i) => i.plantId === p.id && i.type === type)).length;
  const flash = (text) => { setNotice(text); window.setTimeout(() => setNotice(''), 2800); };
  const record = (plant, interventionType) => {
    const intervention = { id: crypto.randomUUID(), plantId: plant.id, type: interventionType, date: new Date().toISOString() };
    setState((s) => ({ ...s, interventions: [intervention, ...s.interventions] })); flash(`${TYPES.find(([id]) => id === interventionType)[1]} registrata.`);
  };
  const savePlant = (plant) => {
    const prepared = { ...plant, id: plant.id || crypto.randomUUID(), active: plant.active !== false, createdAt: plant.createdAt || new Date().toISOString() };
    setState((s) => ({ ...s, plants: s.plants.some((p) => p.id === prepared.id) ? s.plants.map((p) => p.id === prepared.id ? prepared : p) : [prepared, ...s.plants] })); setEditing(null); flash('Impianto salvato.');
  };
  const importExcel = async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const plants = await readPlantsFromExcel(file); if (!window.confirm(`Importare ${plants.length} impianti? L’elenco attuale verrà sostituito, mentre lo storico rimarrà nel backup.`)) return; setState((s) => ({ ...s, plants })); flash(`${plants.length} impianti importati.`); } catch (error) { alert(error.message); } finally { event.target.value = ''; } };
  const importBackup = async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const data = JSON.parse(await file.text()); if (!Array.isArray(data.plants) || !Array.isArray(data.interventions)) throw new Error(); if (window.confirm('Ripristinare questo backup? I dati presenti sull’app saranno sostituiti.')) { setState({ version: 1, plants: data.plants, interventions: data.interventions, selectedTechnician: data.selectedTechnician || 'Tutti' }); flash('Backup ripristinato.'); } } catch { alert('Questo file non è un backup valido di Utility Impianti.'); } finally { event.target.value = ''; } };
  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow"><Wrench size={15}/> Gestione interventi</p><h1>Utility Impianti</h1></div><button className="icon-button" aria-label="Gestione backup" onClick={() => backupInput.current.click()}><ArchiveRestore size={21}/></button></header>
    <section className="controls"><label className="select-wrap">Tecnico <select value={state.selectedTechnician} onChange={(e) => setState((s) => ({ ...s, selectedTechnician: e.target.value }))}><option>Tutti</option>{technicians.map((t) => <option key={t}>{t}</option>)}</select><ChevronDown size={18}/></label><label className="search"><Search size={19}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca nome, via, comune…" />{query && <button onClick={() => setQuery('')} aria-label="Cancella ricerca"><X size={17}/></button>}</label></section>
    <section className="filters"><div className="chips">{[['all', 'Tutti'], ...TYPES].map(([id, label]) => <button className={type === id ? 'chip active' : 'chip'} key={id} onClick={() => { setType(id); if (id === 'all') setStatus('all'); }}>{label}</button>)}</div>{type !== 'all' && <div className="status-tabs"><button className={status === 'all' ? 'selected' : ''} onClick={() => setStatus('all')}>Tutti</button><button className={status === 'todo' ? 'selected' : ''} onClick={() => setStatus('todo')}>Da fare</button><button className={status === 'done' ? 'selected' : ''} onClick={() => setStatus('done')}>Completati</button></div>}</section>
    {type !== 'all' && <section className="progress"><div><strong>{TYPES.find(([id]) => id === type)[1]}</strong><span>{completed} di {progressPool.length} completati</span></div><div className="bar"><i style={{ width: `${progressPool.length ? completed / progressPool.length * 100 : 0}%` }} /></div></section>}
    <section className="list-head"><span>{visible.length} impianti</span><button className="add" onClick={() => setEditing(blankPlant)}><Plus size={18}/> Nuovo</button></section>
    <section className="plant-list">{visible.map((plant) => <PlantCard key={plant.id} plant={plant} interventions={state.interventions.filter((i) => i.plantId === plant.id)} onRecord={record} onEdit={() => setEditing(plant)} onHistory={() => setHistoryPlant(plant)} />)}{!visible.length && <div className="empty"><FileSpreadsheet size={35}/><h2>Nessun impianto trovato</h2><p>Importa il tuo Excel o modifica i filtri di ricerca.</p></div>}</section>
    <input ref={excelInput} type="file" accept=".xlsx,.xls,.csv" hidden onChange={importExcel}/><input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={importBackup}/>
    <footer><button onClick={() => excelInput.current.click()}><Upload size={17}/> Importa Excel</button><button onClick={() => downloadBackup(state)}><Download size={17}/> Esporta backup</button></footer>
    {notice && <div className="toast">{notice}</div>}{editing && <PlantEditor plant={editing} technicians={technicians} onClose={() => setEditing(null)} onSave={savePlant}/>} {historyPlant && <HistoryModal plant={historyPlant} interventions={state.interventions.filter((i) => i.plantId === historyPlant.id)} onClose={() => setHistoryPlant(null)} onDelete={(id) => setState((s) => ({ ...s, interventions: s.interventions.filter((i) => i.id !== id) }))}/>} 
  </main>;
}

function PlantCard({ plant, interventions, onRecord, onEdit, onHistory }) { const done = (id) => interventions.find((i) => i.type === id); return <article className="plant-card"><div className="plant-title"><div><h2>{plant.description}</h2><p><MapPin size={15}/>{[plant.via, plant.comune, plant.cap].filter(Boolean).join(' · ') || 'Indirizzo non indicato'}</p><small>{plant.tecnicoResponsabile}</small></div><div className="card-actions"><button aria-label="Modifica impianto" onClick={onEdit}><Pencil size={17}/></button><button aria-label="Vedi storico" onClick={onHistory}><History size={18}/></button></div></div><div className="interventions">{TYPES.map(([id, label]) => <button key={id} className={done(id) ? 'intervention done' : 'intervention'} onClick={() => onRecord(plant, id)} title={done(id) ? `Ultima registrazione: ${fmt(done(id).date)}` : `Registra ${label}`}><span>{done(id) ? '✓' : '+'}</span>{label}</button>)}</div></article>; }

function PlantEditor({ plant, technicians, onClose, onSave }) { const [draft, setDraft] = useState(plant); const set = (key, value) => setDraft((p) => ({ ...p, [key]: value })); return <Modal title={plant.id ? 'Modifica impianto' : 'Nuovo impianto'} onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); onSave(draft); }} className="form"><Field label="Descrizione *" value={draft.description} onChange={(v) => set('description', v)} required/><Field label="Comune" value={draft.comune} onChange={(v) => set('comune', v)}/><Field label="Via / Indirizzo" value={draft.via} onChange={(v) => set('via', v)}/><Field label="CAP" value={draft.cap} onChange={(v) => set('cap', v)}/><Field label="Amministratore" value={draft.amministratore} onChange={(v) => set('amministratore', v)}/><label>Tecnico responsabile<input list="technicians" value={draft.tecnicoResponsabile} onChange={(e) => set('tecnicoResponsabile', e.target.value)} required/><datalist id="technicians">{technicians.map((t) => <option key={t} value={t}/>)}</datalist></label><label className="check"><input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)}/> Impianto attivo</label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Annulla</button><button type="submit">Salva impianto</button></div></form></Modal>; }
function Field({ label, value, onChange, required }) { return <label>{label}<input value={value || ''} onChange={(e) => onChange(e.target.value)} required={required}/></label>; }
function HistoryModal({ plant, interventions, onClose, onDelete }) { return <Modal title={plant.description} onClose={onClose}><p className="modal-subtitle">Storico interventi</p><div className="history">{interventions.length ? interventions.map((i) => <div className="history-row" key={i.id}><div><strong>{TYPES.find(([id]) => id === i.type)?.[1] || i.type}</strong><span>{fmt(i.date)}</span></div><button onClick={() => { if (window.confirm('Eliminare questa registrazione?')) onDelete(i.id); }} aria-label="Elimina intervento">×</button></div>) : <p>Nessun intervento registrato.</p>}</div></Modal>; }
function Modal({ title, onClose, children }) { return <div className="overlay" role="dialog" aria-modal="true"><section className="modal"><header><h2>{title}</h2><button onClick={onClose} aria-label="Chiudi"><X/></button></header>{children}</section></div>; }
