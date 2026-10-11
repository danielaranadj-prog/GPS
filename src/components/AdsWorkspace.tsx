import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Target, Megaphone, Trash2, AlertCircle, Calendar as CalendarIcon, Users, Sparkles, Edit2, Play, Pause, Filter, MapPin, MousePointerClick, Eye, ExternalLink, Download, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { db } from '../db';
import type { AdCampaign, Client, AdType } from '../types';

export const AdsWorkspace: React.FC = () => {
  const allAds = useLiveQuery(() => db.ads.toArray()) || [];
  const places = useLiveQuery(() => db.places.toArray()) || [];
  const clients = useLiveQuery(() => db.clients.toArray()) || [];
  
  const [activeTab, setActiveTab] = useState<'campaigns' | 'calendar' | 'clients' | 'formats'>('formats');
  
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Filters
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Campaign Form state
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [type, setType] = useState<AdType>('pin');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🍔');
  const [referenceText, setReferenceText] = useState('');
  const [promoText, setPromoText] = useState('');
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
      referenceText: type === 'landmark' ? referenceText : undefined,
      promoText: type === 'landmark' ? promoText : undefined,
      routeIds: [],
      coordinates: (lat && lng) ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined,
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
    setReferenceText(ad.referenceText || '');
    setPromoText(ad.promoText || '');
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
    setEditingAdId(null); setTitle(''); setDescription(''); setIcon('🍔'); setReferenceText(''); setPromoText(''); setLat(''); setLng(''); setType('pin'); setStartDate(''); setEndDate(''); setClientId(''); setRadiusMeters(300); setCallToAction('Llevarme ahí');
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

  const exportAdsJson = async () => {
    const campaigns = await db.ads.toArray();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(campaigns, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "ads.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const prevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };
  const resetToToday = () => {
    setCalendarDate(new Date());
  };

  const seedSampleAds = async () => {
    const defaultClients: Client[] = [
      { id: 'client-cafe-de-olla', name: 'Café de Olla', contactEmail: 'contacto@cafedeolla.mx', createdAt: new Date().toISOString() },
      { id: 'client-burger-lab', name: 'Burger Lab', contactEmail: 'hola@burgerlab.mx', createdAt: new Date().toISOString() },
      { id: 'client-farmacia', name: 'Farmacia Popular', contactEmail: 'farmacia@uan.mx', createdAt: new Date().toISOString() }
    ];
    for (const c of defaultClients) {
      if (!(await db.clients.get(c.id))) await db.clients.add(c);
    }

    const defaultAds: AdCampaign[] = [
      {
        id: 'ad-cafe-de-olla-centro',
        clientId: 'client-cafe-de-olla',
        type: 'landmark',
        title: 'Café de Olla Centro',
        description: 'Café tradicional de olla y desayunos a unos pasos de la Catedral.',
        icon: '☕',
        referenceText: 'frente a Café de Olla (casi esquina Libertad)',
        promoText: '15% desc. en barra mostrando tu trayecto',
        coordinates: { lat: 21.51205, lng: -104.89152 },
        radiusMeters: 350,
        callToAction: 'Ver cupón',
        isActive: true,
        routeIds: [],
        createdAt: new Date().toISOString()
      },
      {
        id: 'ad-burger-lab-forum',
        clientId: 'client-burger-lab',
        type: 'landmark',
        title: 'Burger Lab Forum',
        description: 'Hamburguesas artesanales y malteadas sobre el boulevard de acceso.',
        icon: '🍔',
        referenceText: 'a pasos de Burger Lab Forum',
        promoText: 'Combo Viajero 2x1 al descender',
        coordinates: { lat: 21.49179, lng: -104.86640 },
        radiusMeters: 350,
        callToAction: 'Aprovechar 2x1',
        isActive: true,
        routeIds: [],
        createdAt: new Date().toISOString()
      },
      {
        id: 'ad-pin-forum',
        clientId: 'client-burger-lab',
        type: 'pin',
        title: 'Burger Lab (Pin Dorado)',
        description: 'Marcador dorado destacado sobre las rutas de Forum.',
        icon: '⭐',
        coordinates: { lat: 21.49179, lng: -104.86640 },
        radiusMeters: 400,
        callToAction: 'Cómo llegar',
        isActive: true,
        routeIds: [],
        createdAt: new Date().toISOString()
      }
    ];
    for (const ad of defaultAds) {
      if (!(await db.ads.get(ad.id))) await db.ads.add(ad);
    }
  };

  const renderCalendar = () => {
    const today = new Date();
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];

    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="bg-slate-50/60 border border-slate-100 min-h-[105px]"></div>);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = isCurrentMonth && d === today.getDate();

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
        <div key={`day-${d}`} className={`bg-white border border-slate-200 min-h-[105px] p-1.5 flex flex-col transition hover:bg-slate-50/40 ${isToday ? 'ring-2 ring-blue-500/30' : ''}`}>
          <div className="flex justify-between items-center mb-1">
            <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
              {d}
            </span>
            {dayAds.length > 0 && (
              <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-full">
                {dayAds.length} {dayAds.length === 1 ? 'ad' : 'ads'}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {dayAds.map(ad => {
              const badgeStyle = 
                ad.type === 'landmark' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                ad.type === 'pin' ? 'bg-amber-50 text-amber-900 border-amber-200' :
                ad.type === 'adsense' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                'bg-blue-50 text-blue-800 border-blue-200';

              return (
                <div 
                  key={ad.id} 
                  onClick={() => openEditModal(ad)} 
                  className={`text-[10px] px-1.5 py-0.5 rounded border truncate cursor-pointer hover:shadow-xs transition flex items-center gap-1 font-medium ${badgeStyle} ${!ad.isActive ? 'opacity-50 line-through' : ''}`}
                  title={`${ad.title} (${ad.type}) - Haz clic para editar`}
                >
                  <span className="shrink-0">{ad.icon}</span> 
                  <span className="truncate">{ad.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {/* Month Navigation & Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition"
              title="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-base font-bold text-slate-800 min-w-[170px] text-center">
              {monthNames[month]} {year}
            </h2>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition"
              title="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={resetToToday}
              className="ml-2 text-xs font-semibold px-2.5 py-1 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition"
            >
              Hoy
            </button>
          </div>

          {/* Format Legend & Action */}
          <div className="flex items-center flex-wrap gap-2 text-[11px]">
            <span className="flex items-center gap-1 bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded font-medium">
              <span>🚏</span> Ad Invisible
            </span>
            <span className="flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded font-medium">
              <span>📍</span> Pin Dorado
            </span>
            <span className="flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-medium">
              <span>🏷️</span> Banner
            </span>
            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-medium">
              <span>🌐</span> AdSense
            </span>

            {allAds.length === 0 && (
              <button
                type="button"
                onClick={seedSampleAds}
                className="ml-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-3 py-1 rounded-lg flex items-center gap-1 transition shadow-xs"
              >
                <RefreshCw size={12} /> Cargar Campañas de Prueba
              </button>
            )}
          </div>
        </div>

        {/* Days Grid */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
              <div key={day} className="py-2.5 text-center text-xs font-bold text-slate-600 border-r border-slate-200 last:border-0">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 bg-slate-200 gap-px">{days}</div>
        </div>
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
          <button 
            type="button"
            onClick={exportAdsJson} 
            className="border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition shadow-sm bg-white"
            title="Descargar archivo ads.json para sincronizar con PorDondePasa"
          >
            <Download size={15} className="text-amber-600" /> Exportar ads.json
          </button>
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
            onClick={() => setActiveTab('formats')} 
            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'formats' ? 'border-amber-500 text-amber-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Eye size={16} /> Catálogo de Formatos & Mockups
          </button>
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
        {/* TAB: FORMATS & MOCKUPS */}
        {activeTab === 'formats' && (
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 rounded-2xl p-6 text-white shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <span className="bg-white/20 backdrop-blur-sm text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Ecosistema Publicitario PorDondePasa
                  </span>
                  <h2 className="text-2xl font-bold mt-2">Formatos de Pauta & Ejemplos en Vivo</h2>
                  <p className="text-amber-100 text-sm mt-1 max-w-2xl">
                    Visualiza cómo interactúan los usuarios con cada tipo de anuncio en la aplicación móvil de pasajeros. Diseñado para monetizar sin romper la utilidad pública del transporte.
                  </p>
                </div>
                <button
                  onClick={() => { resetCampaignForm(); setType('landmark'); setIsCampaignModalOpen(true); }}
                  className="bg-white text-amber-700 hover:bg-amber-50 px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition"
                >
                  <Plus size={16}/> Crear Nueva Campaña
                </button>
              </div>
            </div>

            {/* FORMAT 1: AD INVISIBLE */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
              <div className="lg:col-span-5 p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🚏</span>
                    <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full">
                      Formato Innovador · Alta Retención
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mt-3">Ad Invisible (Hito de Bajada)</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Sustituye la clásica instrucción genérica <em>"Prepárate para bajar en la próxima parada"</em> por un hito urbano patrocinado:
                    <strong className="text-purple-700 block mt-1">"Prepárate para bajar frente a [Nombre del Local]"</strong>
                  </p>

                  <div className="mt-4 bg-purple-50 rounded-xl p-4 border border-purple-100 space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-purple-900">
                      <span>🎯 Momento de Impacto:</span>
                    </div>
                    <p className="text-purple-800">
                      Se activa cuando el pasajero está en la micro a <strong>menos de 350 metros</strong> de descender. Atención del usuario al 100%.
                    </p>
                    <div className="border-t border-purple-200/60 pt-2 text-[11px] text-purple-700">
                      ✨ <strong>Percepción del usuario:</strong> La app lo orienta con referencias reales de la ciudad en vez de molestarlo con pop-ups.
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-2">
                  <button
                    onClick={() => { resetCampaignForm(); setType('landmark'); setIsCampaignModalOpen(true); }}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus size={14}/> Configurar Ad Invisible
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 bg-slate-100 p-6 flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between text-xs">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Mockup Real: Modo Navegación
                    </span>
                    <span className="text-[10px] text-slate-400">PorDondePasa iOS/Android</span>
                  </div>
                  <img
                    src="/mockups/ad_invisible.jpg"
                    alt="Mockup Ad Invisible"
                    className="w-full h-auto object-cover max-h-[380px]"
                  />
                </div>
              </div>
            </div>

            {/* FORMAT 2: PIN DORADO */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
              <div className="lg:col-span-5 p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📍</span>
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">
                      Presencia en Mapa · Brand Awareness
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mt-3">Pins Dorados (Marcadores Sponsor)</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    El negocio cobra vida en el mapa interactivo de MapLibre a lo largo de las rutas de micro con un pin dorado brillante, halo iluminado y badge de sponsor.
                  </p>

                  <div className="mt-4 bg-amber-50 rounded-xl p-4 border border-amber-100 space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <span>🎯 Momento de Impacto:</span>
                    </div>
                    <p className="text-amber-800">
                      Visible mientras el usuario explora rutas, espera su micro o revisa el trazado en el mapa general.
                    </p>
                    <div className="border-t border-amber-200/60 pt-2 text-[11px] text-amber-700">
                      ⭐ Al presionar el pin, se despliega tarjeta de descuento y botón <em>"Cómo llegar"</em>.
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-2">
                  <button
                    onClick={() => { resetCampaignForm(); setType('pin'); setIsCampaignModalOpen(true); }}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus size={14}/> Configurar Pin Dorado
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 bg-slate-100 p-6 flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between text-xs">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span> Mockup Real: Mapa con Pin Dorado
                    </span>
                    <span className="text-[10px] text-slate-400">MapLibre GL Vector</span>
                  </div>
                  <img
                    src="/mockups/pin_dorado.jpg"
                    alt="Mockup Pin Dorado"
                    className="w-full h-auto object-cover max-h-[380px]"
                  />
                </div>
              </div>
            </div>

            {/* FORMAT 3: GOOGLE ADSENSE */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
              <div className="lg:col-span-5 p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🌐</span>
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">
                      Monetización Pasiva · Programática
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mt-3">Google AdSense (Display Nativo)</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Banner programático que llena inventario automáticamente cuando no hay un negocio local contratando la zona. Integrado entre las opciones de viaje de forma limpia.
                  </p>

                  <div className="mt-4 bg-emerald-50 rounded-xl p-4 border border-emerald-100 space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-emerald-900">
                      <span>🎯 Momento de Impacto:</span>
                    </div>
                    <p className="text-emerald-800">
                      Entre la lista de rutas encontradas (<em>"Línea 4 Directo"</em> vs <em>"Línea 7"</em>) y en la pantalla de llegada.
                    </p>
                    <div className="border-t border-emerald-200/60 pt-2 text-[11px] text-emerald-700">
                      🛡️ Cero invasivo: Cumple con las políticas de UX de Google Maps y AdSense móvil.
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-2">
                  <button
                    onClick={() => { resetCampaignForm(); setType('adsense'); setIsCampaignModalOpen(true); }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus size={14}/> Activar AdSense
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 bg-slate-100 p-6 flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between text-xs">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Mockup Real: Lista de Rutas
                    </span>
                    <span className="text-[10px] text-slate-400">Responsive Native Card</span>
                  </div>
                  <img
                    src="/mockups/adsense.jpg"
                    alt="Mockup Google AdSense"
                    className="w-full h-auto object-cover max-h-[380px]"
                  />
                </div>
              </div>
            </div>
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
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-slate-800 truncate">{ad.title}</h3>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${ad.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {ad.isActive ? <Play size={10}/> : <Pause size={10}/>}
                            {ad.isActive ? 'ACTIVO' : 'PAUSADO'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 mb-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            ad.type === 'landmark' ? 'bg-purple-100 text-purple-700 font-bold' :
                            ad.type === 'pin' ? 'bg-amber-100 text-amber-800' :
                            ad.type === 'adsense' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {ad.type === 'landmark' ? '🚏 Ad Invisible (Hito)' :
                             ad.type === 'pin' ? '📍 Pin Dorado' :
                             ad.type === 'adsense' ? '🌐 AdSense Google' :
                             '🏷️ Banner Nativo'}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate">{client ? client.name : 'Sin Negocio'}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ad.description}</p>

                        {ad.type === 'landmark' && ad.referenceText && (
                          <div className="mt-2 bg-purple-50 border border-purple-200/80 p-2 rounded text-[11px] text-purple-900">
                            <span className="font-bold block">Referencia de Bajada:</span> "{ad.referenceText}"
                            {ad.promoText && <span className="text-[10px] text-purple-700 block mt-0.5 font-medium">Promo: {ad.promoText}</span>}
                          </div>
                        )}

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

                {/* SELECTOR DE FORMATO DE ANUNCIO */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Formato Publicitario</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setType('landmark')}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition ${
                        type === 'landmark' ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-500/20' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-base mb-1">🚏</span>
                      <span className="text-xs font-bold text-slate-800">Ad Invisible</span>
                      <span className="text-[10px] text-slate-500 leading-tight">Hito de bajada contextual</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setType('pin')}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition ${
                        type === 'pin' ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-base mb-1">📍</span>
                      <span className="text-xs font-bold text-slate-800">Pin Dorado</span>
                      <span className="text-[10px] text-slate-500 leading-tight">Marcador sponsor en mapa</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setType('banner')}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition ${
                        type === 'banner' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-base mb-1">🏷️</span>
                      <span className="text-xs font-bold text-slate-800">Banner Nativo</span>
                      <span className="text-[10px] text-slate-500 leading-tight">Detalle de ruta / llegada</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setType('adsense')}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition ${
                        type === 'adsense' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-base mb-1">🌐</span>
                      <span className="text-xs font-bold text-slate-800">Google AdSense</span>
                      <span className="text-[10px] text-slate-500 leading-tight">Programático pasivo</span>
                    </button>
                  </div>

                  {type === 'landmark' && (
                    <div className="mt-2 p-2.5 bg-purple-50/70 border border-purple-200 rounded-lg text-[11px] text-purple-900 leading-relaxed">
                      💡 <strong>¿Cómo funciona el Ad Invisible?</strong> Cuando el pasajero viene en la micro y se encuentra a menos de 350m de bajarse, la app reemplaza el aviso genérico por: <em>"Prepárate para bajar frente a [Referencia]"</em>. Es 100% natural y sirve de guía real de orientación.
                    </div>
                  )}
                  {type === 'pin' && (
                    <div className="mt-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-relaxed">
                      💡 <strong>Pin Dorado:</strong> Destaca el negocio con un icono dorado brillante a lo largo de las rutas de micro en el mapa interactivo de PorDondePasa.
                    </div>
                  )}
                  {type === 'banner' && (
                    <div className="mt-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-[11px] text-blue-900 leading-relaxed">
                      💡 <strong>Banner Nativo:</strong> Aparece como sugerencia de última milla al pie del trayecto a pie hacia el destino.
                    </div>
                  )}
                  {type === 'adsense' && (
                    <div className="mt-2 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 leading-relaxed">
                      💡 <strong>Google AdSense:</strong> Formato display programático no intrusivo intercalado en los resultados de búsqueda de viaje.
                    </div>
                  )}

                  {/* VISTA PREVIA VISUAL DEL FORMATO DENTRO DEL MODAL */}
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-slate-700 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Eye size={13} className="text-amber-500"/> Vista previa de cómo lucirá en la app del pasajero:</span>
                      <span className="text-[10px] text-slate-400 font-normal">Mockup de producción</span>
                    </p>
                    <div className="rounded-lg overflow-hidden border border-slate-200 bg-white max-h-[160px] flex items-center justify-center">
                      <img 
                        src={
                          type === 'landmark' ? '/mockups/ad_invisible.jpg' :
                          type === 'pin' ? '/mockups/pin_dorado.jpg' :
                          type === 'adsense' ? '/mockups/adsense.jpg' :
                          '/mockups/ad_invisible.jpg'
                        }
                        alt="Previsualización de formato"
                        className="w-full h-auto object-cover object-top max-h-[160px]"
                      />
                    </div>
                  </div>
                </div>
                
                {/* REQUIRED LOCATION BINDING FOR LOCAL ADS */}
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                  <p className="text-xs text-amber-800 font-bold mb-3 flex items-center gap-1"><MapPin size={14}/> Ubicación del Negocio</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Negocio registrado en el catálogo de lugares</label>
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
                          if(type === 'landmark' && !referenceText) setReferenceText(`frente a ${selectedPlace.name}`);
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

                {/* CONDITIONAL LANDMARK FIELDS */}
                {type === 'landmark' && (
                  <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-200 space-y-3">
                    <p className="text-xs text-purple-900 font-bold flex items-center gap-1.5">
                      🚏 Configuración de Hito de Bajada (Ad Invisible)
                    </p>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Frase de Referencia de Bajada *
                      </label>
                      <input
                        required={type === 'landmark'}
                        value={referenceText}
                        onChange={e => setReferenceText(e.target.value)}
                        placeholder="Ej: frente a Café de Olla (casi esquina Libertad)"
                        className="w-full border-purple-300 focus:border-purple-500 rounded-lg text-sm bg-white"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Se insertará en el aviso: <em>"Prepárate para bajar {referenceText || '[referencia]'}"</em>
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Beneficio o Gancho Promocional (Opcional)
                      </label>
                      <input
                        value={promoText}
                        onChange={e => setPromoText(e.target.value)}
                        placeholder="Ej: 15% desc. en barra mostrando tu trayecto"
                        className="w-full border-slate-300 rounded-lg text-sm bg-white"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Aparece sutilmente como subtítulo en la alerta de proximidad de parada.</p>
                    </div>
                  </div>
                )}

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
                    <label className="block text-xs font-bold text-slate-600 mb-1">Emoji / Icono</label>
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
