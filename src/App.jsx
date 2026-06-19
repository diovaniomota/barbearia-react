import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  PhoneForwarded,
  Plus,
  RefreshCw,
  Repeat,
  Save,
  Scissors,
  Search,
  Send,
  Shield,
  Trash2,
  User,
  UserRound,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { ensureUserRow, loadAdminSession, SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from './supabaseClient.js';
import {
  addDays,
  addMinutes,
  cx,
  dateKey,
  dateWithTime,
  durationLabel,
  formatDate,
  formatDateTime,
  formatPhone,
  greeting,
  hhmm,
  isPastAppointment,
  maskPhoneInput,
  minutesToLabel,
  money,
  normalizePhone,
  numberFromCurrency,
  parseTimeToMinutes,
  periodBounds,
  serviceFromRow,
  sortServices,
  timeKey,
} from './utils.js';
import {
  buildMessage,
  checkWhatsappStatus,
  fetchWhatsappQr,
  isConfigured,
  loadWhatsappConfig,
  resetWhatsappSession,
  saveWhatsappConfig,
  sendWhatsappMessage,
} from './whatsapp.js';

const logo = '/logo.png';
const weekDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const periodOptions = [
  { value: 'day', label: 'Dia' },
  { value: 'month', label: 'Mês' },
  { value: 'year', label: 'Ano' },
];

const ToastContext = createContext(null);

function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<RoleChoice />} />
        <Route path="/agendamentocliente" element={<ClientShell />} />
        <Route path="/admin" element={<LoginScreen />} />
        <Route path="/admin/dashboard" element={<AdminShell />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}

function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = (message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
    window.clearTimeout(show._timer);
    show._timer = window.setTimeout(() => setToast(null), 3600);
  };
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <div className={cx('toast', toast.type)}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

function useToast() {
  return useContext(ToastContext);
}

function Logo({ size = 112 }) {
  return (
    <img
      className="logo"
      src={logo}
      alt="TD Barbearia"
      style={{ width: size, height: size }}
      onError={(event) => {
        event.currentTarget.style.display = 'none';
      }}
    />
  );
}

function LoadingPage({ label = 'Carregando...' }) {
  return (
    <div className="page center-page">
      <div className="spinner" />
      <p className="muted">{label}</p>
    </div>
  );
}

function EmptyState({ icon: Icon = Scissors, title, subtitle, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={32} />
      </div>
      <strong>{title}</strong>
      {subtitle ? <span>{subtitle}</span> : null}
      {action}
    </div>
  );
}

function RoleChoice() {
  const navigate = useNavigate();
  const goClient = () => {
    supabase.auth.signOut().catch(() => {});
    navigate('/agendamentocliente');
  };

  return (
    <main className="role-page">
      <section className="role-card">
        <Logo size={110} />
        <h1>
          Você é cliente
          <br />
          ou admin?
        </h1>
        <p>Selecione para continuar</p>
        <button className="primary-btn" type="button" onClick={goClient}>
          Cliente
        </button>
        <button className="outline-btn" type="button" onClick={() => navigate('/admin')}>
          Admin
        </button>
      </section>
    </main>
  );
}

function ClientShell() {
  const [tab, setTab] = useState('home');
  const [bookingService, setBookingService] = useState(null);
  const navItems = [
    { key: 'home', label: 'Agendar', icon: CalendarDays, activeIcon: CalendarDays },
    { key: 'history', label: 'Histórico', icon: Clock, activeIcon: Clock },
  ];

  return (
    <div className="app-shell client-shell">
      {tab === 'home' ? <ClientHome onBook={setBookingService} /> : <CustomerHistory />}
      <FloatingNav items={navItems} value={tab} onChange={setTab} />
      {bookingService ? (
        <BookingScreen initialService={bookingService} onClose={() => setBookingService(null)} />
      ) : null}
    </div>
  );
}

function FloatingNav({ items, value, onChange }) {
  return (
    <nav className="floating-nav" aria-label="Navegação">
      {items.map((item) => {
        const selected = item.key === value;
        const Icon = selected ? item.activeIcon : item.icon;
        return (
          <button
            key={item.key}
            type="button"
            className={cx('nav-item', selected && 'selected')}
            onClick={() => onChange(item.key)}
          >
            <span className="nav-icon">
              <Icon size={22} />
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ClientHome({ onBook }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.from('services').select('*').order('name');
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setServices(sortServices((data ?? []).map(serviceFromRow)).filter((s) => s.is_active !== false));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="page with-bottom-nav">
      <header className="client-header">
        <div className="logo-wrap">
          <Logo size={120} />
          <span className="count-badge">
            <b>{services.length}</b>
            <em>{services.length === 1 ? 'serviço' : 'serviços'}</em>
          </span>
        </div>
        <div className="greeting-line">
          <span className="gold-dot" />
          <span className="gold-text">{greeting()}!</span>
          <strong>O que vai ser hoje?</strong>
        </div>
        <div className="section-divider">
          <span />
          <small>SERVIÇOS</small>
          <span />
        </div>
      </header>

      {loading ? (
        <div className="stack">
          <div className="service-skeleton" />
          <div className="service-skeleton" />
          <div className="service-skeleton" />
        </div>
      ) : error ? (
        <EmptyState icon={Wifi} title="Sem conexão" subtitle="Puxe para baixo e tente novamente." action={<button className="small-btn" onClick={load}>Tentar novamente</button>} />
      ) : services.length === 0 ? (
        <EmptyState title="Nenhum serviço" subtitle="Os serviços vão aparecer aqui." />
      ) : (
        <div className="service-list">
          {services.map((service) => (
            <button className="service-photo-card" type="button" key={service.id} onClick={() => onBook(service)}>
              {service.image_url ? <img src={service.image_url} alt="" /> : <div className="service-placeholder"><Scissors size={52} /></div>}
              <span className="photo-gradient" />
              <span className="service-info">
                <strong>{service.name.toUpperCase()}</strong>
                <span>
                  <b>{money(service.price)}</b>
                  <em>·</em>
                  {durationLabel(service.duration_blocks)}
                </span>
                {service.description ? <small>{service.description}</small> : null}
              </span>
              <span className="arrow-box">
                <ArrowRight size={16} />
              </span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

function CustomerHistory() {
  const toast = useToast();
  const { confirm, ConfirmUI } = useConfirm();
  const [phone, setPhone] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [showModal, setShowModal] = useState(true);

  const doLoad = async (rawPhone) => {
    const digits = normalizePhone(rawPhone);
    if (digits.length < 10) {
      toast('Informe um telefone válido.', 'warn');
      return false;
    }
    setLoading(true);
    const candidates = [...new Set([digits, formatPhone(digits), rawPhone.trim()].filter(Boolean))];
    const rows = [];
    const seen = new Set();
    for (const candidate of candidates) {
      const { data, error } = await supabase
        .from('appointments')
        .select('id,barber_id,service_id,appointment_date,appointment_time,status,customer_name,customer_phone,notes,total_price,created_at,barbers:barber_id(name,phone),services:service_id(name,price)')
        .eq('customer_phone', candidate)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });
      if (error) {
        setLoading(false);
        toast(`Erro ao buscar histórico: ${error.message}`, 'error');
        return false;
      }
      for (const row of data ?? []) {
        if (!seen.has(row.id)) { seen.add(row.id); rows.push(row); }
      }
    }
    setPhone(rawPhone);
    setBookings(groupBookingRows(rows));
    setLoading(false);
    return true;
  };

  const cancelBooking = async (booking) => {
    const ok = await confirm('Cancelar este agendamento?', { title: 'Cancelar agendamento', confirmLabel: 'Sim, cancelar', cancelLabel: 'Não', confirmClass: 'danger-btn' });
    if (!ok) return;
    setLoading(true);
    try {
      for (const id of booking.ids) {
        const { error } = await supabase.rpc('set_customer_appointment_status', {
          p_appointment_id: id,
          p_phone: phone,
          p_status: 'cancelled',
        });
        if (error) throw error;
      }
      await doLoad(phone);
      toast('Agendamento cancelado.', 'success');
    } catch (error) {
      setLoading(false);
      toast(`Não foi possível cancelar: ${error.message}`, 'error');
    }
  };

  const customerName = bookings[0]?.customerName || null;

  return (
    <main className="page with-bottom-nav">
      <header className="history-header">
        <div className="history-header-row">
          <h1>Histórico</h1>
          <button className="icon-btn gold" type="button" onClick={() => setShowModal(true)} aria-label="Trocar telefone">
            <PhoneForwarded size={20} />
          </button>
        </div>
        {phone ? (
          <span className="history-subtitle">
            {customerName ? `${customerName} · ` : ''}{formatPhone(phone)}
            {bookings.length > 0 ? ` · ${bookings.length} agendamento${bookings.length !== 1 ? 's' : ''}` : ''}
          </span>
        ) : null}
      </header>

      {loading ? (
        <LoadingBlock />
      ) : bookings.length === 0 ? (
        <EmptyState icon={Clock} title="Nenhum agendamento" subtitle="Busque pelo telefone usado no agendamento." />
      ) : (
        <div className="stack">
          {bookings.map((booking, index) => {
            const open = expanded === index;
            const cancelled = String(booking.status).includes('cancel');
            return (
              <article className="admin-card" key={booking.key}>
                <button className="card-click" type="button" onClick={() => setExpanded(open ? null : index)}>
                  <div>
                    <strong>{formatDateTime(booking.dateTime)}</strong>
                    <span className="muted">{booking.barberName || 'Barbeiro'} · {booking.services.join(', ')}</span>
                  </div>
                  <span className={cx('status-pill', cancelled ? 'red' : 'gold')}>{booking.status || 'scheduled'}</span>
                </button>
                {open ? (
                  <div className="card-details">
                    <p>{booking.customerName || 'Cliente'}</p>
                    <p>{formatPhone(booking.phone)}</p>
                    <p>Total: {money(booking.total)}</p>
                    {!cancelled ? (
                      <button className="danger-btn" type="button" onClick={() => cancelBooking(booking)}>
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {showModal && (
        <PhoneLookupModal
          initial={phone}
          onConfirm={async (p) => { const ok = await doLoad(p); if (ok) setShowModal(false); }}
          onCancel={() => setShowModal(false)}
        />
      )}
      {ConfirmUI}
    </main>
  );
}

function PhoneLookupModal({ initial, onConfirm, onCancel }) {
  const [value, setValue] = useState(initial ? formatPhone(initial) : '');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => onConfirm(value);

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div className="phone-lookup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="phone-lookup-title-row">
          <span className="phone-lookup-icon"><Search size={20} /></span>
          <strong>Buscar histórico</strong>
        </div>
        <p className="phone-lookup-label">Celular usado no agendamento</p>
        <div className="phone-lookup-input-row">
          <Phone size={18} className="phone-lookup-phone-icon" />
          <input
            ref={inputRef}
            type="tel"
            inputMode="tel"
            value={value}
            onChange={(e) => setValue(maskPhoneInput(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="(00) 00000-0000"
            className="phone-lookup-input"
          />
        </div>
        <div className="phone-lookup-actions">
          <button className="outline-btn" type="button" onClick={onCancel}>Agora não</button>
          <button className="primary-btn" type="button" onClick={submit}>Consultar</button>
        </div>
      </div>
    </div>
  );
}

function groupBookingRows(rows) {
  const sorted = [...rows].sort((a, b) => appointmentDateTime(a) - appointmentDateTime(b));
  const groups = [];
  for (const row of sorted) {
    const dt = appointmentDateTime(row);
    const phone = row.customer_phone || '';
    const serviceName = row.services?.name || '';
    let match = groups.find((g) => {
      const same = g.phone === phone && g.barberId === row.barber_id && g.date === row.appointment_date && g.status === row.status;
      return same && dt.getTime() - g.lastDateTime.getTime() === 30 * 60 * 1000;
    });
    if (!match) {
      match = {
        key: `${row.id}-${dt.getTime()}`,
        ids: [],
        phone,
        barberId: row.barber_id,
        barberName: row.barbers?.name ?? '',
        customerName: row.customer_name ?? '',
        date: row.appointment_date,
        dateTime: dt,
        lastDateTime: dt,
        status: row.status,
        total: 0,
        services: [],
      };
      groups.push(match);
    }
    match.ids.push(row.id);
    match.lastDateTime = dt;
    match.total += Number(row.total_price ?? row.services?.price ?? 0);
    if (serviceName && !match.services.includes(serviceName)) match.services.push(serviceName);
  }
  return groups.sort((a, b) => b.dateTime - a.dateTime);
}

function appointmentDateTime(row) {
  return dateWithTime(`${row.appointment_date || dateKey(new Date())}T00:00:00`, hhmm(row.appointment_time || '00:00'));
}

function LoadingBlock() {
  return (
    <div className="loading-block">
      <div className="spinner" />
    </div>
  );
}

function BookingScreen({ initialService, onClose, adminContext = null, fixedSlot = null, onSaved }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState(initialService ? [initialService] : []);
  const [barbers, setBarbers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(fixedSlot?.date ?? null);
  const [datePage, setDatePage] = useState(0);
  const [selectedBarberId, setSelectedBarberId] = useState(fixedSlot?.barberId ?? '');
  const [availability, setAvailability] = useState({});
  const [slots, setSlots] = useState([]);
  const [takenSlots, setTakenSlots] = useState(new Set());
  const [selectedTime, setSelectedTime] = useState(fixedSlot?.time ?? '');
  const [name, setName] = useState(() => localStorage.getItem('client_name') || '');
  const [phone, setPhone] = useState(() => formatPhone(localStorage.getItem('client_phone_raw') || ''));
  const [isPlanClient, setIsPlanClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const totalBlocks = Math.max(selectedServices.reduce((sum, s) => sum + Number(s.duration_blocks || 1), 0), 1);
  const selectedBarber = barbers.find((b) => b.id === selectedBarberId);
  const selectedDateTime = selectedDate && selectedTime ? dateWithTime(selectedDate, selectedTime) : null;

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [servicesRes, barbersRes] = await Promise.all([
        supabase.from('services').select('*').order('name'),
        supabase.from('barbers').select('*').order('name'),
      ]);
      if (servicesRes.error) toast(`Erro ao carregar serviços: ${servicesRes.error.message}`, 'error');
      if (barbersRes.error) toast(`Erro ao carregar barbeiros: ${barbersRes.error.message}`, 'error');
      setServices(sortServices((servicesRes.data ?? []).map(serviceFromRow)).filter((s) => s.is_active !== false));
      setBarbers((barbersRes.data ?? []).map((b) => ({ ...b, id: String(b.id), is_available: b.is_available ?? true })));
      setLoading(false);
    }
    load();
  }, [toast]);

  useEffect(() => {
    if (!selectedDate || barbers.length === 0) return;
    loadBarberAvailability(selectedDate, barbers).then(setAvailability).catch(() => setAvailability({}));
  }, [selectedDate, barbers]);

  useEffect(() => {
    if (!selectedDate || !selectedBarberId) return;
    refreshSlots();
  }, [selectedDate, selectedBarberId, selectedServices.length]);

  useEffect(() => {
    const digits = normalizePhone(phone);
    if (digits.length < 10) {
      setIsPlanClient(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.from('plan_clients').select('id').eq('phone', digits).limit(1);
      setIsPlanClient((data ?? []).length > 0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [phone]);

  const refreshSlots = async () => {
    if (!selectedDate || !selectedBarberId) return;
    const { slotLabels, taken } = await loadSlotsForBarber(selectedDate, selectedBarberId);
    setSlots(slotLabels);
    setTakenSlots(taken);
    if (!fixedSlot) setSelectedTime('');
  };

  const slotFits = (startIndex) => {
    if (startIndex + totalBlocks > slots.length) return false;
    for (let i = 0; i < totalBlocks; i++) {
      if (takenSlots.has(slots[startIndex + i])) return false;
    }
    return true;
  };

  const validateNext = async () => {
    if (step === 0 && selectedServices.length === 0) return toast('Selecione ao menos um serviço.', 'warn');
    if (step === 1 && !selectedDate) return toast('Selecione uma data.', 'warn');
    if (step === 2 && !selectedBarberId) return toast('Selecione um barbeiro disponível.', 'warn');
    if (step === 3 && !selectedTime) return toast('Selecione um horário.', 'warn');
    if (step < 4) {
      // adminContext com fixedSlot: data/barbeiro/horário já fixos, pular direto para dados do cliente
      setStep(fixedSlot && step === 0 ? 4 : step + 1);
      return;
    }
    await saveAppointment();
  };

  const saveAppointment = async () => {
    if (saving) return;
    if (!selectedDateTime || !selectedBarberId || selectedServices.length === 0 || !name.trim() || normalizePhone(phone).length < 10) {
      toast('Preencha todos os campos antes de salvar.', 'warn');
      return;
    }
    setSaving(true);
    try {
      const wanted = Array.from({ length: totalBlocks }, (_, i) => hhmm(timeKey(addMinutes(selectedDateTime, i * 30))));
      const { data: existing, error: existingError } = await supabase
        .from('appointments')
        .select('appointment_time,status')
        .eq('barber_id', selectedBarberId)
        .eq('appointment_date', dateKey(selectedDateTime));
      if (existingError) throw existingError;
      const occupied = new Set((existing ?? [])
        .filter((row) => !['cancelled', 'canceled', 'no_show'].includes(String(row.status ?? '').toLowerCase()))
        .map((row) => hhmm(row.appointment_time)));
      if (wanted.some((time) => occupied.has(time))) {
        toast('Este horário acabou de ser ocupado. Escolha outro horário.', 'warn');
        setSaving(false);
        await refreshSlots();
        return;
      }

      const payload = [];
      let offset = 0;
      for (const service of selectedServices) {
        const blocks = Math.max(Number(service.duration_blocks || 1), 1);
        for (let i = 0; i < blocks; i++) {
          const slotDt = addMinutes(selectedDateTime, offset * 30);
          payload.push({
            service_id: service.id,
            barber_id: selectedBarberId,
            appointment_date: dateKey(slotDt),
            appointment_time: timeKey(slotDt),
            status: 'scheduled',
            customer_name: name.trim(),
            customer_phone: phone.trim(),
            notes: `Cliente: ${name.trim()}\nTelefone: ${phone.trim()}`,
            total_price: i === 0 ? Number(service.price || 0) : 0,
            is_plan_client: isPlanClient,
            source: adminContext ? 'admin' : 'client',
          });
          offset++;
        }
      }
      const { data, error } = await supabase.from('appointments').insert(payload).select();
      if (error) throw error;
      localStorage.setItem('client_name', name.trim());
      localStorage.setItem('client_phone_raw', normalizePhone(phone));
      toast('Agendamento confirmado.', 'success');
      sendBookingWhatsapp({ selectedServices, selectedBarber, selectedDateTime, name, phone });
      onSaved?.(data);
      onClose?.();
    } catch (error) {
      toast(`Falha ao agendar: ${error.message || error}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), datePage * 7 + i));
  const bookingControls = (
    <div className="booking-controls">
      <button className="primary-btn compact" type="button" disabled={saving} onClick={validateNext}>
        {saving ? 'Salvando...' : step === 4 ? 'Confirmar' : 'Continuar'}
      </button>
      <button className="ghost-btn" type="button" onClick={() => {
        if (step === 0) { onClose?.(); return; }
        // adminContext+fixedSlot: ao voltar do step 4, vai para step 0 (serviços)
        if (fixedSlot && step === 4) { setStep(0); return; }
        setStep((s) => Math.max(0, s - 1));
      }}>
        Voltar
      </button>
    </div>
  );

  return (
    <div className="screen-modal">
      <header className="modal-appbar">
        <button className="icon-btn" type="button" onClick={onClose} aria-label="Voltar">
          <ArrowLeft size={20} />
        </button>
        <h2>{adminContext && fixedSlot ? `Agendar • ${fixedSlot.time}` : adminContext ? 'Encaixe manual' : 'Agendar Horário'}</h2>
      </header>
      {loading ? (
        <LoadingPage />
      ) : (
        <main className="booking-body">
          <StepBox index={0} active={step === 0} done={step > 0} title="Escolha o Serviço" controls={bookingControls}>
            <p className="step-caption">Selecione um ou mais serviços:</p>
            <div className="stack">
              {services.map((service) => {
                const checked = selectedServices.some((s) => s.id === service.id);
                return (
                  <button
                    type="button"
                    key={service.id}
                    className={cx('select-row', checked && 'selected')}
                    onClick={() => {
                      setSelectedServices((current) =>
                        checked ? current.filter((s) => s.id !== service.id) : [...current, service]
                      );
                    }}
                  >
                    <span className="fake-check">{checked ? <Check size={16} /> : null}</span>
                    <span>
                      <strong>{service.name}</strong>
                      <small>{money(service.price)}  ·  {durationLabel(service.duration_blocks)}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </StepBox>

          <StepBox index={1} active={step === 1} done={step > 1} title="Escolha a Data" controls={bookingControls}>
            <p className="step-caption">Selecione o dia desejado:</p>
            <div className="date-strip">
              <button className="icon-btn" disabled={datePage === 0} onClick={() => setDatePage((v) => Math.max(0, v - 1))} aria-label="Semana anterior">
                <ChevronLeft size={22} />
              </button>
              <div className="day-grid">
                {days.map((day) => {
                  const selected = selectedDate && dateKey(selectedDate) === dateKey(day);
                  return (
                    <button
                      key={dateKey(day)}
                      type="button"
                      className={cx('day-chip', selected && 'selected')}
                      onClick={() => {
                        setSelectedDate(new Date(day.getFullYear(), day.getMonth(), day.getDate()));
                        setSelectedBarberId(fixedSlot?.barberId ?? '');
                        setSelectedTime(fixedSlot?.time ?? '');
                        setSlots([]);
                        setTakenSlots(new Set());
                      }}
                    >
                      <strong>{formatDate(day, { day: '2-digit', month: '2-digit' })}</strong>
                      <span>{formatDate(day, { weekday: 'short' }).replace('.', '')}</span>
                    </button>
                  );
                })}
              </div>
              <button className="icon-btn" disabled={datePage >= 7} onClick={() => setDatePage((v) => v + 1)} aria-label="Próxima semana">
                <ChevronRight size={22} />
              </button>
            </div>
            {selectedDate ? <p className="gold-text small-line"><CheckCircle2 size={16} /> {formatDate(selectedDate, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</p> : null}
          </StepBox>

          <StepBox index={2} active={step === 2} done={step > 2} title="Escolha o Barbeiro" controls={bookingControls}>
            <div className="stack">
              {barbers.map((barber) => {
                const unavailable = availability[barber.id] === false || barber.is_available === false;
                const selected = selectedBarberId === barber.id;
                return (
                  <button
                    key={barber.id}
                    type="button"
                    disabled={unavailable}
                    className={cx('barber-row', selected && 'selected', unavailable && 'disabled')}
                    onClick={() => setSelectedBarberId(barber.id)}
                  >
                    <Avatar src={barber.image_url || barber.avatar_url} name={barber.name} />
                    <span>
                      <strong>{barber.name}</strong>
                      {unavailable ? <small className="red-text">Indisponível nesta data</small> : null}
                    </span>
                    {selected ? <CheckCircle2 size={20} /> : null}
                  </button>
                );
              })}
            </div>
          </StepBox>

          <StepBox index={3} active={step === 3} done={step > 3} title="Escolha o Horário" controls={bookingControls}>
            {selectedDate ? <p className="gold-text small-line">{formatDate(selectedDate, { weekday: 'long', day: '2-digit', month: '2-digit' })}</p> : null}
            {totalBlocks > 1 ? <p className="hint"><Clock size={14} /> Este agendamento ocupa {totalBlocks} horários seguidos ({totalBlocks * 30} min).</p> : null}
            {slots.length === 0 || slots.every((_, i) => !slotFits(i) || takenSlots.has(slots[i])) ? (
              <div className="step-empty">
                <Calendar size={28} />
                <strong>Sem horários disponíveis nesta data!</strong>
                <span>Volte e escolha outro barbeiro ou data.</span>
              </div>
            ) : (
              <div className="time-grid">
                {slots.map((slot, index) => {
                  const disabled = takenSlots.has(slot) || !slotFits(index);
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={disabled}
                      className={cx('time-chip', selectedTime === slot && 'selected')}
                      onClick={() => setSelectedTime(slot)}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            )}
          </StepBox>

          <StepBox index={4} active={step === 4} done={false} title="Dados Pessoais" controls={bookingControls}>
            <div className="form-grid">
              <label className="booking-field">
                <span>Nome completo</span>
                <User size={20} />
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="booking-field">
                <span>Telefone</span>
                <Phone size={20} />
                <input value={phone} inputMode="tel" onChange={(e) => setPhone(maskPhoneInput(e.target.value))} placeholder="(00) 00000-0000" />
              </label>
              {isPlanClient ? <span className="plan-badge"><CreditCard size={16} /> Cliente Mensalista</span> : null}
            </div>
          </StepBox>
        </main>
      )}
    </div>
  );
}

function StepBox({ index, title, active, done, controls, children }) {
  return (
    <section className={cx('step-box', active && 'active', done && 'done')}>
      <header>
        <span>{done ? <Check size={15} /> : index + 1}</span>
        <h3>{title}</h3>
      </header>
      {active ? (
        <div className="step-content">
          {children}
          {controls}
        </div>
      ) : null}
    </section>
  );
}

function Avatar({ src, name }) {
  return (
    <span className="avatar">
      {src ? <img src={src} alt="" /> : <UserRound size={22} />}
      {!src ? <em>{String(name || 'T').slice(0, 1)}</em> : null}
    </span>
  );
}

async function loadBarberAvailability(selectedDate, barbers) {
  const dayOfWeek = selectedDate.getDay();
  const date = dateKey(selectedDate);
  const avail = {};

  const { data: avRows } = await supabase
    .from('barber_availability')
    .select('barber_id,is_available')
    .eq('day_of_week', dayOfWeek);
  for (const row of avRows ?? []) avail[String(row.barber_id)] = row.is_available ?? true;

  const { data: blocked } = await supabase
    .from('barber_blocked_days')
    .select('barber_id')
    .lte('date_from', date)
    .gte('date_to', date);
  for (const row of blocked ?? []) avail[String(row.barber_id)] = false;
  for (const barber of barbers) if (barber.is_available === false) avail[barber.id] = false;
  return avail;
}

async function loadSlotsForBarber(selectedDate, barberId) {
  const dayOfWeek = selectedDate.getDay();
  let start = '09:00';
  let end = '18:00';
  let enabled = true;
  let breakStart = null;
  let breakEnd = null;

  const { data: avRows } = await supabase
    .from('barber_availability')
    .select('*')
    .eq('barber_id', barberId)
    .eq('day_of_week', dayOfWeek)
    .limit(1);
  if ((avRows ?? []).length > 0) {
    const row = avRows[0];
    enabled = row.is_available ?? true;
    start = hhmm(row.start_time || '09:00');
    end = hhmm(row.end_time || '18:00');
    breakStart = row.break_start ? parseTimeToMinutes(row.break_start) : null;
    breakEnd = row.break_end ? parseTimeToMinutes(row.break_end) : null;
  }

  const slotLabels = [];
  if (enabled) {
    for (let minute = parseTimeToMinutes(start); minute <= parseTimeToMinutes(end); minute += 30) {
      const onBreak = breakStart !== null && breakEnd !== null && minute >= breakStart && minute < breakEnd;
      if (!onBreak) slotLabels.push(minutesToLabel(minute));
    }
  }

  const today = dateKey(new Date()) === dateKey(selectedDate);
  const nowLabel = hhmm(timeKey(new Date()));
  const available = today ? slotLabels.filter((slot) => slot > nowLabel) : slotLabels;
  const taken = new Set();
  const appointmentDate = dateKey(selectedDate);
  const { data: appointments } = await supabase
    .from('appointments')
    .select('appointment_time,status')
    .eq('barber_id', barberId)
    .eq('appointment_date', appointmentDate);
  for (const row of appointments ?? []) {
    const status = String(row.status ?? '').toLowerCase();
    if (!['cancelled', 'canceled', 'no_show'].includes(status)) taken.add(hhmm(row.appointment_time));
  }
  const { data: blocked } = await supabase.from('blocked_slots').select('time').eq('barber_id', barberId).eq('date', appointmentDate);
  for (const row of blocked ?? []) taken.add(hhmm(row.time));
  return { slotLabels: available, taken };
}

async function sendBookingWhatsapp({ selectedServices, selectedBarber, selectedDateTime, name, phone }) {
  const config = await loadWhatsappConfig();
  if (!config.enabled || !isConfigured(config)) return;
  const dateStr = formatDate(selectedDateTime, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = hhmm(timeKey(selectedDateTime));
  const serviceNames = selectedServices.map((s) => s.name).join(', ');
  const total = money(selectedServices.reduce((sum, s) => sum + Number(s.price || 0), 0));
  let message = buildMessage(config.template, {
    cliente: name,
    data: dateStr,
    hora: timeStr,
    servico: serviceNames,
    barbeiro: selectedBarber?.name ?? 'Barbeiro',
    valor: total,
  });
  if (selectedBarber?.phone) message += `\n📞 Contato do barbeiro: ${selectedBarber.phone}`;
  sendWhatsappMessage({ phone, message, config });

  if (selectedBarber?.phone) {
    const barberMessage =
      `📅 *Novo agendamento!*\n\n` +
      `👤 Cliente: ${name}\n` +
      `📞 Telefone: ${phone}\n` +
      `✂️ Serviço: ${serviceNames}\n` +
      `🗓️ Data: ${dateStr} às ${timeStr}\n` +
      `💰 Valor: ${total}`;
    sendWhatsappMessage({ phone: selectedBarber.phone, message: barberMessage, config });
  }
}

function LoginScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState(() => localStorage.getItem('login_saved_email') || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => Boolean(localStorage.getItem('login_saved_email')));
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user && !data.session.user.is_anonymous) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        setChecking(false);
      }
    }
    check();
  }, [navigate]);

  const submit = async (event) => {
    event.preventDefault();
    if (!email || password.length < 6) {
      toast('Verifique email e senha.', 'warn');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      toast(error.message.includes('Invalid login') ? 'Email ou senha incorretos.' : 'Erro ao fazer login.', 'error');
      return;
    }
    if (remember) localStorage.setItem('login_saved_email', email.trim());
    else localStorage.removeItem('login_saved_email');
    await ensureUserRow().catch(() => {});
    navigate('/admin/dashboard', { replace: true });
  };

  const resetPassword = async () => {
    const value = window.prompt('Digite seu email para recuperação:', email);
    if (!value) return;
    const { error } = await supabase.auth.resetPasswordForEmail(value.trim());
    toast(error ? `Erro: ${error.message}` : 'Email de recuperação enviado.', error ? 'error' : 'success');
  };

  if (checking) return <LoadingPage />;

  return (
    <main className="login-page">
      <form className="login-form" onSubmit={submit}>
        <Logo size={120} />
        <p>Acesso administrativo</p>
        <div className="login-field">
          <Mail size={18} />
          <input value={email} type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="login-field">
          <Lock size={18} />
          <input value={password} type={showPass ? 'text' : 'password'} placeholder="Senha" onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <button className="field-action" type="button" onClick={() => setShowPass((v) => !v)} aria-label="Mostrar senha">
            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <div className="login-row">
          <label className="check-line">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Lembrar e-mail
          </label>
          <button type="button" className="link-btn" onClick={resetPassword}>Esqueci minha senha</button>
        </div>
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}

function AdminShell() {
  const navigate = useNavigate();
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const loaded = await loadAdminSession().catch(() => null);
      if (!loaded?.user) {
        navigate('/admin', { replace: true });
        return;
      }
      setSession(loaded);
      setLoading(false);
    }
    load();
  }, [navigate]);

  if (loading) return <LoadingPage />;

  const isBarber = Boolean(session.barberId);
  const secondaryScreens = ['services', 'barbers', 'plan', 'clients'];
  const isSecondary = secondaryScreens.includes(screen);
  const goBack = () => setScreen('dashboard');
  const current = {
    dashboard: <DashboardScreen session={session} setScreen={setScreen} />,
    agenda: <AgendaScreen session={session} />,
    finance: <FinanceScreen session={session} />,
    whatsapp: isBarber ? <DashboardScreen session={session} setScreen={setScreen} /> : <WhatsappScreen />,
    services: <ServicesAdminScreen onBack={goBack} />,
    barbers: <BarbersAdminScreen onBack={goBack} />,
    plan: <PlanClientsScreen session={session} onBack={goBack} />,
    clients: <ClientsDashboard session={session} onBack={goBack} />,
  }[screen];

  const bottomItems = isBarber
    ? [
        { key: 'dashboard', label: 'Dash', icon: LayoutDashboard, activeIcon: LayoutDashboard },
        { key: 'agenda', label: 'Agenda', icon: Calendar, activeIcon: Calendar },
        { key: 'finance', label: 'Caixa', icon: CircleDollarSign, activeIcon: CircleDollarSign },
        { key: 'menu', label: 'Menu', icon: Menu, activeIcon: Menu },
      ]
    : [
        { key: 'dashboard', label: 'Dash', icon: LayoutDashboard, activeIcon: LayoutDashboard },
        { key: 'agenda', label: 'Agenda', icon: Calendar, activeIcon: Calendar },
        { key: 'finance', label: 'Caixa', icon: CircleDollarSign, activeIcon: CircleDollarSign },
        { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, activeIcon: MessageCircle },
        { key: 'menu', label: 'Menu', icon: Menu, activeIcon: Menu },
      ];

  const changeScreen = (key) => {
    if (key === 'menu') {
      setMenuOpen(true);
      return;
    }
    setScreen(key);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    toast('Sessão encerrada.', 'success');
    navigate('/admin', { replace: true });
  };

  return (
    <div className="app-shell admin-shell">
      {current}
      {!isSecondary && <FloatingNav items={bottomItems} value={screen} onChange={changeScreen} />}
      {menuOpen ? (
        <div className="drawer-backdrop" onClick={() => setMenuOpen(false)}>
          <aside className="admin-drawer" onClick={(e) => e.stopPropagation()}>
            <header>
              <Logo size={44} />
              <strong>Admin</strong>
            </header>
            <div className="drawer-section">Principal</div>
            <DrawerButton icon={LayoutDashboard} label="Dashboard" selected={screen === 'dashboard'} onClick={() => { setScreen('dashboard'); setMenuOpen(false); }} />
            <DrawerButton icon={Calendar} label="Agenda" selected={screen === 'agenda'} onClick={() => { setScreen('agenda'); setMenuOpen(false); }} />
            <DrawerButton icon={BadgeDollarSign} label="Caixa" selected={screen === 'finance'} onClick={() => { setScreen('finance'); setMenuOpen(false); }} />
            {!isBarber ? <DrawerButton icon={MessageCircle} label="WhatsApp" selected={screen === 'whatsapp'} onClick={() => { setScreen('whatsapp'); setMenuOpen(false); }} /> : null}
            <div className="drawer-section">Gerenciar</div>
            {!isBarber ? (
              <>
                <DrawerButton icon={Scissors} label="Serviços" selected={screen === 'services'} onClick={() => { setScreen('services'); setMenuOpen(false); }} />
                <DrawerButton icon={UserRound} label="Barbeiros" selected={screen === 'barbers'} onClick={() => { setScreen('barbers'); setMenuOpen(false); }} />
              </>
            ) : null}
            <DrawerButton icon={CreditCard} label="Clientes Plano" selected={screen === 'plan'} onClick={() => { setScreen('plan'); setMenuOpen(false); }} />
            <DrawerButton icon={Repeat} label="Remarcar" selected={screen === 'clients'} onClick={() => { setScreen('clients'); setMenuOpen(false); }} />
            <div className="drawer-spacer" />
            <DrawerButton icon={LogOut} label="Sair" onClick={logout} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function DrawerButton({ icon: Icon, label, selected, onClick }) {
  return (
    <button className={cx('drawer-button', selected && 'selected')} type="button" onClick={onClick}>
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}

function AdminPage({ title, action, children, onBack }) {
  return (
    <main className={`admin-page ${onBack ? '' : 'with-bottom-nav'}`}>
      <header className="admin-topbar">
        {onBack && (
          <button className="icon-btn back-btn" type="button" onClick={onBack} aria-label="Voltar">
            <ArrowLeft size={20} />
          </button>
        )}
        <h1>{title}</h1>
        {action}
      </header>
      {children}
    </main>
  );
}

function DashboardScreen({ session, setScreen }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ today: 0, month: 0, ranks: [], inactive: [] });

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const today = dateKey(now);
    const monthStart = dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
    let query = supabase
      .from('appointments')
      .select('appointment_date,appointment_time,barber_id,user_id,customer_phone,customer_name,service_id,total_price,status,barbers:barber_id(name)')
      .gte('appointment_date', monthStart)
      .lte('appointment_date', today);
    if (session.barberId) query = query.eq('barber_id', session.barberId);
    const { data } = await query.neq('status', 'cancelled');
    const rows = data ?? [];
    const byService = new Map();
    const byBarber = new Map();
    for (const row of rows) {
      if (!isPastAppointment(row.appointment_date, row.appointment_time)) continue;
      const key = [row.appointment_date, row.user_id ?? '', row.customer_phone ?? '', row.customer_name ?? '', row.service_id ?? ''].join('|');
      if (!byService.has(key)) byService.set(key, row);
      const barberKey = row.barber_id || 'sem';
      const current = byBarber.get(barberKey) ?? { id: barberKey, name: row.barbers?.name || 'Sem nome', count: 0, total: 0 };
      current.total += Number(row.total_price || 0);
      byBarber.set(barberKey, current);
    }
    for (const row of byService.values()) {
      const barberKey = row.barber_id || 'sem';
      const current = byBarber.get(barberKey);
      if (current) current.count += 1;
    }
    const todayCount = [...byService.values()].filter((row) => row.appointment_date === today).length;
    const inactive = await loadInactiveClients(session.barberId);
    setStats({
      today: todayCount,
      month: byService.size,
      ranks: [...byBarber.values()].sort((a, b) => b.count - a.count),
      inactive,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [session.barberId]);

  const isSuper = !session.barberId;
  const maxCount = stats.ranks.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  const pieTotal = stats.ranks.reduce((s, r) => s + r.total, 0);
  const palette = ['#1E88E5', '#FFC107', '#D81B60', '#43A047', '#8E24AA', '#FF7043'];
  const monthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const myStats = stats.ranks[0];
  const pieSlices = stats.ranks.filter((r) => r.total > 0);
  let acc = 0;
  const pieStops = pieSlices
    .map((r, i) => {
      const start = (acc / pieTotal) * 100;
      acc += r.total;
      const end = (acc / pieTotal) * 100;
      return `${palette[i % palette.length]} ${start}% ${end}%`;
    })
    .join(', ');

  return (
    <AdminPage title="Admin">
      {loading ? <LoadingBlock /> : (
        <div className="dashboard-grid">
          <MetricCard icon={CalendarDays} label="Realizados hoje" value={stats.today} color="gold" />
          <MetricCard icon={Calendar} label="Realizados no mês" value={stats.month} color="blue" />

          {isSuper ? (
            <>
              <section className="admin-card span-full">
                <h2>Top barbeiros do mês</h2>
                <p className="card-subtitle">{monthLabel}</p>
                <div className="rank-bars">
                  {stats.ranks.length === 0 ? <p className="muted">Sem dados no mês</p> : stats.ranks.map((rank) => (
                    <div className="rank-bar-row" key={rank.id}>
                      <div className="rank-bar-head">
                        <UserRound size={18} />
                        <strong>{rank.name}</strong>
                        <span className="rank-badge">{rank.count}</span>
                      </div>
                      <div className="rank-track">
                        <div className="rank-fill" style={{ width: `${(rank.count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="admin-card span-full">
                <h2>Resumo em pizza</h2>
                {pieTotal <= 0 ? (
                  <p className="muted">Sem dados para exibir</p>
                ) : (
                  <div className="pie-area">
                    <div className="pie" style={{ background: `conic-gradient(${pieStops})` }} />
                    <div className="pie-legend">
                      {pieSlices.map((r, i) => (
                        <span className="pie-chip" key={r.id}>
                          <i style={{ background: palette[i % palette.length] }} />
                          {r.name} · {Math.round((r.total / pieTotal) * 100)}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="admin-card span-full">
                <h2>Seu mês</h2>
                <p className="card-subtitle">{monthLabel}</p>
                <div className="my-month">
                  <span><CheckCircle2 size={18} /> Atendimentos no mês: {myStats?.count ?? 0}</span>
                  <span><CircleDollarSign size={18} /> Faturamento previsto: {money(myStats?.total ?? 0)}</span>
                </div>
              </section>
              <section className="admin-card span-full">
                <header className="card-title-row">
                  <h2>Clientes para reativar</h2>
                  <button className="link-btn" onClick={() => setScreen?.('clients')}>Ver todos</button>
                </header>
                {stats.inactive.slice(0, 5).map((client) => (
                  <ClientLine key={client.phone} client={client} />
                ))}
                {stats.inactive.length === 0 ? <p className="muted">Nenhum cliente nessa situação.</p> : null}
              </section>
            </>
          )}
        </div>
      )}
    </AdminPage>
  );
}

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <article className={cx('metric-card', color)}>
      <Icon size={22} />
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

async function loadInactiveClients(barberId) {
  let query = supabase
    .from('appointments')
    .select('appointment_date,customer_name,customer_phone,users:user_id(name,phone)')
    .neq('status', 'cancelled');
  if (barberId) query = query.eq('barber_id', barberId);
  const { data } = await query;
  const limit = addDays(new Date(), -30);
  const map = new Map();
  for (const row of data ?? []) {
    const phone = normalizePhone(row.customer_phone || row.users?.phone || '');
    if (phone.length < 10) continue;
    const dt = new Date(row.appointment_date);
    const current = map.get(phone);
    if (!current || dt > current.lastVisit) {
      map.set(phone, {
        name: row.customer_name || row.users?.name || 'Cliente',
        phone,
        lastVisit: dt,
      });
    }
  }
  return [...map.values()].filter((client) => client.lastVisit < limit).sort((a, b) => b.lastVisit - a.lastVisit);
}

function ClientLine({ client }) {
  const days = Math.floor((Date.now() - client.lastVisit.getTime()) / 86400000);
  const text = encodeURIComponent(`Olá ${client.name}, sentimos sua falta na TD Barbearia. Quer agendar um horário?`);
  return (
    <div className="client-line">
      <div>
        <strong>{client.name}</strong>
        <span>Última vez: {formatDate(client.lastVisit, { day: '2-digit', month: '2-digit', year: 'numeric' })} · há {days} dias</span>
      </div>
      <a className="whatsapp-dot" href={`https://wa.me/55${normalizePhone(client.phone)}?text=${text}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
        <MessageCircle size={18} />
      </a>
    </div>
  );
}

function AgendaScreen({ session }) {
  const toast = useToast();
  const { confirm, ConfirmUI } = useConfirm();
  const [date, setDate] = useState(dateKey(new Date()));
  const [barbers, setBarbers] = useState([]);
  const [barberId, setBarberId] = useState(session.barberId || '');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manualSlot, setManualSlot] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const dateRef = useRef(null);

  const loadBarbers = async () => {
    let query = supabase.from('barbers').select('id,name,phone,image_url,avatar_url').order('name');
    if (session.barberId) query = query.eq('id', session.barberId);
    const { data } = await query;
    setBarbers(data ?? []);
    // barber-admin: auto-select their own. super-admin: no auto-select
    if (session.barberId) setBarberId(session.barberId);
  };

  const load = async () => {
    if (!barberId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const day = new Date(`${date}T00:00:00`);
    const { slotLabels } = await loadSlotsForBarber(day, barberId);
    const slotMap = new Map(slotLabels.map((label) => [label, { label, state: 'free' }]));

    const { data: blocked } = await supabase.from('blocked_slots').select('id,time').eq('barber_id', barberId).eq('date', date);
    for (const row of blocked ?? []) {
      const label = hhmm(row.time);
      slotMap.set(label, { ...(slotMap.get(label) ?? { label }), state: 'blocked', blockedId: row.id });
    }

    const { data: appointments } = await supabase
      .from('appointments')
      .select('id,appointment_time,customer_name,customer_phone,status,source,total_price,services:service_id(name)')
      .eq('barber_id', barberId)
      .eq('appointment_date', date);
    const active = (appointments ?? []).filter((row) => !['cancelled', 'canceled', 'no_show'].includes(String(row.status ?? '').toLowerCase()));
    const phones = [...new Set(active.map((row) => row.customer_phone).filter(Boolean))];
    const returning = new Set();
    if (phones.length) {
      const { data: prior } = await supabase.from('appointments').select('customer_phone').in('customer_phone', phones).lt('appointment_date', date);
      for (const row of prior ?? []) returning.add(row.customer_phone);
    }
    for (const row of active) {
      const label = hhmm(row.appointment_time);
      const prev = slotMap.get(label) ?? { label };
      if (prev.state === 'blocked') continue;
      const phone = row.customer_phone || '';
      const source = row.source || 'client';
      slotMap.set(label, {
        ...prev,
        state: source === 'admin' ? 'admin' : phone && !returning.has(phone) ? 'newClient' : 'client',
        appointmentId: row.id,
        name: row.customer_name || '',
        phone,
        service: row.services?.name || '',
        totalPrice: Number(row.total_price || 0),
      });
    }
    setSlots([...slotMap.values()].sort((a, b) => a.label.localeCompare(b.label)));
    setLoading(false);
  };

  useEffect(() => {
    loadBarbers();
  }, []);
  useEffect(() => {
    load();
  }, [barberId, date]);

  const blockSlot = async (slot) => {
    const { error } = await supabase.from('blocked_slots').insert({ barber_id: barberId, date, time: `${slot.label}:00` });
    if (error) toast(`Erro ao bloquear: ${error.message}`, 'error');
    else toast('Horário bloqueado.', 'success');
    load();
  };

  const unblockSlot = async (slot) => {
    let query = supabase.from('blocked_slots').delete();
    if (slot.blockedId) query = query.eq('id', slot.blockedId);
    else query = query.eq('barber_id', barberId).eq('date', date).eq('time', `${slot.label}:00`);
    const { error } = await query;
    if (error) toast(`Erro ao desbloquear: ${error.message}`, 'error');
    else toast('Bloqueio removido.', 'success');
    load();
  };

  const cancelSlot = async (slot) => {
    const ok = await confirm(`Cancelar agendamento das ${slot.label}?`, {
      title: 'Cancelar agendamento',
      confirmLabel: 'Sim, cancelar',
      cancelLabel: 'Não',
      confirmClass: 'danger-btn',
    });
    if (!ok) return;
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('barber_id', barberId)
      .eq('appointment_date', date)
      .eq('appointment_time', `${slot.label}:00`);
    if (error) toast(`Erro ao cancelar: ${error.message}`, 'error');
    else toast('Agendamento cancelado.', 'success');
    load();
  };

  const blockDay = async () => {
    if (!barberId) { toast('Selecione um barbeiro primeiro.', 'warn'); return; }
    const ok = await confirm('Bloquear o dia inteiro para este barbeiro?', {
      title: 'Bloquear dia',
      confirmLabel: 'Bloquear',
      confirmClass: 'danger-btn',
    });
    if (!ok) return;
    const { error } = await supabase.from('barber_blocked_days').insert({ barber_id: barberId, date });
    if (error) toast(`Erro ao bloquear dia: ${error.message}`, 'error');
    else toast('Dia bloqueado.', 'success');
    load();
  };

  const openManualTimePicker = () => {
    if (!barberId) { toast('Selecione um barbeiro primeiro.', 'warn'); return; }
    setShowTimePicker(true);
  };

  const formatDateDisplay = (dateStr) => {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const selectedBarber = barbers.find((b) => b.id === barberId);

  return (
    <AdminPage title="Agendamentos">
      <div className="finance-filter-top">
        <span className="agenda-period-label">Dia</span>
        <button
          className="finance-date-btn"
          type="button"
          onClick={() => dateRef.current?.showPicker?.()}
        >
          <span>{formatDateDisplay(date)}</span>
          <CalendarDays size={18} />
          <input
            ref={dateRef}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="finance-date-hidden"
          />
        </button>
      </div>

      {!session.barberId && (
        <select
          className="finance-barber-select"
          value={barberId}
          onChange={(e) => setBarberId(e.target.value)}
        >
          <option value="">Todos os barbeiros</option>
          {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}

      {!barberId ? (
        <div className="admin-card agenda-no-barber">
          <p>Selecione um barbeiro acima para ver a agenda do dia.</p>
        </div>
      ) : (
        <>
          <div className="agenda-legend-compact">
            <span className="slot-dot free" />Vago
            <span className="slot-dot client" />Cliente
            <span className="slot-dot newClient" />Novo
            <span className="slot-dot admin" />Encaixe
            <span className="slot-dot blocked" />Bloqueado
          </div>
          <div className="agenda-action-bar">
            <button className="agenda-action-btn" onClick={openManualTimePicker}>
              <CalendarDays size={15} />Adicionar horário
            </button>
            <button className="agenda-action-btn red" onClick={blockDay}>
              <Lock size={15} />Bloquear dia
            </button>
          </div>
          {selectedBarber && (
            <p className="agenda-subtitle">
              {selectedBarber.name} • {new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
            </p>
          )}
          {loading ? <LoadingBlock /> : (
            <div className="agenda-list">
              {slots.length === 0
                ? <EmptyState icon={Calendar} title="Sem horários" subtitle="Escolha outro dia ou barbeiro." />
                : slots.map((slot) => (
                  <article className={cx('slot-card', slot.state)} key={slot.label}>
                    <time>{slot.label}</time>
                    <div className="slot-info">
                      <strong>{slot.state === 'free' ? 'Livre' : slot.state === 'blocked' ? 'Bloqueado' : slot.name || 'Cliente'}</strong>
                      {!['free', 'blocked'].includes(slot.state) && <span>{slot.service || formatPhone(slot.phone)}</span>}
                    </div>
                    <div className="slot-right">
                      {slot.state === 'admin' && <span className="slot-label encaixe">ENCAIXE</span>}
                      {slot.state === 'newClient' && <span className="slot-label novo">NOVO</span>}
                      {slot.state === 'free' && (
                        <div className="slot-actions">
                          <button className="icon-btn" onClick={() => setManualSlot({ date: new Date(`${date}T00:00:00`), time: slot.label, barberId })} aria-label="Agendar"><Plus size={18} /></button>
                          <button className="icon-btn red" onClick={() => blockSlot(slot)} aria-label="Bloquear"><Lock size={18} /></button>
                        </div>
                      )}
                      {slot.state === 'blocked' && <button className="icon-btn red" onClick={() => unblockSlot(slot)} aria-label="Desbloquear"><Lock size={18} /></button>}
                      {['client', 'newClient', 'admin'].includes(slot.state) && <button className="icon-btn red" onClick={() => cancelSlot(slot)} aria-label="Cancelar"><X size={18} /></button>}
                    </div>
                  </article>
                ))
              }
            </div>
          )}
        </>
      )}
      {manualSlot ? <BookingScreen adminContext fixedSlot={manualSlot} onClose={() => setManualSlot(null)} onSaved={load} /> : null}
      {showTimePicker && (
        <TimePickerModal
          date={date}
          slots={slots}
          onConfirm={(time) => {
            setShowTimePicker(false);
            const hh = time.slice(0, 5);
            const occupied = slots.find((s) => s.label === hh && s.state !== 'free');
            if (occupied) { toast(`O horário ${hh} já está na agenda.`, 'warn'); return; }
            setManualSlot({ date: new Date(`${date}T00:00:00`), time: hh, barberId });
          }}
          onCancel={() => setShowTimePicker(false)}
        />
      )}
      {ConfirmUI}
    </AdminPage>
  );
}

function TimePickerModal({ date, slots, onConfirm, onCancel }) {
  const now = new Date();
  const defaultTime = (() => {
    const freeSlot = (slots ?? []).find((s) => s.state === 'free');
    if (freeSlot) return freeSlot.label;
    const h = String(now.getHours()).padStart(2, '0');
    const m = now.getMinutes() < 30 ? '00' : '30';
    return `${h}:${m}`;
  })();
  const [time, setTime] = useState(defaultTime);
  const d = new Date(`${date}T00:00:00`);
  const dateLabel = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div className="phone-lookup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="phone-lookup-title-row">
          <span className="phone-lookup-icon"><Clock size={20} /></span>
          <strong>Horário extra para este dia</strong>
        </div>
        <p className="phone-lookup-label">{dateLabel}</p>
        <div className="phone-lookup-input-row">
          <Clock size={18} className="phone-lookup-phone-icon" />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="phone-lookup-input"
          />
        </div>
        <div className="phone-lookup-actions">
          <button className="outline-btn" type="button" onClick={onCancel}>Cancelar</button>
          <button className="primary-btn" type="button" onClick={() => onConfirm(time)}>OK</button>
        </div>
      </div>
    </div>
  );
}

function useConfirm() {
  const [pending, setPending] = useState(null);
  const confirm = useCallback((message, opts = {}) => new Promise((resolve) => {
    setPending({ message, resolve, ...opts });
  }), []);
  const ConfirmUI = pending ? (
    <ConfirmModal
      message={pending.message}
      title={pending.title}
      confirmLabel={pending.confirmLabel}
      confirmClass={pending.confirmClass}
      onConfirm={() => { pending.resolve(true); setPending(null); }}
      onCancel={() => { pending.resolve(false); setPending(null); }}
    />
  ) : null;
  return { confirm, ConfirmUI };
}

function ConfirmModal({ title, message, confirmLabel = 'OK', confirmClass = 'primary-btn', cancelLabel = 'Cancelar', onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div className="phone-lookup-modal" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="phone-lookup-title-row">
            <strong>{title}</strong>
          </div>
        )}
        <p className="confirm-modal-message">{message}</p>
        <div className="phone-lookup-actions">
          <button className="outline-btn" type="button" onClick={onCancel}>{cancelLabel}</button>
          <button className={confirmClass} type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function FinanceScreen({ session }) {
  const [period, setPeriod] = useState('day');
  const [selected, setSelected] = useState(dateKey(new Date()));
  const [barbers, setBarbers] = useState([]);
  const [barberId, setBarberId] = useState(session.barberId || '');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ total: 0, planTotal: 0, planCount: 0, rows: [] });
  const dateRef = useRef(null);

  const loadBarbers = async () => {
    const { data: rows } = await supabase.from('barbers').select('id,name').order('name');
    setBarbers(rows ?? []);
  };

  const load = async () => {
    setLoading(true);
    const { start, end } = periodBounds(period, new Date(`${selected}T00:00:00`));
    let query = supabase
      .from('appointments')
      .select('appointment_date,appointment_time,status,is_plan_client,barber_id,customer_phone,total_price,barbers:barber_id(name),services:service_id(id,name,price)')
      .gte('appointment_date', dateKey(start))
      .lt('appointment_date', dateKey(end));
    if (barberId) query = query.eq('barber_id', barberId);
    const { data: rows } = await query.order('appointment_date', { ascending: true });
    const byBarber = new Map();
    const planPhones = new Set();
    let total = 0;
    for (const row of rows ?? []) {
      const status = String(row.status ?? '').toLowerCase();
      if (['no_show', 'cancelled', 'canceled'].includes(status)) continue;
      if (!isPastAppointment(row.appointment_date, row.appointment_time)) continue;
      if (row.is_plan_client === true) {
        const phone = normalizePhone(row.customer_phone || '');
        if (phone) planPhones.add(phone);
        continue;
      }
      const price = Number(row.total_price ?? row.services?.price ?? 0);
      total += price;
      const key = row.barber_id || 'sem';
      const current = byBarber.get(key) ?? { barberId: key, barberName: row.barbers?.name || 'Sem nome', total: 0 };
      current.total += price;
      byBarber.set(key, current);
    }
    let planTotal = 0;
    let planCount = 0;
    if (planPhones.size) {
      const { data: clients } = await supabase.from('plan_clients').select('phone,monthly_value');
      const seen = new Set();
      for (const client of clients ?? []) {
        const phone = normalizePhone(client.phone || '');
        if (planPhones.has(phone) && !seen.has(phone)) {
          seen.add(phone);
          planTotal += Number(client.monthly_value || 0);
          planCount += 1;
        }
      }
    }
    setData({ total, planTotal, planCount, rows: [...byBarber.values()].sort((a, b) => b.total - a.total) });
    setLoading(false);
  };

  useEffect(() => { loadBarbers(); }, []);
  useEffect(() => { load(); }, [period, selected, barberId]);

  const formatDateDisplay = (dateStr) => {
    const d = new Date(`${dateStr}T00:00:00`);
    if (period === 'month') return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if (period === 'year') return String(d.getFullYear());
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <AdminPage title="Caixa">
      <div className="finance-filter-top">
        <select className="finance-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {periodOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          className="finance-date-btn"
          type="button"
          onClick={() => dateRef.current?.showPicker?.()}
        >
          <span>{formatDateDisplay(selected)}</span>
          <CalendarDays size={18} />
          <input
            ref={dateRef}
            type="date"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="finance-date-hidden"
          />
        </button>
      </div>
      {!session.barberId && (
        <select
          className="finance-barber-select"
          value={barberId}
          onChange={(e) => setBarberId(e.target.value)}
        >
          <option value="">Todos os barbeiros</option>
          {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}

      {loading ? <LoadingBlock /> : (
        <div className="finance-body">
          {data.rows.length > 0 && (
            <div className="admin-card finance-barbers">
              {data.rows.map((row) => (
                <div className="finance-barber-row" key={row.barberId}>
                  <User size={16} />
                  <span>{row.barberName}</span>
                  <b>{money(row.total)}</b>
                </div>
              ))}
            </div>
          )}
          <div className="admin-card finance-mensalidades">
            <div className="finance-mensalidades-info">
              <CreditCard size={22} className="finance-mensalidades-icon" />
              <div className="finance-mensalidades-text">
                <strong>Mensalidades</strong>
                <span>{data.planCount} cliente{data.planCount !== 1 ? 's' : ''} do plano</span>
              </div>
            </div>
            <b className="finance-mensalidades-value">{money(data.planTotal)}</b>
          </div>
          <div className="finance-total-card">
            <div className="finance-total-row">
              <span>Avulsos</span>
              <span>{money(data.total)}</span>
            </div>
            <div className="finance-total-row">
              <span>Plano</span>
              <span>{money(data.planTotal)}</span>
            </div>
            <div className="finance-total-row finance-grand-total">
              <span>Total</span>
              <b>{money(data.total + data.planTotal)}</b>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}

function WhatsappScreen() {
  const toast = useToast();
  const { confirm, ConfirmUI } = useConfirm();
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [qr, setQr] = useState(null);
  const [testPhone, setTestPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const cfg = await loadWhatsappConfig();
    setConfig(cfg);
    setLoading(false);
  };

  const refreshStatus = async (cfg = config) => {
    if (!cfg || !isConfigured(cfg)) return;
    const next = await checkWhatsappStatus(cfg);
    setStatus(next);
    if (next.online && !next.connected) setQr(await fetchWhatsappQr(cfg));
    else setQr(null);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!config) return;
    refreshStatus(config);
    const id = window.setInterval(() => refreshStatus(config), 5000);
    return () => window.clearInterval(id);
  }, [config?.serverUrl, config?.apiKey]);

  const update = (field, value) => setConfig((current) => ({ ...current, [field]: value }));
  const save = async () => {
    setSaving(true);
    try {
      await saveWhatsappConfig(config);
      toast('Configuração salva.', 'success');
      await refreshStatus(config);
    } catch (error) {
      toast(`Erro: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    const result = await sendWhatsappMessage({
      phone: testPhone,
      config,
      message: buildMessage(config.template, {
        cliente: 'João Teste',
        data: '01/07/2025',
        hora: '10:00',
        servico: 'Corte Masculino',
        barbeiro: 'Carlos',
        valor: 'R$ 50,00',
      }),
    });
    toast(result.ok ? 'Enviado!' : `Erro: ${result.error}`, result.ok ? 'success' : 'error');
  };

  const reset = async () => {
    const ok = await confirm('Resetar a sessão do WhatsApp?', { title: 'Resetar sessão', confirmLabel: 'Resetar', confirmClass: 'danger-btn' });
    if (!ok) return;
    const result = await resetWhatsappSession(config);
    toast(result.ok ? 'Sessão resetada. Aguarde o QR.' : `Erro: ${result.error}`, result.ok ? 'success' : 'error');
    refreshStatus(config);
  };

  if (loading || !config) return <LoadingPage />;

  return (
    <AdminPage title="WhatsApp" action={<button className="icon-btn gold" onClick={save} disabled={saving} aria-label="Salvar"><Save size={18} /></button>}>
      <section className="admin-card wa-status-card">
        <div className="wa-status-icon-wrap">
          <MessageCircle size={26} />
        </div>
        <div className="wa-status-text">
          <strong>Mensagens automáticas</strong>
          <span>
            {status?.connected
              ? `Conectado: ${status.phone || ''}`
              : status?.online
                ? 'Servidor online, aguardando QR'
                : 'Servidor offline'}
          </span>
        </div>
        <label className="switch">
          <input type="checkbox" checked={config.enabled} onChange={(e) => update('enabled', e.target.checked)} />
          <span />
        </label>
      </section>
      {qr ? <section className="admin-card qr-card"><img src={qr} alt="QR Code WhatsApp" /><button className="small-btn" onClick={() => refreshStatus(config)}>Atualizar</button></section> : null}
      <section className="admin-card form-card">
        <h2>Servidor WhatsApp</h2>
        <p className="wa-server-hint">Suba o servidor em Railway, Render ou qualquer VPS e cole a URL abaixo.</p>
        <label className="field"><span>URL do servidor</span><input value={config.serverUrl} onChange={(e) => update('serverUrl', e.target.value)} placeholder="https://wa.tonidinisbarbearia.dartsistemas.com" /></label>
        <label className="field"><span>API Key</span><input value={config.apiKey} onChange={(e) => update('apiKey', e.target.value)} type="password" /></label>
        <button className="outline-btn" onClick={() => refreshStatus(config)}><Wifi size={16} /> Conectar / verificar</button>
        <button className="wa-reset-link" onClick={reset}><RefreshCw size={14} /> Resetar sessão (novo QR)</button>
      </section>
      <WhatsappTemplateEditor title="Mensagem automática" value={config.template} onChange={(v) => update('template', v)} />
      <section className="admin-card form-card">
        <h2>Lembretes automáticos</h2>
        <label className="field">
          <span>Enviar lembrete com antecedência de</span>
          <select value={config.reminderNormalHours} onChange={(e) => update('reminderNormalHours', Number(e.target.value))}>
            <option value={1}>1 hora</option>
            <option value={2}>2 horas</option>
            <option value={6}>6 horas</option>
            <option value={24}>24 horas</option>
          </select>
        </label>
      </section>
      <WhatsappTemplateEditor title="Lembrete 24h antes — clientes normais" value={config.normalTemplate24h} onChange={(v) => update('normalTemplate24h', v)} />
      <WhatsappTemplateEditor title="Lembrete do plano — 24 horas antes" value={config.planTemplate24h} onChange={(v) => update('planTemplate24h', v)} />
      <WhatsappTemplateEditor title="Lembrete do plano — no horário configurado" value={config.planTemplate1h} onChange={(v) => update('planTemplate1h', v)} />
      <section className="admin-card form-card">
        <h2>Testar envio</h2>
        <div className="lookup-row">
          <label className="field grow"><span>Número WhatsApp</span><input value={testPhone} onChange={(e) => setTestPhone(maskPhoneInput(e.target.value))} /></label>
          <button className="icon-btn gold" onClick={sendTest} aria-label="Enviar"><Send size={18} /></button>
        </div>
      </section>
      <button className="primary-btn" onClick={save} disabled={saving}><Save size={18} /> Salvar configuração</button>
      {ConfirmUI}
    </AdminPage>
  );
}

function WhatsappTemplateEditor({ title, value, onChange }) {
  const variables = ['{{cliente}}', '{{data}}', '{{hora}}', '{{servico}}', '{{barbeiro}}', '{{valor}}'];
  return (
    <section className="admin-card form-card">
      <h2>{title}</h2>
      <div className="chips-row">
        {variables.map((variable) => <button key={variable} className="chip" onClick={() => onChange(`${value}${variable}`)}>{variable}</button>)}
      </div>
      <textarea rows={7} value={value} onChange={(e) => onChange(e.target.value)} />
    </section>
  );
}

function ServicesAdminScreen({ onBack }) {
  const toast = useToast();
  const { confirm, ConfirmUI } = useConfirm();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('services').select('*').order('name');
    if (error) toast(`Erro: ${error.message}`, 'error');
    setServices(sortServices((data ?? []).map(serviceFromRow)));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (service) => {
    const { error } = await supabase.from('services').update({ is_active: !(service.is_active ?? true) }).eq('id', service.id);
    if (error) toast(`Erro: ${error.message}`, 'error');
    load();
  };
  const remove = async (service) => {
    const ok = await confirm('Excluir este serviço?', { title: 'Excluir serviço', confirmLabel: 'Excluir', confirmClass: 'danger-btn' });
    if (!ok) return;
    const { error } = await supabase.from('services').delete().eq('id', service.id);
    if (error) toast(`Erro: ${error.message}`, 'error');
    else toast('Serviço excluído.', 'success');
    load();
  };
  const move = async (index, dir) => {
    const next = [...services];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setServices(next);
    await Promise.all(next.map((service, i) => supabase.from('services').update({ sort_order: i }).eq('id', service.id)));
    load();
  };

  return (
    <AdminPage title="Serviços" onBack={onBack} action={<button className="icon-btn gold" onClick={() => setEditing({})} aria-label="Novo serviço"><Plus size={18} /></button>}>
      {loading ? <LoadingBlock /> : (
        <div className="stack">
          {services.map((service, index) => (
            <article className="list-card service-admin-row" key={service.id}>
              <button className="drag-buttons" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Subir"><ChevronLeft size={16} /></button>
              <button className="drag-buttons" onClick={() => move(index, 1)} disabled={index === services.length - 1} aria-label="Descer"><ChevronRight size={16} /></button>
              <span className="thumb">{service.image_url ? <img src={service.image_url} alt="" /> : <Scissors size={22} />}</span>
              <div>
                <strong>{service.name}</strong>
                <span>{money(service.price)} · {durationLabel(service.duration_blocks)}</span>
                <small>{service.image_url ? 'Foto salva' : 'Sem foto'}</small>
              </div>
              <label className="switch"><input type="checkbox" checked={service.is_active ?? true} onChange={() => toggleActive(service)} /><span /></label>
              <button className="icon-btn" onClick={() => setEditing(service)} aria-label="Editar"><Edit3 size={18} /></button>
              <button className="icon-btn red" onClick={() => remove(service)} aria-label="Excluir"><Trash2 size={18} /></button>
            </article>
          ))}
        </div>
      )}
      {editing ? <ServiceForm service={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} /> : null}
      {ConfirmUI}
    </AdminPage>
  );
}

function ServiceForm({ service, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(service?.name || '');
  const [price, setPrice] = useState(service ? money(service.price) : '');
  const [description, setDescription] = useState(service?.description || '');
  const [blocks, setBlocks] = useState(service?.duration_blocks || 1);
  const [imageUrl, setImageUrl] = useState(service?.image_url || '');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast('Informe o nome do serviço.', 'warn');
    setSaving(true);
    try {
      let finalImage = imageUrl;
      if (file) finalImage = await uploadFile('fotos', `services/service_${Date.now()}.${file.name.split('.').pop() || 'jpg'}`, file);
      const payload = {
        name: name.trim(),
        description: description.trim(),
        price: numberFromCurrency(price),
        duration_blocks: Number(blocks) || 1,
        image_url: finalImage,
      };
      const { error } = service?.id
        ? await supabase.from('services').update(payload).eq('id', service.id)
        : await supabase.from('services').insert(payload);
      if (error) throw error;
      toast('Serviço salvo.', 'success');
      onSaved();
    } catch (error) {
      toast(`Erro: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={service ? 'Editar serviço' : 'Novo serviço'} onClose={onClose}>
      <div className="form-card modal-form">
        <label className="field"><span>Nome</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>Preço</span><input value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <label className="field"><span>Duração</span><select value={blocks} onChange={(e) => setBlocks(Number(e.target.value))}>{[1,2,3,4,5,6].map((n) => <option value={n} key={n}>{durationLabel(n)}</option>)}</select></label>
        <label className="field"><span>Descrição</span><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="file-box">
          <ImageIcon size={20} />
          <span>{file?.name || 'Selecionar foto'}</span>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {imageUrl ? <img className="preview-image" src={imageUrl} alt="" /> : null}
        <button className="primary-btn" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </Modal>
  );
}

function BarbersAdminScreen({ onBack }) {
  const toast = useToast();
  const { confirm, ConfirmUI } = useConfirm();
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('barbers').select('*').order('name');
    if (error) toast(`Erro: ${error.message}`, 'error');
    setBarbers(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (barber) => {
    const { error } = await supabase.from('barbers').update({ is_available: !(barber.is_available ?? true) }).eq('id', barber.id);
    if (error) toast(`Erro: ${error.message}`, 'error');
    load();
  };
  const remove = async (barber) => {
    const ok = await confirm(`Excluir "${barber.name}"?`, { title: 'Excluir barbeiro', confirmLabel: 'Excluir', confirmClass: 'danger-btn' });
    if (!ok) return;
    const sb = supabase;
    await sb.from('appointments').delete().eq('barber_id', barber.id);
    await sb.from('barber_availability').delete().eq('barber_id', barber.id);
    await sb.from('blocked_slots').delete().eq('barber_id', barber.id);
    await sb.from('barber_blocked_days').delete().eq('barber_id', barber.id).catch?.(() => {});
    const { error } = await sb.from('barbers').delete().eq('id', barber.id);
    if (error) toast(`Erro: ${error.message}`, 'error');
    else toast('Barbeiro excluído.', 'success');
    load();
  };

  return (
    <AdminPage title="Barbeiros" onBack={onBack} action={<button className="icon-btn gold" onClick={() => setEditing({})} aria-label="Novo barbeiro"><Plus size={18} /></button>}>
      {loading ? <LoadingBlock /> : (
        <div className="stack">
          {barbers.map((barber) => (
            <article className="list-card" key={barber.id}>
              <Avatar src={barber.image_url || barber.avatar_url} name={barber.name} />
              <div>
                <strong>{barber.name}</strong>
                <span>{barber.email || barber.phone || 'Sem contato'}</span>
                {barber.user_id ? <small>Acesso configurado</small> : null}
              </div>
              <label className="switch"><input type="checkbox" checked={barber.is_available ?? true} onChange={() => toggle(barber)} /><span /></label>
              <button className="icon-btn" onClick={() => setEditing(barber)} aria-label="Editar"><Edit3 size={18} /></button>
              <button className="icon-btn red" onClick={() => remove(barber)} aria-label="Excluir"><Trash2 size={18} /></button>
            </article>
          ))}
        </div>
      )}
      {editing ? <BarberForm barber={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} /> : null}
      {ConfirmUI}
    </AdminPage>
  );
}

function BarberForm({ barber, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(barber?.name || '');
  const [email, setEmail] = useState(barber?.email || '');
  const [phone, setPhone] = useState(barber?.phone || '');
  const [password, setPassword] = useState('');
  const [imageUrl, setImageUrl] = useState(barber?.image_url || barber?.avatar_url || '');
  const [file, setFile] = useState(null);
  const [specialties, setSpecialties] = useState(Array.isArray(barber?.specialties) ? barber.specialties.join(', ') : '');
  const [saving, setSaving] = useState(false);

  const createSupabaseUser = async () => {
    if (!email.trim() || !password.trim()) return barber?.user_id || null;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const body = await res.json();
    if (res.ok) return body.user?.id || body.id || null;
    const msg = String(body.msg || body.message || '').toLowerCase();
    if (msg.includes('already') || msg.includes('existe')) {
      const { data } = await supabase.from('users').select('id').eq('email', email.trim()).maybeSingle();
      return data?.id ?? null;
    }
    throw new Error(body.msg || body.message || 'Erro ao criar login.');
  };

  const save = async () => {
    if (!name.trim()) return toast('Informe o nome.', 'warn');
    setSaving(true);
    try {
      let finalImage = imageUrl;
      if (file) finalImage = await uploadFile('fotos', `avatars/barber_${Date.now()}.${file.name.split('.').pop() || 'jpg'}`, file);
      const userId = await createSupabaseUser();
      const payload = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim(),
        image_url: finalImage,
        specialties: specialties.split(',').map((item) => item.trim()).filter(Boolean),
        user_id: userId,
      };
      const { error } = barber?.id
        ? await supabase.from('barbers').update(payload).eq('id', barber.id)
        : await supabase.from('barbers').insert(payload);
      if (error) throw error;
      toast('Barbeiro salvo.', 'success');
      onSaved();
    } catch (error) {
      toast(`Erro: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={barber ? 'Editar barbeiro' : 'Novo barbeiro'} onClose={onClose}>
      <div className="form-card modal-form">
        <label className="field"><span>Nome</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>Email</span><input value={email} type="email" onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span>Telefone</span><input value={phone} onChange={(e) => setPhone(maskPhoneInput(e.target.value))} /></label>
        {!barber?.user_id ? <label className="field"><span>Senha de acesso</span><input value={password} type="password" onChange={(e) => setPassword(e.target.value)} /></label> : null}
        <label className="field"><span>Especialidades</span><input value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="Corte, Barba" /></label>
        <label className="file-box"><ImageIcon size={20} /><span>{file?.name || 'Selecionar foto'}</span><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        {imageUrl ? <img className="preview-image" src={imageUrl} alt="" /> : null}
        <button className="primary-btn" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </Modal>
  );
}

function PlanClientsScreen({ session, onBack }) {
  const toast = useToast();
  const { confirm, ConfirmUI } = useConfirm();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [recurring, setRecurring] = useState(null);

  const load = async () => {
    setLoading(true);
    let query = supabase.from('plan_clients').select('*').order('name');
    if (session.barberId) query = query.eq('barber_id', session.barberId);
    const { data, error } = await query;
    if (error) toast(`Erro: ${error.message}`, 'error');
    setClients(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const remove = async (client) => {
    const ok = await confirm(`Remover "${client.name}" da lista de clientes plano?`, { title: 'Remover cliente', confirmLabel: 'Remover', confirmClass: 'danger-btn' });
    if (!ok) return;
    const { error } = await supabase.from('plan_clients').delete().eq('id', client.id);
    if (error) toast(`Erro: ${error.message}`, 'error');
    else toast('Cliente removido.', 'success');
    load();
  };

  return (
    <AdminPage title="Clientes Plano" onBack={onBack} action={<button className="icon-btn gold" onClick={() => setEditing({})} aria-label="Novo"><Plus size={18} /></button>}>
      {loading ? <LoadingBlock /> : clients.length === 0 ? <EmptyState icon={CreditCard} title="Nenhum cliente plano cadastrado" subtitle="Toque em + para adicionar." /> : (
        <div className="stack">
          {clients.map((client) => (
            <article className="list-card" key={client.id}>
              <span className="round-icon"><CreditCard size={20} /></span>
              <div>
                <strong>{client.name}</strong>
                <span>{formatPhone(client.phone)}</span>
                <small>{client.plan_name || 'Plano'} · {client.monthly_value != null ? money(client.monthly_value) : 'Sem valor'} {client.due_day ? `· vence dia ${client.due_day}` : ''}</small>
              </div>
              <button className="icon-btn gold" onClick={() => setRecurring(client)} aria-label="Recorrentes"><Repeat size={18} /></button>
              <button className="icon-btn" onClick={() => setEditing(client)} aria-label="Editar"><Edit3 size={18} /></button>
              <button className="icon-btn red" onClick={() => remove(client)} aria-label="Remover"><Trash2 size={18} /></button>
            </article>
          ))}
        </div>
      )}
      {editing ? <PlanClientForm client={editing.id ? editing : null} session={session} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} /> : null}
      {recurring ? <RecurringScheduleModal client={recurring} session={session} onClose={() => setRecurring(null)} /> : null}
      {ConfirmUI}
    </AdminPage>
  );
}

function PlanClientForm({ client, session, onClose, onSaved }) {
  const toast = useToast();
  const isSuperAdmin = !session?.barberId;
  const [barbers, setBarbers] = useState([]);
  const [form, setForm] = useState({
    name: client?.name || '',
    phone: formatPhone(client?.phone || ''),
    plan_name: client?.plan_name || '',
    monthly_value: client?.monthly_value != null ? String(client.monthly_value).replace('.', ',') : '',
    payment_method: client?.payment_method || '',
    due_day: client?.due_day || '',
    notes: client?.notes || '',
    barber_id: client?.barber_id || (isSuperAdmin ? '' : (session?.barberId || '')),
  });
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase.from('barbers').select('id,name').order('name').then(({ data }) => setBarbers(data ?? []));
  }, [isSuperAdmin]);

  const save = async () => {
    const phone = normalizePhone(form.phone);
    if (!form.name.trim() || phone.length < 10) return toast('Nome e telefone são obrigatórios.', 'warn');
    const payload = {
      name: form.name.trim(),
      phone,
      plan_name: form.plan_name.trim() || null,
      monthly_value: numberFromCurrency(form.monthly_value),
      payment_method: form.payment_method || null,
      due_day: form.due_day ? Number(form.due_day) : null,
      notes: form.notes.trim() || null,
      barber_id: form.barber_id || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = client?.id
      ? await supabase.from('plan_clients').update(payload).eq('id', client.id)
      : await supabase.from('plan_clients').insert(payload);
    if (error) toast(`Erro: ${error.message}`, 'error');
    else {
      toast('Cliente salvo.', 'success');
      onSaved();
    }
  };
  return (
    <Modal title={client ? 'Editar cliente plano' : 'Novo cliente plano'} onClose={onClose}>
      <div className="form-card modal-form">
        <label className="field"><span>Nome completo</span><input value={form.name} onChange={(e) => update('name', e.target.value)} /></label>
        <label className="field"><span>Telefone</span><input value={form.phone} onChange={(e) => update('phone', maskPhoneInput(e.target.value))} /></label>
        <label className="field"><span>Nome do plano</span><input value={form.plan_name} onChange={(e) => update('plan_name', e.target.value)} /></label>
        <label className="field"><span>Valor da mensalidade</span><input value={form.monthly_value} onChange={(e) => update('monthly_value', e.target.value)} /></label>
        <label className="field"><span>Forma de pagamento</span><select value={form.payment_method} onChange={(e) => update('payment_method', e.target.value)}><option value="">Selecionar</option><option>PIX</option><option>Dinheiro</option><option>Cartão de crédito</option><option>Cartão de débito</option><option>Outro</option></select></label>
        <label className="field"><span>Dia de vencimento</span><input value={form.due_day} type="number" min="1" max="31" onChange={(e) => update('due_day', e.target.value)} /></label>
        <label className="field"><span>Observações</span><textarea rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} /></label>
        {isSuperAdmin && (
          <label className="field">
            <span>Barbeiro responsável</span>
            <select value={form.barber_id} onChange={(e) => update('barber_id', e.target.value)}>
              <option value="">Sem vínculo</option>
              {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}
        <button className="primary-btn" onClick={save}>Salvar</button>
      </div>
    </Modal>
  );
}

function RecurringScheduleModal({ client, session, onClose }) {
  const toast = useToast();
  const { confirm, ConfirmUI } = useConfirm();
  const [rows, setRows] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({ day_of_week: 1, appointment_time: '09:00', barber_id: session.barberId || '', service_id: '', is_active: true });

  const load = async () => {
    let recQuery = supabase
      .from('recurring_schedules')
      .select('id,day_of_week,appointment_time,is_active,barber_id,barbers!barber_id(id,name),services!service_id(id,name,duration_blocks)')
      .eq('plan_client_id', client.id);
    if (session.barberId) recQuery = recQuery.eq('barber_id', session.barberId);
    let barberQuery = supabase.from('barbers').select('id,name').order('name');
    if (session.barberId) barberQuery = barberQuery.eq('id', session.barberId);
    const [rec, bs, ss] = await Promise.all([
      recQuery.order('day_of_week').order('appointment_time'),
      barberQuery,
      supabase.from('services').select('id,name,duration_blocks').order('name'),
    ]);
    setRows(rec.data ?? []);
    setBarbers(bs.data ?? []);
    setServices(ss.data ?? []);
    if (!form.barber_id && (bs.data ?? []).length) setForm((current) => ({ ...current, barber_id: bs.data[0].id }));
    if (!form.service_id && (ss.data ?? []).length) setForm((current) => ({ ...current, service_id: ss.data[0].id }));
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.barber_id || !form.service_id) return toast('Selecione barbeiro e serviço.', 'warn');
    const { error } = await supabase.from('recurring_schedules').insert({
      plan_client_id: client.id,
      barber_id: form.barber_id,
      service_id: form.service_id,
      day_of_week: Number(form.day_of_week),
      appointment_time: `${hhmm(form.appointment_time)}:00`,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    });
    if (error) toast(`Erro: ${error.message}`, 'error');
    else {
      toast('Recorrente salvo.', 'success');
      load();
    }
  };
  const remove = async (row) => {
    const ok = await confirm('Remover este agendamento recorrente?', { title: 'Remover recorrente', confirmLabel: 'Remover', confirmClass: 'danger-btn' });
    if (!ok) return;
    const { error } = await supabase.from('recurring_schedules').delete().eq('id', row.id);
    if (error) toast(`Erro: ${error.message}`, 'error');
    else load();
  };

  return (
    <Modal title={`Recorrentes · ${client.name}`} onClose={onClose}>
      <div className="form-card modal-form">
        <div className="filters-row">
          <label className="field"><span>Dia</span><select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>{weekDays.map((d, i) => <option value={i} key={d}>{d}</option>)}</select></label>
          <label className="field"><span>Horário</span><input type="time" value={form.appointment_time} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })} /></label>
        </div>
        <label className="field"><span>Barbeiro</span><select value={form.barber_id} disabled={Boolean(session.barberId)} onChange={(e) => setForm({ ...form, barber_id: e.target.value })}>{barbers.map((b) => <option value={b.id} key={b.id}>{b.name}</option>)}</select></label>
        <label className="field"><span>Serviço</span><select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>{services.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
        <label className="check-line"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Ativo</label>
        <button className="primary-btn compact" onClick={save}>Adicionar recorrente</button>
        <div className="stack">
          {rows.map((row) => <article className="list-card compact-list" key={row.id}><div><strong>{weekDays[row.day_of_week]} · {hhmm(row.appointment_time)}</strong><span>{row.barbers?.name} · {row.services?.name}</span></div><button className="icon-btn red" onClick={() => remove(row)}><Trash2 size={16} /></button></article>)}
        </div>
      </div>
      {ConfirmUI}
    </Modal>
  );
}

function ClientsDashboard({ session, onBack }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const inactive = await loadInactiveClients(session.barberId);
    setClients(inactive);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <AdminPage title="Remarcar Clientes" onBack={onBack} action={<button className="icon-btn gold" onClick={load} aria-label="Atualizar"><RefreshCw size={18} /></button>}>
      {loading ? <LoadingBlock /> : clients.length === 0 ? (
        <div className="remarcar-empty">
          <div className="remarcar-empty-icon">
            <CheckCircle2 size={52} />
          </div>
          <strong>Todos os clientes visitaram<br />nos últimos 30 dias!</strong>
          <span>Nenhum cliente inativo encontrado.</span>
        </div>
      ) : (
        <div className="stack">
          {clients.map((client) => {
            const days = Math.floor((Date.now() - client.lastVisit.getTime()) / 86400000);
            const text = encodeURIComponent(`Olá ${client.name}, sentimos sua falta na TD Barbearia. Quer agendar um horário?`);
            return (
              <article className="list-card" key={client.phone}>
                <span className="round-icon"><Users size={20} /></span>
                <div>
                  <strong>{client.name}</strong>
                  <span>{formatPhone(client.phone)}</span>
                  <small>Última visita: {formatDate(client.lastVisit, { day: '2-digit', month: '2-digit', year: 'numeric' })} · há {days} dias</small>
                </div>
                <a className="icon-btn gold" href={`https://wa.me/55${client.phone}?text=${text}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>
              </article>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

async function uploadFile(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export default App;
