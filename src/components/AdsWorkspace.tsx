import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Target, Megaphone, Trash2, AlertCircle, Calendar as CalendarIcon, Users, Sparkles, Edit2, Play, Pause, Filter, MapPin, MousePointerClick } from 'lucide-react';
import { db } from '../db';
import type { AdCampaign, Client } from '../types';

export const AdsWorkspace: React.FC = () => {
  const allAds = useLiveQuery(() => db.ads.toArray()) || [];
  const places = useLiveQuery(() => db.places.toArray()) || [];
  const clients = useLiveQuery(() => db.clients.toArray()) || [];
  
  const [activeTab, setActiveTab] = useState<'campaigns' | 'calendar' | 'clients'>('calendar');
  
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  // Filters
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Campaign Form state
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [type, setType] = useState<'banner'|'pin'>('pin');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🍔');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radiusMeters, setRadiusMeters] = useState(300);
  const [callToAction, setCallToAction] = useState('Llevarme ahí');

  // Client Form State
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');

  // AI Mock State
  const [isGenerating, setIsGenerating] = useState(false);

  const ads = allAds.filter(ad => {
    if (filterClient && ad.clientId !== filterClient) return false;
    if (filterStatus === 'active' && !ad.isActive) return false;
    if (filterStatus === 'paused' && ad.isActive) return false;
    return true;
  });

  const handleCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const adData: AdCampaign = {
      id: editingAdId || `ad-${Date.now()}`,
      clientId: clientId || 'default',
      type,
      title,
      description,
      icon,
      routeIds: [],
      coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) }, // For hyper-local, coordinates are strictly required.
      radiusMeters: radiusMeters,
      callToAction: callToAction || 'Llevarme ahí',
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      isActive: true, // Always save as active or keep existing status
      createdAt: new Date().toISOString()
    };
    
    if (editingAdId) {
       const existingAd = allAds.find(a => a.id === editingAdId);
       if (existingAd) adData.isActive = existingAd.isActive;
       await db.ads.put(adData);
    } else {
       await db.ads.add(adData);
    }
    
    setIsCampaignModalOpen(false);
    resetCampaignForm();
  };

  const openEditModal = (ad: AdCampaign) => {
    setEditingAdId(ad.id);
    setClientId(ad.clientId);
    setType(ad.type);
    setTitle(ad.title);
    setDescription(ad.description);
    setIcon(ad.icon);
    setStartDate(ad.startDate || '');
    setEndDate(ad.endDate || '');
    setRadiusMeters(ad.radiusMeters || 300);
    setCallToAction(ad.callToAction || 'Llevarme ahí');
    if (ad.coordinates) {
       setLat(ad.coordinates.lat.toString());
       setLng(ad.coordinates.lng.toString());
    } else {
       setLat(''); setLng('');
    }
    setIsCampaignModalOpen(true);
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newClient: Client = {
      id: `client-${Date.now()}`,
      name: clientName,
      contactEmail: clientContact,
      createdAt: new Date().toISOString()
    };
    await db.clients.add(newClient);
    setIsClientModalOpen(false);
    setClientName('');
    setClientContact('');
  };

  const resetCampaignForm = () => {
    setEditingAdId(null); setTitle(''); setDescription(''); setIcon('🍔'); setLat(''); setLng(''); setType('pin'); setStartDate(''); setEndDate(''); setClientId(''); setRadiusMeters(300); setCallToAction('Llevarme ahí');
  };

  const handleDeleteCampaign = async (id: string) => {
    if(confirm('¿Borrar campaña?')) await db.ads.delete(id);
  };

  const handleDeleteClient = async (id: string) => {
    if(confirm('¿Borrar cliente?')) await db.clients.delete(id);
  };

  const toggleActive = async (ad: AdCampaign) => {
    await db.ads.update(ad.id, { isActive: !ad.isActive });
  };

  const generateAICopy = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setTitle("¡Ya casi llegas! Descuento relámpago");
      setDescription("Estás a 3 minutos caminando de tu parada. Presenta este cupón al llegar y llévate un 2x1 en tu orden.");
      setIcon("🏃‍♂️💨");
      setCallToAction("📍 Trazar ruta al local");
      setIsGenerating(false);
    }, 1500);
  };

  const renderCalendar = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="bg-slate-50 border border-slate-100 min-h-[100px]"></div>);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayAds = ads.filter(ad => {
        if (!ad.startDate && !ad.endDate) return true;
        const start = ad.startDate ? new Date(ad.startDate) : new Date(0);
        const end = ad.endDate ? new Date(ad.endDate) : new Date(8640000000000000);
        const current = new Date(currentDateStr);
        const cDate = current.toISOString().split('T')[0];
        const sDate = start.toISOString().split('T')[0];
        const eDate = end.toISOString().split('T')[0];
        return (cDate >= sDate || !ad.startDate) && (cDate <= eDate || !ad.endDate);
      });

      days.push(
        <div key={`day-${d}`} className="bg-white border border-slate-200 min-h-[100px] p-1 flex flex-col">
          <span className={`text-xs font-bold mb-1 ml-1 ${d === today.getDate() ? 'bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-slate-500'}`}>
            {d}
          </span>
          <div className="flex-1 overflow-y-auto space-y-1">
            {dayAds.map(ad => (
              <div key={ad.id} onClick={() => openEditModal(ad)} className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition flex items-center gap-1 ${ad.isActive ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-500'}`}>
                <span>{ad.icon}</span> {ad.title}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="py-2 text-center text-xs font-bold text-slate-600 border-r border-slate-200 last:border-0">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 bg-slate-200 gap-px">{days}</div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <MapPin className="text-amber-500" /> Pauta de Última Milla (Pymes)
          </h1>
          <p className="text-sm text-slate-500">Activación basada en destino de usuario</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'clients' ? (
            <button onClick={() => setIsClientModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2">
              <Plus size={18} /> Nuevo Cliente
            </button>
          ) : (
            <button onClick={() => { resetCampaignForm(); setIsCampaignModalOpen(true); }} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2">
              <Plus size={18} /> Crear Promoción
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex px-6 bg-white border-b border-slate-200 justify-between items-center">
        <div className="flex">
          <button 
            onClick={() => setActiveTab('calendar')} 
            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'calendar' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <CalendarIcon size={16} /> Calendario Mensual
          </button>
          <button 
            onClick={() => setActiveTab('campaigns')} 
            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'campaigns' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Target size={16} /> Lista de Promociones
          </button>
          <button 
            onClick={() => setActiveTab('clients')} 
            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'clients' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Users size={16} /> Clientes / Negocios
          </button>
        </div>

        {/* Filters */}
        {(activeTab === 'campaigns' || activeTab === 'calendar') && (
          <div className="flex items-center gap-3">
             <Filter size={14} className="text-slate-400" />
             <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="text-xs border-slate-300 rounded py-1 pl-2 pr-6">
                <option value="">Todos los negocios</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
             <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-xs border-slate-300 rounded py-1 pl-2 pr-6">
                <option value="all">Cualquier Estado</option>
                <option value="active">Solo Activas</option>
                <option value="paused">Pausadas</option>
             </select>
          </div>
        )}
      </div>

      <div className="p-6 overflow-y-auto flex-1">
        {/* TAB: CALENDAR */}
        {activeTab === 'calendar' && (
           <div className="max-w-6xl mx-auto w-full">
             {renderCalendar()}
             <p className="text-xs text-slate-400 mt-3 text-center">Haz clic en una campaña en el calendario para editarla.</p>
           </div>
        )}

        {/* TAB: CAMPAIGNS */}
        {activeTab === 'campaigns' && (
          ads.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <MapPin size={48} className="mx-auto mb-4 opacity-50" />
              <p>No hay promociones locales registradas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ads.map(ad => {
                const client = clients.find(c => c.id === ad.clientId);
                return (
                  <div key={ad.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${ad.isActive ? 'border-amber-200' : 'border-slate-200 opacity-70'}`}>
                    <div className="p-5 flex gap-4">
                      <div className="w-12 h-12 rounded-lg bg-amber-50 text-2xl flex items-center justify-center shrink-0 border border-amber-100">
                        {ad.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-slate-800 truncate">{ad.title}</h3>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${ad.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {ad.isActive ? <Play size={10}/> : <Pause size={10}/>}
                            {ad.isActive ? 'ACTIVO' : 'PAUSADO'}
                          </span>
                        </div>
                        <p className="text-[10px] text-blue-600 font-medium my-1">{client ? `Negocio: ${client.name}` : 'Sin Negocio'}</p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ad.description}</p>
                        <div className="mt-3 bg-slate-50 p-2 rounded border border-slate-100">
                           <p className="text-[10px] text-slate-600 flex items-center gap-1 font-bold">
                             <MousePointerClick size={12}/> CTA: "{ad.callToAction}"
                           </p>
                           <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                             <Target size={12}/> Radio de impacto: {ad.radiusMeters}m
                           </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex justify-between items-center">
                       <div className="flex gap-3">
                         <button onClick={() => toggleActive(ad)} className="text-xs font-semibold text-slate-600 hover:text-amber-600 flex items-center gap-1">
                           {ad.isActive ? <Pause size={14}/> : <Play size={14}/>} {ad.isActive ? 'Pausar' : 'Activar'}
                         </button>
                         <button onClick={() => openEditModal(ad)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                           <Edit2 size={14}/> Editar
                         </button>
                       </div>
                       <button onClick={() => handleDeleteCampaign(ad.id)} className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1">
                         <Trash2 size={14} /> Borrar
                       </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* TAB: CLIENTS */}
        {activeTab === 'clients' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {clients.length === 0 ? (
               <div className="col-span-3 text-center py-20 text-slate-400">
                 <Users size={48} className="mx-auto mb-4 opacity-50" />
                 <p>No hay negocios locales registrados.</p>
               </div>
            ) : (
              clients.map(client => (
                <div key={client.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-800 text-lg mb-1">{client.name}</h3>
                  <p className="text-sm text-slate-500 mb-4">{client.contactEmail || 'Sin contacto'}</p>
                  <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400">ID: {client.id.slice(0,10)}...</span>
                    <button onClick={() => handleDeleteClient(client.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* MODAL: CAMPAIGN */}
      {isCampaignModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-amber-500 p-4 text-white flex justify-between items-center shrink-0">
              <h2 className="font-bold text-lg">{editingAdId ? 'Editar Promoción de Última Milla' : 'Nueva Promoción Local'}</h2>
              <button type="button" onClick={generateAICopy} className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 shadow-sm">
                 <Sparkles size={14} /> {isGenerating ? 'Generando...' : 'Auto-Generar Copy de Destino'}
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-6">
              <form id="campaign-form" onSubmit={handleCampaignSubmit} className="space-y-4">
                
                {/* REQUIRED LOCATION BINDING FOR LOCAL ADS */}
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                  <p className="text-xs text-amber-800 font-bold mb-3 flex items-center gap-1"><MapPin size={14}/> 1. Vincular al Negocio en el Mapa</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">El anuncio solo se activará si el destino del usuario está cerca de este punto.</label>
                    <select 
                      required
                      className="w-full border-slate-300 rounded-lg text-sm bg-white"
                      value={places.find(p => p.coordinates.lat.toString() === lat && p.coordinates.lng.toString() === lng)?.id || ""}
                      onChange={(e) => {
                        const selectedPlace = places.find(p => p.id === e.target.value);
                        if (selectedPlace) {
                          setLat(selectedPlace.coordinates.lat.toString());
                          setLng(selectedPlace.coordinates.lng.toString());
                          if(!title) setTitle(selectedPlace.name);
                        } else {
                          setLat(''); setLng('');
                        }
                      }}
                    >
                      <option value="">-- Selecciona el negocio mapeado --</option>
                      {places.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Cliente / Cuenta</label>
                    <select required value={clientId} onChange={e => setClientId(e.target.value)} className="w-full border-slate-300 rounded-lg text-sm bg-slate-50">
                      <option value="">-- Selecciona el negocio --</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-600 mb-1 flex justify-between">
                       Radio de Impacto <span>{radiusMeters} metros</span>
                     </label>
                     <input type="range" min="100" max="1500" step="100" value={radiusMeters} onChange={e => setRadiusMeters(Number(e.target.value))} className="w-full mt-2" />
                     <p className="text-[10px] text-slate-400 mt-1">Distancia máx. desde la parada de destino del usuario.</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 border-t border-slate-100 pt-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Emoji</label>
                    <input required value={icon} onChange={e => setIcon(e.target.value)} className="w-full border-slate-300 rounded-lg text-sm text-center text-xl" />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Título de la Promoción (Hook)</label>
                    <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: ¡Ya casi llegas! Descuento relámpago" className="w-full border-slate-300 rounded-lg text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Descripción (Contexto de Última Milla)</label>
                    <textarea required value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej: Estás a 3 minutos caminando. Presenta tu app y obtén..." className="w-full border-slate-300 rounded-lg text-sm h-16 resize-none"></textarea>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1"><MousePointerClick size={14}/> Botón (Call to Action)</label>
                    <input required value={callToAction} onChange={e => setCallToAction(e.target.value)} placeholder="Ej: Llevarme ahí" className="w-full border-slate-300 rounded-lg text-sm bg-blue-50 text-blue-800 font-medium" />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1"><CalendarIcon size={14}/> Programación (Calendario)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Inicio de Campaña</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Fin / Caducidad</label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border-slate-300 rounded-lg text-sm" />
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t border-slate-100 shrink-0 bg-white">
              <button type="button" onClick={() => {setIsCampaignModalOpen(false); resetCampaignForm();}} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button type="submit" form="campaign-form" className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg">{editingAdId ? 'Guardar Cambios' : 'Activar Promoción'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CLIENT */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="bg-blue-600 p-4 text-white">
              <h2 className="font-bold text-lg">Nuevo Negocio Local</h2>
            </div>
            <form onSubmit={handleClientSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nombre del Local / Pyme</label>
                <input required value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Ej: Taquería El Paisa" className="w-full border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Contacto / Email</label>
                <input value={clientContact} onChange={e => setClientContact(e.target.value)} placeholder="Ej: WhatsApp o Correo" className="w-full border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsClientModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
