import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveRestore, ChevronDown, Download, FileSpreadsheet, Gauge, Grid2X2, History, Info,
  List, Map, MapPin, Menu, Navigation, Pencil, Plus, RotateCcw, Search, Settings,
  Upload, UserRound, Wrench, X
} from 'lucide-react';
import { readPlantsFromExcel } from './excel';
import { importPlanMessage, planPlantImport } from './importSync';
import { clearInvitationCallback, isInvitationCallback } from './authFlow';
import { ALL_TYPES, downloadBackup, loadState, migrateState, saveState } from './storage';
import { downloadConsumptions } from './consumptionExport';
import { supabase } from './supabase';
import {
  cloudDeleteIntervention, cloudImportPlants, cloudRecordIntervention, cloudSaveConsumption,
  cloudDeletePlant, cloudDeleteSeason, cloudSavePlant, cloudStartSeason, loadCloudState, loadProfile, loadProfiles,
  inviteTechnician, migrateLocalToCloud, subscribeToCloud
} from './cloud';

const TYPES = [
  ['manutenzione', 'Manutenzione'], ['verifica', 'Verifica'], ['prova-fumi', 'Prova fumi'],
  ['preaccensione', 'Preaccensione'], ['accensione', 'Accensione'], ['spegnimento', 'Spegnimento']
];
const blankPlant = { description: '', comune: '', via: '', cap: '', amministratore: '', tecnicoResponsabile: '', active: true };
const fmt = (date) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
const typeLabel = (id) => id === 'consumi' ? 'Consumi' : TYPES.find(([key]) => key === id)?.[1] || id;
const addressOf = (plant) => [plant.via, plant.cap, plant.comune].filter(Boolean).join(', ');
const mapsUrl = (plant) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressOf(plant) || plant.description)}`;
const operatingStatus = (interventions) => {
  const latest = interventions.filter((item) => item.type === 'accensione' || item.type === 'spegnimento').sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  return latest?.type === 'accensione' ? 'on' : latest?.type === 'spegnimento' ? 'off' : 'unknown';
};
function LoadingScreen({ text }) { return <main className="auth-shell"><div className="auth-card"><Wrench size={34}/><h1>Utility Impianti</h1><p>{text}</p></div></main>; }
function InvitationSetup({ session, onComplete }) {
  const fullName = session.user.user_metadata?.full_name || '';
  const technicianName = session.user.user_metadata?.technician_name || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    if (password !== confirmPassword) return setMessage('Le password non coincidono.');
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      clearInvitationCallback();
      onComplete();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  return <main className="auth-shell"><section className="auth-card"><Wrench size={34}/><p className="eyebrow">Prima attivazione</p><h1>Benvenuto</h1><p>Conferma i tuoi dati e scegli la password personale.</p><div className="activation-identity"><strong>{fullName || session.user.email}</strong>{technicianName && <small>Tecnico associato: {technicianName}</small>}<small>{session.user.email}</small></div><form className="form" onSubmit={submit}><label>Nuova password<input type="password" minLength="8" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required/></label><label>Conferma password<input type="password" minLength="8" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required/></label>{message && <p className="form-error">{message}</p>}<button className="auth-submit" disabled={busy}>{busy ? 'Attendere…' : 'Attiva il mio account'}</button></form></section></main>;
}
function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  return <main className="auth-shell"><section className="auth-card"><Wrench size={34}/><p className="eyebrow">Gestione condivisa</p><h1>Utility Impianti</h1><p>Accedi con la tua email aziendale.</p><form className="form" onSubmit={submit}><label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required/></label><label>Password<input type="password" minLength="8" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required/></label>{message && <p className="form-error">{message}</p>}<button className="auth-submit" disabled={busy}>{busy ? 'Attendere…' : 'Accedi'}</button></form></section></main>;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [ready, setReady] = useState(false);
  const [invitationSetup, setInvitationSetup] = useState(isInvitationCallback);
  const [invitationError, setInvitationError] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!invitationSetup || session || !ready) return undefined;
    const timer = window.setTimeout(() => setInvitationError(true), 8000);
    return () => window.clearTimeout(timer);
  }, [invitationSetup, session, ready]);
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    Promise.all([loadProfile(session.user.id), loadProfiles()])
      .then(([own, all]) => { setProfile(own); setProfiles(all); })
      .catch(() => setProfile(null));
  }, [session]);
  if (!ready) return <LoadingScreen text="Avvio Utility Impianti…"/>;
  if (!session && invitationSetup && !invitationError) return <LoadingScreen text="Verifica dell’invito in corso…"/>;
  if (!session && invitationSetup) return <main className="auth-shell"><section className="auth-card"><Wrench size={34}/><p className="eyebrow">Invito non completato</p><h1>Utility Impianti</h1><p>Non è stato possibile verificare questo invito. Apri nuovamente il collegamento originale ricevuto via email oppure chiedi all’amministratore un nuovo invito.</p><button className="auth-submit" onClick={() => { clearInvitationCallback(); setInvitationSetup(false); setInvitationError(false); }}>Vai all’accesso</button></section></main>;
  if (!session) return <AuthScreen/>;
  if (invitationSetup) return <InvitationSetup session={session} onComplete={() => setInvitationSetup(false)}/>;
  if (!profile) return <LoadingScreen text="Caricamento profilo…"/>;
  return <WorkspaceApp session={session} profile={profile} profiles={profiles} refreshProfiles={async () => setProfiles(await loadProfiles())}/>;
}

function WorkspaceApp({ session, profile, profiles, refreshProfiles }) {
  const [state, setState] = useState(loadState);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);
  const [historyPlant, setHistoryPlant] = useState(null);
  const [consumptionPlant, setConsumptionPlant] = useState(null);
  const [panel, setPanel] = useState(null);
  const [notice, setNotice] = useState('');
  const [cloudReady, setCloudReady] = useState(false);
  const isAdmin = profile.role === 'admin';
  const excelInput = useRef(); const backupInput = useRef();
  useEffect(() => saveState(state), [state]);
  const refreshCloud = async () => {
    const cloud = await loadCloudState(state.selectedTechnician);
    setState((current) => ({ ...cloud, selectedTechnician: current.selectedTechnician, preferences: current.preferences }));
    setCloudReady(true);
  };
  useEffect(() => { refreshCloud().catch((error) => { console.error(error); setCloudReady(true); }); }, []);
  useEffect(() => subscribeToCloud(() => refreshCloud().catch(console.error)), [state.selectedTechnician]);
  const technicians = useMemo(() => [...new Set([...profiles.map((item) => item.technician_name), ...state.plants.map((item) => item.tecnicoResponsabile)].filter(Boolean))].sort((a, b) => a.localeCompare(b)), [profiles, state.plants]);
  const isDone = (plantId, interventionType) => interventionType === 'consumi'
    ? state.consumptions.some((item) => item.plantId === plantId && item.campaignId === state.activeConsumptionCampaignId)
    : state.interventions.some((item) =>
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
  const canOperate = (plant) => isAdmin || plant.assignedTo === session.user.id;
  const record = async (plant, interventionType) => {
    if (!canOperate(plant)) return flash('Puoi registrare interventi solo sui tuoi impianti.');
    try {
      const intervention = await cloudRecordIntervention(plant, interventionType, state.activeCampaignByType[interventionType], session.user.id);
      setState((current) => ({ ...current, interventions: [intervention, ...current.interventions] }));
      flash(`${typeLabel(interventionType)} registrata.`);
    } catch (error) { alert(error.message); }
  };
  const savePlant = async (plant) => {
    if (!isAdmin) return flash('Accesso amministratore richiesto.');
    const prepared = { ...plant, id: plant.id || crypto.randomUUID(), active: plant.active !== false, createdAt: plant.createdAt || new Date().toISOString() };
    try {
      const saved = await cloudSavePlant(prepared, profiles);
      setState((current) => ({ ...current, plants: current.plants.some((item) => item.id === saved.id) ? current.plants.map((item) => item.id === saved.id ? saved : item) : [saved, ...current.plants] }));
      setEditing(null); flash('Impianto salvato.');
    } catch (error) { alert(error.message); }
  };
  const deletePlant = async (plant) => {
    if (!isAdmin) return flash('Accesso amministratore richiesto.');
    if (!window.confirm(`Eliminare definitivamente “${plant.description}” e tutto il suo storico?`)) return;
    if (!window.confirm('Questa operazione non può essere annullata. Confermi l’eliminazione completa?')) return;
    try {
      await cloudDeletePlant(plant.id);
      setState((current) => ({
        ...current,
        plants: current.plants.filter((item) => item.id !== plant.id),
        interventions: current.interventions.filter((item) => item.plantId !== plant.id),
        consumptions: current.consumptions.filter((item) => item.plantId !== plant.id)
      }));
      setEditing(null); flash('Impianto e storico eliminati.');
    } catch (error) { alert(error.message); }
  };
  const importExcel = async (event) => {
    if (!isAdmin) { flash('Accesso amministratore richiesto.'); event.target.value = ''; return; }
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const plants = await readPlantsFromExcel(file);
      const plan = planPlantImport(plants, state.plants, profiles);
      if (!window.confirm(importPlanMessage(plan))) return;
      if (!plan.rows.length) {
        flash('Nessuna modifica da importare.');
        return;
      }
      await cloudImportPlants(plan.rows, profiles);
      await refreshCloud();
      flash(`${plan.updates.length} impianti aggiornati, ${plan.additions.length} aggiunti.`);
    } catch (error) { alert(error.message); } finally { event.target.value = ''; }
  };
  const importBackup = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const migrated = migrateState(data);
      if (!Array.isArray(data.plants) || !Array.isArray(data.interventions)) throw new Error();
      if (window.confirm('Ripristinare questo backup? I dati presenti saranno sostituiti.')) {
        if (!isAdmin) throw new Error('Accesso amministratore richiesto.');
        await migrateLocalToCloud(migrated, session.user.id, profiles); await refreshCloud();
        setPanel(null); flash('Backup importato nel database condiviso.');
      }
    } catch { alert('Questo file non è un backup valido di Utility Impianti.'); } finally { event.target.value = ''; }
  };
  const startSeason = async (name, categories) => {
    if (!isAdmin) return flash('Accesso amministratore richiesto.');
    try {
      await cloudStartSeason(name.trim(), categories, session.user.id, state.activeConsumptionCampaignId);
      await refreshCloud(); setPanel(null); flash(`Nuova stagione avviata per ${categories.length} categorie.`);
    } catch (error) { alert(error.message); }
  };
  const setView = (view) => setState((current) => ({ ...current, preferences: { ...current.preferences, view } }));
  const saveConsumption = async (values) => {
    if (!canOperate(consumptionPlant)) return flash('Puoi modificare i consumi solo sui tuoi impianti.');
    const key = `${consumptionPlant.id}:${state.activeConsumptionCampaignId}`;
    const current = state.consumptions.find((item) => item.id === key);
    try {
      await cloudSaveConsumption(consumptionPlant.id, state.activeConsumptionCampaignId, values, session.user.id, current?.cloudId);
      await refreshCloud(); setConsumptionPlant(null); flash('Letture consumi salvate.');
    } catch (error) { alert(error.message); }
  };

  return <main className="app-shell">
    <header className="topbar">
      <div><p className="eyebrow"><Wrench size={15}/> Gestione interventi</p><h1>Utility Impianti</h1></div>
      <button className="icon-button" aria-label="Apri impostazioni" onClick={() => setPanel('settings')}><Menu size={22}/></button>
    </header>
    <section className="controls">
      <label className="select-wrap">Tecnico <select value={state.selectedTechnician} onChange={(e) => setState((current) => ({ ...current, selectedTechnician: e.target.value }))}><option>Tutti</option>{technicians.map((tech) => <option key={tech}>{tech}</option>)}</select><ChevronDown size={18}/></label>
      <label className="search"><Search size={19}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca nome, via, comune…" />{query && <button onClick={() => setQuery('')} aria-label="Cancella ricerca"><X size={17}/></button>}</label>
    </section>
    <section className="filters">
      <div className="chips">{[['all', 'Tutti'], ...TYPES, ['consumi', 'Consumi']].map(([id, label]) => <button className={type === id ? 'chip active' : 'chip'} key={id} onClick={() => { setType(id); if (id === 'all') setStatus('all'); }}>{label}</button>)}</div>
      {type !== 'all' && <div className="status-tabs"><button className={status === 'all' ? 'selected' : ''} onClick={() => setStatus('all')}>Tutti</button><button className={status === 'todo' ? 'selected' : ''} onClick={() => setStatus('todo')}>Da fare</button><button className={status === 'done' ? 'selected' : ''} onClick={() => setStatus('done')}>Completati</button></div>}
    </section>
    {type !== 'all' && <section className="progress"><div><strong>{typeLabel(type)}</strong><span>{completed} di {progressPool.length} completati</span></div><div className="bar"><i style={{ width: `${progressPool.length ? completed / progressPool.length * 100 : 0}%` }} /></div></section>}
    <section className="list-head">
      <span>{visible.length} impianti</span>
      <div className="list-tools"><button title="Vista schede" className={state.preferences.view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}><Grid2X2 size={17}/></button><button title="Vista elenco" className={state.preferences.view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={18}/></button><button title="Vista mappa" onClick={() => setPanel('map')}><Map size={18}/></button>{isAdmin && <button className="add" onClick={() => setEditing(blankPlant)}><Plus size={18}/> Nuovo</button>}</div>
    </section>
    <section className={state.preferences.view === 'list' ? 'plant-list compact' : 'plant-list'}>
      {visible.map((plant) => state.preferences.view === 'list'
        ? <PlantRow key={plant.id} plant={plant} operating={operatingStatus(state.interventions.filter((item) => item.plantId === plant.id))} onEdit={isAdmin ? () => setEditing(plant) : null} onHistory={() => setHistoryPlant(plant)} onConsumption={() => setConsumptionPlant(plant)}/>
        : <PlantCard key={plant.id} plant={plant} canOperate={canOperate(plant)} operating={operatingStatus(state.interventions.filter((item) => item.plantId === plant.id))} interventions={state.interventions.filter((item) => item.plantId === plant.id && item.campaignId === state.activeCampaignByType[item.type])} onRecord={record} onEdit={isAdmin ? () => setEditing(plant) : null} onHistory={() => setHistoryPlant(plant)} onConsumption={() => setConsumptionPlant(plant)}/>)}
      {!visible.length && <div className="empty"><FileSpreadsheet size={35}/><h2>Nessun impianto trovato</h2><p>Importa il tuo Excel o modifica i filtri.</p></div>}
    </section>
    <input ref={excelInput} type="file" accept=".xlsx,.xls,.csv" hidden onChange={importExcel}/>
    <input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={importBackup}/>
    {notice && <div className="toast">{notice}</div>}
    {editing && <PlantEditor plant={editing} technicians={technicians} onClose={() => setEditing(null)} onSave={savePlant} onDelete={editing.id ? deletePlant : null}/>}
    {historyPlant && <HistoryModal plant={historyPlant} interventions={state.interventions.filter((item) => item.plantId === historyPlant.id)} campaigns={state.campaigns} canDelete={(item) => isAdmin || item.performedBy === session.user.id} onClose={() => setHistoryPlant(null)} onDelete={async (id) => { try { await cloudDeleteIntervention(id); setState((current) => ({ ...current, interventions: current.interventions.filter((item) => item.id !== id) })); } catch (error) { alert(error.message); } }}/>}
    {consumptionPlant && <ConsumptionModal plant={consumptionPlant} readOnly={!canOperate(consumptionPlant)} campaign={state.campaigns.find((item) => item.id === state.activeConsumptionCampaignId)} current={state.consumptions.find((item) => item.plantId === consumptionPlant.id && item.campaignId === state.activeConsumptionCampaignId)} history={state.consumptions.filter((item) => item.plantId === consumptionPlant.id)} campaigns={state.campaigns} onClose={() => setConsumptionPlant(null)} onSave={saveConsumption}/>}
    {panel === 'settings' && <SettingsModal state={state} technicians={technicians} isAdmin={isAdmin} profile={profile} onClose={() => setPanel(null)} onTechnician={(value) => setState((current) => ({ ...current, selectedTechnician: value }))} onLogout={() => supabase.auth.signOut()} onUsers={() => setPanel('users')} onExcel={() => excelInput.current.click()} onExport={() => downloadBackup(state)} onConsumptionExport={() => downloadConsumptions(state)} onRestore={() => backupInput.current.click()} onSeason={() => setPanel('season')} onSeasons={() => setPanel('seasons')} onMap={() => setPanel('map')} onMigrate={async () => { if (!window.confirm('Importare nel cloud tutti i dati locali presenti su questo dispositivo?')) return; try { await migrateLocalToCloud(loadState(), session.user.id, profiles); await refreshCloud(); flash('Dati locali migrati nel cloud.'); } catch (error) { alert(error.message); } }}/>}
    {panel === 'season' && <SeasonModal onClose={() => setPanel('settings')} onStart={startSeason}/>}
    {panel === 'seasons' && <SeasonsModal campaigns={state.campaigns} activeIds={new Set([...Object.values(state.activeCampaignByType), state.activeConsumptionCampaignId])} onClose={() => setPanel('settings')} onDelete={async (campaign) => { if (!window.confirm(`Eliminare definitivamente la stagione “${campaign.name}” e tutti i dati collegati?`)) return; try { await cloudDeleteSeason(campaign.id); await refreshCloud(); flash('Stagione precedente eliminata.'); } catch (error) { alert(error.message); } }}/>}
    {panel === 'map' && <MapModal plants={visible} technician={state.selectedTechnician} type={type} status={status} onClose={() => setPanel(null)}/>}
    {panel === 'users' && <UsersModal profiles={profiles} onClose={() => setPanel('settings')} onInvite={async (details) => { await inviteTechnician(details); await refreshProfiles(); flash('Invito inviato al tecnico.'); }}/>}
    {!cloudReady && <div className="sync-banner">Sincronizzazione dati…</div>}
  </main>;
}

function PlantCard({ plant, canOperate, operating, interventions, onRecord, onEdit, onHistory, onConsumption }) {
  const done = (id) => interventions.find((item) => item.type === id);
  return <article className="plant-card"><PlantHeading plant={plant} operating={operating} onEdit={onEdit} onHistory={onHistory}/><div className="interventions">{TYPES.map(([id, label]) => <button key={id} disabled={!canOperate} className={done(id) ? 'intervention done' : 'intervention'} onClick={() => onRecord(plant, id)} title={!canOperate ? 'Solo consultazione: impianto assegnato a un altro tecnico' : done(id) ? `Ultima registrazione: ${fmt(done(id).date)}` : `Registra ${label}`}><span>{done(id) ? '✓' : '+'}</span>{label}</button>)}</div><button className="consumption-button" onClick={onConsumption}><Gauge size={17}/> {canOperate ? 'Consumi' : 'Consulta consumi'}</button></article>;
}
function PlantRow({ plant, operating, onEdit, onHistory, onConsumption }) {
  return <article className="plant-row"><a href={mapsUrl(plant)} target="_blank" rel="noreferrer"><div className="row-title"><h2>{plant.description}</h2><OperatingBadge status={operating}/></div><p><MapPin size={14}/>{addressOf(plant) || 'Indirizzo non indicato'}</p><small>{plant.tecnicoResponsabile}</small></a><div className="card-actions"><button onClick={onConsumption} aria-label="Consumi"><Gauge size={16}/></button>{onEdit && <button onClick={onEdit} aria-label="Modifica"><Pencil size={16}/></button>}<button onClick={onHistory} aria-label="Storico"><History size={17}/></button></div></article>;
}
function PlantHeading({ plant, operating, onEdit, onHistory }) {
  return <div className="plant-title"><div><div className="row-title"><h2>{plant.description}</h2><OperatingBadge status={operating}/></div><a href={mapsUrl(plant)} target="_blank" rel="noreferrer"><MapPin size={15}/>{addressOf(plant) || 'Indirizzo non indicato'}</a><small>{plant.tecnicoResponsabile}</small></div><div className="card-actions">{onEdit && <button aria-label="Modifica impianto" onClick={onEdit}><Pencil size={17}/></button>}<button aria-label="Vedi storico" onClick={onHistory}><History size={18}/></button></div></div>;
}
function OperatingBadge({ status }) { const label = status === 'on' ? 'Acceso' : status === 'off' ? 'Spento' : 'Stato non registrato'; return <span className={`operating-badge ${status}`} title={label}><i/>{label}</span>; }
function SettingsModal({ state, technicians, isAdmin, profile, onClose, onTechnician, onLogout, onUsers, onExcel, onExport, onConsumptionExport, onRestore, onSeason, onSeasons, onMap, onMigrate }) {
  return <Modal title="Impostazioni" onClose={onClose}><div className="settings-list">
    <div className="admin-session"><UserRound/><span><strong>{isAdmin ? 'Amministratore' : profile.full_name || profile.technician_name || 'Tecnico'}</strong><small>{profile.email}</small></span><button onClick={onLogout}>Esci</button></div>
    <label className="settings-select"><UserRound/><span><strong>Tecnico</strong><small>Impianti visualizzati</small></span><select value={state.selectedTechnician} onChange={(e) => onTechnician(e.target.value)}><option>Tutti</option>{technicians.map((tech) => <option key={tech}>{tech}</option>)}</select></label>
    {isAdmin && <SettingButton icon={<Upload/>} title="Importa Excel" note="Aggiorna l’elenco impianti" onClick={onExcel}/>}
    {isAdmin && <SettingButton icon={<UserRound/>} title="Gestione utenti" note="Invita tecnici tramite email" onClick={onUsers}/>}
    <SettingButton icon={<Download/>} title="Esporta backup" note="Salva impianti, storico e stagioni" onClick={onExport}/>
    {isAdmin && <SettingButton icon={<FileSpreadsheet/>} title="Scarica consumi" note="Genera un file Excel della stagione corrente" onClick={onConsumptionExport}/>}
    {isAdmin && <SettingButton icon={<ArchiveRestore/>} title="Ripristina backup" note="Compatibile anche con i backup V1" onClick={onRestore}/>}
    {isAdmin && <SettingButton icon={<RotateCcw/>} title="Chiudi e apri stagione" note="Chiude il periodo corrente e avvia il successivo" onClick={onSeason}/>}
    {isAdmin && <SettingButton icon={<History/>} title="Gestione stagioni" note="Consulta o elimina le stagioni precedenti" onClick={onSeasons}/>}
    {isAdmin && <SettingButton icon={<Upload/>} title="Migra dati V1" note="Copia nel cloud i dati locali di questo dispositivo" onClick={onMigrate}/>}
    <SettingButton icon={<Map/>} title="Mappa impianti" note="Usa i filtri attualmente selezionati" onClick={onMap}/>
    <div className="app-info"><Info/><div><strong>Utility Impianti</strong><small>Versione 1.1 · dati salvati sul dispositivo</small></div></div>
  </div></Modal>;
}
function SettingButton({ icon, title, note, onClick }) { return <button className="setting-button" onClick={onClick}>{icon}<span><strong>{title}</strong><small>{note}</small></span><span>›</span></button>; }
function UsersModal({ profiles, onClose, onInvite }) {
  const [draft, setDraft] = useState({ email: '', fullName: '', technicianName: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  return <Modal title="Gestione utenti" onClose={onClose}><form className="form user-invite" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(''); try { await onInvite(draft); setDraft({ email: '', fullName: '', technicianName: '' }); } catch (inviteError) { setError(inviteError.message); } finally { setBusy(false); } }}><Field label="Email tecnico" value={draft.email} onChange={(value) => set('email', value)} required/><Field label="Nome e cognome" value={draft.fullName} onChange={(value) => set('fullName', value)} required/><Field label="Tecnico associato" value={draft.technicianName} onChange={(value) => set('technicianName', value)} required/>{error && <p className="form-error">{error}</p>}<button className="auth-submit" disabled={busy}>{busy ? 'Invio…' : 'Invia invito'}</button></form><div className="user-list"><h3>Utenti configurati</h3>{profiles.map((item) => <div key={item.id}><span><strong>{item.full_name || item.email}</strong><small>{item.email} · {item.technician_name || item.role}</small></span><i className={item.active ? 'active' : ''}>{item.active ? 'Attivo' : 'Disattivo'}</i></div>)}</div></Modal>;
}
function SeasonModal({ onClose, onStart }) {
  const [name, setName] = useState(`Stagione ${new Date().getFullYear() + 1}`);
  const [selected, setSelected] = useState([...ALL_TYPES]);
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <Modal title="Chiudi e apri stagione" onClose={onClose}><p className="modal-subtitle">Il periodo consumi corrente verrà chiuso. Gli interventi e le letture resteranno nello storico; le categorie scelte ripartiranno da zero.</p><div className="form"><label>Nome nuova stagione<input value={name} onChange={(e) => setName(e.target.value)}/></label><fieldset><legend>Categorie da riavviare</legend>{TYPES.map(([id, label]) => <label className="check" key={id}><input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)}/>{label}</label>)}</fieldset><div className="modal-actions"><button className="secondary" onClick={onClose}>Annulla</button><button disabled={!name.trim() || !selected.length} onClick={() => { if (window.confirm(`Chiudere la stagione corrente e avviare “${name}”?`)) onStart(name, selected); }}>Chiudi e avvia</button></div></div></Modal>;
}
function SeasonsModal({ campaigns, activeIds, onClose, onDelete }) {
  const previous = campaigns.filter((campaign) => campaign.id !== 'legacy' && !activeIds.has(campaign.id));
  return <Modal title="Gestione stagioni" onClose={onClose}><p className="modal-subtitle">Puoi eliminare soltanto stagioni non più attive. Verranno eliminati anche interventi e consumi collegati.</p><div className="history">{previous.length ? previous.map((campaign) => <div className="history-row" key={campaign.id}><div><strong>{campaign.name}</strong><span>{campaign.closedAt ? `Chiusa il ${fmt(campaign.closedAt)}` : 'Stagione precedente'}</span></div><button onClick={() => onDelete(campaign)} aria-label={`Elimina ${campaign.name}`}>×</button></div>) : <p>Nessuna stagione precedente eliminabile.</p>}</div></Modal>;
}
function MapModal({ plants, technician, type, status, onClose }) {
  const [showMap, setShowMap] = useState(false);
  return <Modal title="Mappa impianti" onClose={onClose}><p className="modal-subtitle">{plants.length} risultati · {technician}{type !== 'all' ? ` · ${typeLabel(type)} ${status === 'todo' ? 'da fare' : status === 'done' ? 'completati' : ''}` : ''}</p><button className="route-button" disabled={!plants.length} onClick={() => setShowMap((value) => !value)}><Map size={18}/> {showMap ? 'Nascondi mappa' : 'Vedi tutti'}</button>{showMap && <MapOverview plants={plants}/>}<div className="map-list">{plants.map((plant) => <a key={plant.id} href={mapsUrl(plant)} target="_blank" rel="noreferrer"><MapPin/><span><strong>{plant.description}</strong><small>{addressOf(plant) || 'Indirizzo non indicato'}</small></span><Navigation size={17}/></a>)}</div></Modal>;
}
function MapOverview({ plants }) {
  const element = useRef(null);
  const [progress, setProgress] = useState({ found: 0, checked: 0, total: plants.length, error: '' });
  useEffect(() => {
    let cancelled = false; let map;
    const run = async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !element.current) return;
        map = L.map(element.current).setView([45.1, 9.1], 8);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
        const points = []; const cache = readGeocodeCache();
        for (let index = 0; index < plants.length && !cancelled; index += 1) {
          const plant = plants[index]; const address = `${addressOf(plant)}, Italia`;
          let coordinates = cache[address];
          if (!coordinates && addressOf(plant)) {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=it&q=${encodeURIComponent(address)}`, { headers: { Accept: 'application/json' } });
            if (response.ok) {
              const result = (await response.json())[0];
              coordinates = result ? [Number(result.lat), Number(result.lon)] : null;
              cache[address] = coordinates; writeGeocodeCache(cache);
            }
            if (index < plants.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 1050));
          }
          if (coordinates) {
            points.push(coordinates);
            const popup = document.createElement('div');
            const title = document.createElement('strong'); title.textContent = plant.description;
            const detail = document.createElement('div'); detail.textContent = addressOf(plant);
            popup.append(title, detail);
            L.marker(coordinates).addTo(map).bindPopup(popup);
            if (points.length === 1) map.setView(coordinates, 13); else map.fitBounds(points, { padding: [24, 24], maxZoom: 15 });
          }
          setProgress({ found: points.length, checked: index + 1, total: plants.length, error: '' });
        }
      } catch {
        if (!cancelled) setProgress((value) => ({ ...value, error: 'Impossibile caricare la mappa. Controlla la connessione e riprova.' }));
      }
    };
    run();
    return () => { cancelled = true; if (map) map.remove(); };
  }, [plants]);
  return <section className="map-overview"><div ref={element} className="map-canvas"/><p>{progress.error || `${progress.found} impianti posizionati · ${progress.checked} di ${progress.total} controllati`}</p><small>Al primo utilizzo gli indirizzi vengono localizzati progressivamente e poi conservati sul dispositivo.</small></section>;
}
function readGeocodeCache() { try { return JSON.parse(localStorage.getItem('utility-impianti-geocodes-v1')) || {}; } catch { return {}; } }
function writeGeocodeCache(cache) { localStorage.setItem('utility-impianti-geocodes-v1', JSON.stringify(cache)); }
let leafletPromise;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet]')) {
      const style = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' });
      style.dataset.leaflet = 'true'; document.head.appendChild(style);
    }
    const script = Object.assign(document.createElement('script'), { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', crossOrigin: '' });
    script.onload = () => resolve(window.L); script.onerror = reject; document.head.appendChild(script);
  });
  return leafletPromise;
}
function ConsumptionModal({ plant, readOnly, campaign, current, history, campaigns, onClose, onSave }) {
  const [draft, setDraft] = useState(current || { gasStart: '', gasEnd: '', energyMeters: [{ id: crypto.randomUUID(), zone: 'Contatore 1', start: '', end: '' }] });
  const set = (key, value) => setDraft((item) => ({ ...item, [key]: value }));
  const meters = draft.energyMeters || [];
  const setMeter = (id, key, value) => setDraft((item) => ({ ...item, energyMeters: item.energyMeters.map((meter) => meter.id === id ? { ...meter, [key]: value } : meter) }));
  const addMeter = () => setDraft((item) => ({ ...item, energyMeters: [...item.energyMeters, { id: crypto.randomUUID(), zone: `Contatore ${item.energyMeters.length + 1}`, start: '', end: '' }] }));
  const removeMeter = (id) => setDraft((item) => ({ ...item, energyMeters: item.energyMeters.filter((meter) => meter.id !== id) }));
  const numeric = (value) => value === '' ? '' : Number(value);
  return <Modal title={`Consumi · ${plant.description}`} onClose={onClose}>
    <p className="modal-subtitle">Periodo: <strong>{campaign?.name || 'Dati precedenti'}</strong>. Inserisci le letture cumulative riportate sui contatori.</p>
    {readOnly && <p className="readonly-note">Solo consultazione: l’impianto è assegnato a un altro tecnico.</p>}
    <form className="form consumption-form" onSubmit={(event) => { event.preventDefault(); onSave({ gasStart: numeric(draft.gasStart), gasEnd: numeric(draft.gasEnd), energyMeters: meters.map((meter) => ({ ...meter, zone: meter.zone.trim(), start: numeric(meter.start), end: numeric(meter.end) })) }); }}>
      <label>Gas inizio stagione (m³)<input disabled={readOnly} type="number" inputMode="decimal" min="0" step="0.001" value={draft.gasStart} onChange={(event) => set('gasStart', event.target.value)}/></label>
      <label>Gas fine stagione (m³)<input disabled={readOnly} type="number" inputMode="decimal" min="0" step="0.001" value={draft.gasEnd} onChange={(event) => set('gasEnd', event.target.value)}/></label>
      <section className="energy-meters"><div className="energy-head"><div><strong>Contatori energia</strong><small>Assegna un nome alla zona per riconoscerla.</small></div>{!readOnly && <button type="button" onClick={addMeter}><Plus size={16}/> Aggiungi</button>}</div>{meters.map((meter, index) => <div className="energy-meter" key={meter.id}><label>Zona / nome<input disabled={readOnly} value={meter.zone} placeholder={`Contatore ${index + 1}`} onChange={(event) => setMeter(meter.id, 'zone', event.target.value)}/></label><label>Inizio (MWh)<input disabled={readOnly} type="number" inputMode="decimal" min="0" step="0.001" value={meter.start} onChange={(event) => setMeter(meter.id, 'start', event.target.value)}/></label><label>Fine (MWh)<input disabled={readOnly} type="number" inputMode="decimal" min="0" step="0.001" value={meter.end} onChange={(event) => setMeter(meter.id, 'end', event.target.value)}/></label><div className="meter-result"><span>{difference(meter.end, meter.start)} MWh</span>{!readOnly && meters.length > 1 && <button type="button" aria-label="Rimuovi contatore" onClick={() => removeMeter(meter.id)}>×</button>}</div></div>)}</section>
      <div className="consumption-totals"><span>Gas consumato <strong>{difference(draft.gasEnd, draft.gasStart)} m³</strong></span><span>Energia totale <strong>{displayReading(meters.reduce((total, meter) => { const value = numericDifference(meter.end, meter.start); return value == null ? total : total + value; }, 0))} MWh</strong></span></div>
      <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{readOnly ? 'Chiudi' : 'Annulla'}</button>{!readOnly && <button type="submit">Salva letture</button>}</div>
    </form>
    {history.filter((item) => item.campaignId !== current?.campaignId).length > 0 && <div className="consumption-history"><h3>Periodi precedenti</h3>{history.filter((item) => item.campaignId !== current?.campaignId).map((item) => <div key={item.id}><strong>{campaigns.find((campaignItem) => campaignItem.id === item.campaignId)?.name || 'Dati precedenti'}</strong><span>Gas: {displayReading(item.gasStart)} → {displayReading(item.gasEnd)} m³</span>{(item.energyMeters || []).map((meter) => <span key={meter.id}>{meter.zone}: {displayReading(meter.start)} → {displayReading(meter.end)} MWh</span>)}</div>)}</div>}
  </Modal>;
}
const displayReading = (value) => value === '' || value == null ? '—' : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 3 }).format(value);
const numericDifference = (end, start) => end !== '' && start !== '' && Number(end) >= Number(start) ? Number(end) - Number(start) : null;
const difference = (end, start) => { const value = numericDifference(end, start); return value == null ? '—' : displayReading(value); };
function PlantEditor({ plant, technicians, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(plant); const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  return <Modal title={plant.id ? 'Modifica impianto' : 'Nuovo impianto'} onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); onSave(draft); }} className="form"><Field label="Descrizione *" value={draft.description} onChange={(value) => set('description', value)} required/><Field label="Comune" value={draft.comune} onChange={(value) => set('comune', value)}/><Field label="Via / Indirizzo" value={draft.via} onChange={(value) => set('via', value)}/><Field label="CAP" value={draft.cap} onChange={(value) => set('cap', value)}/><Field label="Amministratore" value={draft.amministratore} onChange={(value) => set('amministratore', value)}/><label>Tecnico responsabile<input list="technicians" value={draft.tecnicoResponsabile} onChange={(e) => set('tecnicoResponsabile', e.target.value)} required/><datalist id="technicians">{technicians.map((tech) => <option key={tech} value={tech}/>)}</datalist></label><label className="check"><input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)}/> Impianto attivo</label>{onDelete && <button type="button" className="danger-button" onClick={() => onDelete(plant)}>Elimina impianto e storico</button>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Annulla</button><button type="submit">Salva impianto</button></div></form></Modal>;
}
function Field({ label, value, onChange, required }) { return <label>{label}<input value={value || ''} onChange={(e) => onChange(e.target.value)} required={required}/></label>; }
function HistoryModal({ plant, interventions, campaigns, canDelete, onClose, onDelete }) {
  const campaignName = (id) => campaigns.find((campaign) => campaign.id === id)?.name || 'Dati precedenti';
  return <Modal title={plant.description} onClose={onClose}><p className="modal-subtitle">Storico interventi completo</p><div className="history">{interventions.length ? interventions.map((item) => <div className="history-row" key={item.id}><div><strong>{typeLabel(item.type)}</strong><span>{fmt(item.date)} · {campaignName(item.campaignId)}</span></div>{canDelete(item) && <button onClick={() => { if (window.confirm('Eliminare questa registrazione?')) onDelete(item.id); }} aria-label="Elimina intervento">×</button>}</div>) : <p>Nessun intervento registrato.</p>}</div></Modal>;
}
function Modal({ title, onClose, children }) { return <div className="overlay" role="dialog" aria-modal="true"><section className="modal"><header><h2>{title}</h2><button onClick={onClose} aria-label="Chiudi"><X/></button></header>{children}</section></div>; }
