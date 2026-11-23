import { useCallback, useEffect, useRef, useState } from 'react';
import { api, clearAuthSession, hasAuthToken, setAuthSession } from './api';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AuthPage from './AuthPage';
import ProfilePage from './ProfilePage';
import EquipmentArt from './EquipmentArt';
import ProductPhotos, { ProductImage, AdminPhotoEditor, conditionLabel } from './ProductPhotos';
import { CustomerListingsPage, AdminListingsPage } from './ListingPages';
import './marketplace.css';

const CATEGORIES = ['All equipment', 'Cameras', 'Tools', 'Outdoor', 'Electronics', 'Events'];
const MONEY = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const money = value => MONEY.format(Number(value || 0));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateLabel = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const statusLabel = value => value[0] + value.slice(1).toLowerCase();
const blankEquipment = { name: '', category: 'Cameras', description: '', dailyRate: '' };

function Icon({ name, size = 20 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    bag: <><path d="M5 7h14l2 14H3L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    plus: <path d="M12 4v16M4 12h16"/>,
    logout: <><path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11"/></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
    chart: <><path d="M4 3v18h17M9 16v-5m5 5V7m5 9V4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.bag}</svg>;
}

function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => { dialog.close(); previousFocus?.focus(); };
  }, []);
  return <dialog ref={ref} className={'rentora-modal ' + (wide ? 'wide-modal' : '')} onCancel={onClose} onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [bookings, setBookings] = useState([]);
  const go = useNavigate();
  const location = useLocation();
  const page = ['/my-listings', '/admin/listings'].includes(location.pathname) ? 'listings' : location.pathname.includes('profile') ? 'profile' : location.pathname === '/admin/equipment' ? 'inventory' : ['/rentals', '/admin/bookings'].includes(location.pathname) ? 'rentals' : ['/login', '/register'].includes(location.pathname) ? 'auth' : 'catalogue';
  const [authConfig, setAuthConfig] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All equipment');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [connectionError, setConnectionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [bookingFilter, setBookingFilter] = useState('ALL');
  const toastTimer = useRef();
  const isAdmin = user?.role === 'ADMIN';
  const notify = useCallback((message, error = false) => {
    clearTimeout(toastTimer.current); setToast({ message, error });
    toastTimer.current = setTimeout(() => setToast(null), 5500);
  }, []);
  const loadCatalogue = useCallback(async () => setEquipment(await api('/equipment', { skipAuth: true })), []);
  const loadBookings = useCallback(async () => {
    if (!user) { setBookings([]); return; }
    setBookings(await api(isAdmin ? '/admin/bookings' : '/bookings/mine'));
  }, [user, isAdmin]);

  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        const [items, config] = await Promise.all([api('/equipment', { skipAuth: true }), api('/auth/config', { skipAuth: true })]);
        if (alive) setAuthConfig(config);
        if (!alive) return;
        setEquipment(items);
        try { if (hasAuthToken()) { const account = await api('/auth/me'); if (alive) setUser(account); } }
        catch (error) { if (error.status !== 401) throw error; }
      } catch { if (alive) setConnectionError('Cannot reach Rentora. Start the Spring Boot backend on port 8080, then refresh this page.'); }
      finally { if (alive) setLoading(false); }
    }
    init(); return () => { alive = false; };
  }, []);
  useEffect(() => { loadBookings().catch(error => notify(error.message, true)); }, [loadBookings, notify]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  async function mutate(path, method = 'PATCH', body, success = 'Saved successfully.') {
    setWorking(true);
    try { await api(path, { method, ...(body === undefined ? {} : { body }) }); await Promise.all([loadCatalogue(), loadBookings()]); notify(success); return true; }
    catch (error) { notify(error.message, true); return false; }
    finally { setWorking(false); }
  }
  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); clearAuthSession(); setUser(null); setBookings([]); go('/'); notify('You have been logged out.'); }
    catch (error) { notify(error.message, true); }
  }
  function navigate(next) {
    const paths = { catalogue: '/', rentals: isAdmin ? '/admin/bookings' : '/rentals', inventory: '/admin/equipment', listings: isAdmin ? '/admin/listings' : '/my-listings', profile: isAdmin ? '/admin/profile' : '/profile' };
    go(paths[next] || '/'); setQuery('');
  }
  function startBooking(item) {
    if (!user) { go('/login', { state: { bookingItem: item } }); return; }
    setModal({ type: 'book', item });
  }
  function authenticated(response) {
    const account = setAuthSession(response);
    setUser(account);
    const from = location.state?.from;
    if (location.state?.bookingItem && account.role === 'CUSTOMER') {
      setModal({ type: 'book', item: location.state.bookingItem }); go('/');
    } else {
      const allowed = account.role === 'ADMIN' ? ['/admin/bookings', '/admin/equipment', '/admin/profile', '/admin/listings'] : ['/rentals', '/profile', '/my-listings'];
      go(allowed.includes(from) ? from : account.role === 'ADMIN' ? '/admin/bookings' : '/rentals', { replace: true });
    }
    notify(`Welcome, ${account.name.split(' ')[0]}!`);
  }
  useEffect(() => {
    const expired = () => { setUser(null); setBookings([]); notify('Your sign-in expired. Please sign in again.', true); };
    window.addEventListener('rentora:unauthorized', expired);
    return () => window.removeEventListener('rentora:unauthorized', expired);
  }, [notify]);
  const visibleItems = equipment.filter(item => (category === 'All equipment' || item.category === category) && `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  const visibleBookings = bookings.filter(b => (bookingFilter === 'ALL' || b.status === bookingFilter) && `${b.equipmentName} ${b.customerName} ${b.customerEmail} ${b.id}`.toLowerCase().includes(query.toLowerCase()));

  const catalogueScreen = (<>
          <section className="hero">
            <div className="hero-copy"><div className="eyebrow"><span className="live-dot"/>LESS OWNING. MORE DOING.</div><h1>Own the moment.<br/><span>Rent the equipment.</span></h1><p>From weekend adventures to your next big idea.<br className="desktop-only"/> Find the right gear, without the full-time price tag.</p><button className="button dark" onClick={() => document.getElementById('catalogue').scrollIntoView({ behavior: 'smooth' })}>Find your gear <Icon name="arrow" size={18}/></button><div className="hero-foot"><Icon name="check" size={16}/>Flexible dates<span>·</span><Icon name="check" size={16}/>Transparent pricing</div></div>
            <div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="visual-sticker">A LITTLE GEAR.<br/>A LOT OF POSSIBILITY. <span>✦</span></div><div className="hero-art"><EquipmentArt category="Cameras"/></div><div className="floating-label"><span>↗</span><div>Make it happen.<small>We'll bring the gear.</small></div></div><span className="hero-star">✳</span></div>
          </section>
          <section id="catalogue" className="catalogue-section">
            <div className="section-top"><div><div className="eyebrow subtle">THE GOOD STUFF, ON YOUR TERMS</div><h2>What are you planning?</h2></div><label className="search-box"><Icon name="search"/><input aria-label="Search equipment" placeholder="Search cameras, tools, and more…" value={query} onChange={event => setQuery(event.target.value)}/></label></div>
            <div className="category-row">{CATEGORIES.map(cat => <button key={cat} className={category === cat ? 'category active' : 'category'} onClick={() => setCategory(cat)}>{cat}</button>)}</div>
            <div className="results-line"><span>{loading ? 'Finding your next rental…' : `${visibleItems.length} items to make it happen`}</span><span>One item. Your chosen dates.</span></div>
            <div className="equipment-grid">{visibleItems.map(item => <article className="equipment-card" key={item.id}>
              <div className={'art-panel art-' + item.category.toLowerCase() + (item.photos?.length ? ' has-product-photo' : '')}><span className="equipment-category">{item.category}</span><span className={item.active ? 'stock-label' : 'stock-label unavailable'}>{item.active ? 'Check dates' : 'Maintenance'}</span>{item.photos?.length ? <><ProductImage photo={item.photos[0]} alt={item.name} className="product-cover"/><div className="product-icon-badge"><EquipmentArt category={item.category} small/></div></> : <EquipmentArt category={item.category}/>}</div>
              <div className="card-body"><h3>{item.name}</h3><p>{item.description}</p><button className="product-condition-button" onClick={() => setModal({ type: 'gallery', item })}>{conditionLabel(item.itemCondition)} · {item.photos?.length || 0} photos — View condition</button><div className="card-bottom"><div className="price">{money(item.dailyRate)}<span> / day</span>{item.ownerId === user?.id && <div className="owner-hint">Your equipment</div>}</div><button className="rent-button" disabled={!item.active || isAdmin || item.ownerId === user?.id} onClick={() => startBooking(item)} aria-label={'Rent ' + item.name}><Icon name="arrow" size={19}/></button></div></div>
            </article>)}</div>
            {!loading && !visibleItems.length && <Empty title="No equipment found" text="Try another search or choose a different category."/>}
            {isAdmin && <p className="helper">You are browsing as an admin. Use a customer account to place a rental request.</p>}
          </section>
          <section className="promise-strip"><div><Icon name="clock"/><strong>Only for the time you need</strong><span>Choose dates that work for you.</span></div><div><Icon name="shield"/><strong>Every request, accounted for</strong><span>Track approval and return status.</span></div><div><Icon name="check"/><strong>No pricing surprises</strong><span>See your rental amount upfront.</span></div></section>
        </>);
  const rentalScreen = (<>
          <PageHeading eyebrow={isAdmin ? 'THE OPERATIONS DESK' : 'YOUR NEXT CHAPTER'} title={isAdmin ? 'Every rental, in one place.' : 'Good gear. Great plans.'} text={isAdmin ? 'Review requests, approve rentals, and keep returns on track.' : 'Your upcoming plans and past adventures, all accounted for.'}/>
          <div className="stats-grid"><Stat label="Total bookings" value={bookings.length}/><Stat label="Awaiting approval" value={bookings.filter(b => b.status === 'PENDING').length}/><Stat label="Approved rentals" value={bookings.filter(b => b.status === 'APPROVED').length}/><Stat label={isAdmin ? 'Completed rental value' : 'Completed rentals'} value={isAdmin ? money(bookings.filter(b => b.status === 'RETURNED').reduce((sum, b) => sum + Number(b.total), 0)) : bookings.filter(b => b.status === 'RETURNED').length}/></div>
          <div className="bookings-toolbar"><h2>{isAdmin ? 'Booking requests' : 'My bookings'}</h2><div className="toolbar-controls"><input className="text-input" aria-label="Search bookings" placeholder="Search bookings…" value={query} onChange={event => setQuery(event.target.value)}/><select aria-label="Filter bookings by status" value={bookingFilter} onChange={event => setBookingFilter(event.target.value)}><option value="ALL">All statuses</option>{['PENDING','APPROVED','REJECTED','CANCELLED','RETURNED'].map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><button className="button secondary small" onClick={() => loadBookings().catch(error => notify(error.message,true))}>Refresh</button></div></div>
          <div className="booking-list">{visibleBookings.map(b => <article className="booking-card" key={b.id}>
            <div className={'booking-art art-' + b.category.toLowerCase()}><EquipmentArt category={b.category} small/></div>
            <div className="booking-detail"><div className="booking-title"><span className="eyebrow subtle">RENTAL #{String(b.id).padStart(4, '0')}</span><span className={'status status-' + b.status.toLowerCase()}>{statusLabel(b.status)}</span></div><h3>{b.equipmentName}</h3><p>{dateLabel(b.startDate)} <span>→</span> {dateLabel(b.endDate)} <span>·</span> {b.days} {b.days === 1 ? 'day' : 'days'}</p>{isAdmin && <p className="customer-line">{b.customerName} <span>·</span> {b.customerEmail}</p>}<div className="booking-money"><span>Rental <strong>{money(b.rentalAmount)}</strong></span>{Number(b.lateFee) > 0 && <span className="late-fee">{b.status === 'RETURNED' ? 'Late fee' : 'Estimated late fee'} <strong>{money(b.lateFee)}</strong></span>}<span>Total <strong>{money(b.total)}</strong></span></div>{b.returnedDate && <p className="helper">Returned on {dateLabel(b.returnedDate)}</p>}</div>
            <div className="booking-actions">{isAdmin && b.status === 'PENDING' && <><button className="button dark small" disabled={working} onClick={() => mutate(`/admin/bookings/${b.id}/approve`, 'PATCH', undefined, 'Rental approved.')}>Approve</button><button className="button secondary small danger-text" disabled={working} onClick={() => setModal({ type: 'confirm', title: 'Reject this request?', text: 'The customer will see this request as rejected and the dates will become available.', path: `/admin/bookings/${b.id}/reject`, success: 'Request rejected.' })}>Reject</button></>}{isAdmin && b.status === 'APPROVED' && <button className="button dark small" disabled={working} onClick={() => setModal({ type: 'return', booking: b })}>Record return</button>}{!isAdmin && ['PENDING','APPROVED'].includes(b.status) && b.startDate >= today() && <button className="button secondary small" disabled={working} onClick={() => setModal({ type: 'confirm', title: 'Cancel this booking?', text: 'This will release the reserved dates. You can make a new booking whenever you are ready.', path: `/bookings/${b.id}/cancel`, success: 'Booking cancelled.' })}>Cancel booking</button>}</div>
          </article>)}</div>
          {!visibleBookings.length && <Empty title="A little quiet here." text="Your booking requests will appear here."/>}
          <p className="helper">Rental days include both start and end dates. Late returns add one daily rental rate per overdue day. Amounts are rental records; online payment is not integrated.</p>
        </>);
  const inventoryScreen = (<>
          <div className="heading-with-action"><PageHeading eyebrow="KEEP THE POSSIBILITIES COMING" title="Your equipment collection." text="Add new gear, update pricing, and manage maintenance."/><button className="button dark" onClick={() => setModal({ type: 'equipment' })}><Icon name="plus"/>Add equipment</button></div>
          <div className="inventory-list">{equipment.map(item => <article className="inventory-item" key={item.id}><div className={'inventory-art art-' + item.category.toLowerCase()}><EquipmentArt category={item.category} small/></div><div className="inventory-info"><h3>{item.name}</h3><p>{item.category} <span>·</span> {money(item.dailyRate)} / day</p></div><span className={item.active ? 'status status-approved' : 'status status-pending'}>{item.active ? 'Listed' : 'Maintenance'}</span><button className="button secondary small" onClick={() => setModal({ type: 'equipment', item })}>Edit</button><button className="button secondary small" onClick={() => setModal({ type: 'photos', item })}>Photos</button><button className="button secondary small" disabled={working} onClick={() => mutate(`/admin/equipment/${item.id}/active`, 'PATCH', { active: !item.active }, item.active ? 'Equipment marked under maintenance.' : 'Equipment is listed again.')}>{item.active ? 'Maintenance' : 'List again'}</button></article>)}</div>
          {!equipment.length && <Empty title="Start your collection" text="Add your first piece of equipment to make it available for rentals."/>}
        </>);

  return <div className="app-shell">
    <aside className="sidebar">
      <a href="#" className="brand" onClick={event => { event.preventDefault(); navigate('catalogue'); }}><span className="brand-mark">r<span>↗</span></span>rentora<span className="brand-dot">.</span></a>
      <div className="workspace-label">YOUR RENTAL SPACE</div>
      <nav aria-label="Main navigation">
        <button className={page === 'catalogue' ? 'nav-item selected' : 'nav-item'} onClick={() => navigate('catalogue')}><Icon name="grid"/>Explore equipment<Icon name="arrow" size={16}/></button>
        <button className={page === 'rentals' ? 'nav-item selected' : 'nav-item'} onClick={() => navigate('rentals')}><Icon name="bag"/>{isAdmin ? 'Manage bookings' : 'My rentals'}</button>
        {isAdmin && <button className={page === 'inventory' ? 'nav-item selected' : 'nav-item'} onClick={() => navigate('inventory')}><Icon name="chart"/>Equipment manager</button>}
        {user && <button className={page === 'listings' ? 'nav-item selected' : 'nav-item'} onClick={() => navigate('listings')}><Icon name="plus"/>{isAdmin ? 'Review listings' : 'List my equipment'}</button>}
        {user && <button className={page === 'profile' ? 'nav-item selected' : 'nav-item'} onClick={() => navigate('profile')}><Icon name="shield"/>My profile</button>}
      </nav>
      <div className="sidebar-note"><span className="note-icon">↗</span><h3>Big plans.<br/>Small commitments.</h3><p>Get the gear you need,<br/>for just the time you need it.</p><span className="tiny-tag">RENT. CREATE. REPEAT.</span></div>
      <div className="sidebar-bottom"><Icon name="shield" size={17}/><span>Simple rentals. Real possibilities.</span></div>
    </aside>

    <div className="main-column">
      <header className="topbar">
        <span className="breadcrumb">Your workspace <span>/</span> <strong>{page === 'catalogue' ? 'Explore' : page === 'inventory' ? 'Inventory' : page === 'profile' ? 'Profile' : page === 'auth' ? 'Account' : page === 'listings' ? 'Equipment listings' : 'Bookings'}</strong></span>
        <div className="account-actions">{user ? <><div className="account-avatar">{user.name[0].toUpperCase()}</div><div className="account-info"><strong>{user.name}</strong><span>{isAdmin ? 'Administrator' : 'Customer account'}</span></div><button className="icon-button" title="Log out" aria-label="Log out" onClick={logout}><Icon name="logout"/></button></> : <><span className="muted desktop-only">Your next project starts here.</span><button className="button dark small" onClick={() => go('/login')}>Sign in <Icon name="arrow" size={16}/></button></>}</div>
      </header>
      <main>
        {connectionError && <div className="error-banner" role="alert">{connectionError}</div>}
        <Routes>
          <Route path="/" element={catalogueScreen}/>
          <Route path="/login" element={user ? <Navigate to={isAdmin ? '/admin/bookings' : '/rentals'} replace/> : <AuthPage config={authConfig} onSuccess={authenticated}/>}/>
          <Route path="/register" element={user ? <Navigate to={isAdmin ? '/admin/bookings' : '/rentals'} replace/> : <AuthPage key="register" register config={authConfig} onSuccess={authenticated}/>}/>
          <Route path="/rentals" element={<Guard user={user} loading={loading} role="CUSTOMER">{rentalScreen}</Guard>}/>
          <Route path="/admin/bookings" element={<Guard user={user} loading={loading} role="ADMIN">{rentalScreen}</Guard>}/>
          <Route path="/admin/equipment" element={<Guard user={user} loading={loading} role="ADMIN">{inventoryScreen}</Guard>}/>
          <Route path="/my-listings" element={<Guard user={user} loading={loading} role="CUSTOMER">{user && <CustomerListingsPage user={user} notify={notify}/>}</Guard>}/>
          <Route path="/admin/listings" element={<Guard user={user} loading={loading} role="ADMIN"><AdminListingsPage notify={notify} onCatalogueChange={loadCatalogue}/></Guard>}/>
          <Route path="/profile" element={<Guard user={user} loading={loading} role="CUSTOMER">{user && <ProfilePage user={user} config={authConfig} onUserChange={setUser} notify={notify}/>}</Guard>}/>
          <Route path="/admin/profile" element={<Guard user={user} loading={loading} role="ADMIN">{user && <ProfilePage user={user} config={authConfig} onUserChange={setUser} notify={notify}/>}</Guard>}/>
          <Route path="*" element={<div className="empty"><h2>This page took a different route.</h2><p className="mt-3"><Link to="/">Back to equipment</Link></p></div>}/>
        </Routes>
        <footer><span className="footer-brand">rentora.</span><span>A little less owning. A little more living.</span><span>Built for your next big idea.</span></footer>
      </main>
    </div>
    {toast && <div className={'rentora-toast ' + (toast.error ? 'toast-error' : '')} role={toast.error ? 'alert' : 'status'}><Icon name={toast.error ? 'close' : 'check'}/>{toast.message}<button aria-label="Dismiss notification" onClick={() => setToast(null)}>×</button></div>}
    {modal?.type === 'gallery' && <Modal title={modal.item.name} onClose={() => setModal(null)} wide><ProductPhotos item={modal.item}/></Modal>}
    {modal?.type === 'photos' && <Modal title="Photos and product condition" onClose={() => setModal(null)}><AdminPhotoEditor item={modal.item} onSaved={async () => { await loadCatalogue();setModal(null);notify('Product photos and condition updated.'); }}/></Modal>}
    {modal?.type === 'book' && <BookingModal item={modal.item} onClose={() => setModal(null)} onBooked={async () => { setModal(null); go('/rentals'); await loadBookings(); notify('Request sent! Your equipment is reserved while the admin reviews it.'); }}/>} 
    {modal?.type === 'equipment' && <EquipmentModal item={modal.item} onClose={() => setModal(null)} onSave={async body => { const ok = await mutate(modal.item ? `/admin/equipment/${modal.item.id}` : '/admin/equipment', modal.item ? 'PUT' : 'POST', body, 'Equipment saved.'); if (ok) setModal(null); }} working={working}/>} 
    {modal?.type === 'return' && <ReturnModal booking={modal.booking} onClose={() => setModal(null)} working={working} onSave={async returnedDate => { if (await mutate(`/admin/bookings/${modal.booking.id}/return`, 'PATCH', { returnedDate }, 'Return recorded and final charges calculated.')) setModal(null); }}/>} 
    {modal?.type === 'confirm' && <Modal title={modal.title} onClose={() => setModal(null)}><p className="modal-description">{modal.text}</p><div className="form-actions"><button className="button secondary" onClick={() => setModal(null)}>Go back</button><button className="button dark" disabled={working} onClick={async () => { if (await mutate(modal.path,'PATCH',undefined,modal.success)) setModal(null); }}>{working ? 'Saving…' : 'Confirm'}</button></div></Modal>}
  </div>;
}

function PageHeading({ eyebrow, title, text }) { return <div className="page-heading"><div className="eyebrow subtle">{eyebrow}</div><h1>{title}</h1><p>{text}</p></div>; }
function Stat({ label, value }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>; }
function Empty({ title, text }) { return <div className="empty"><Icon name="bag" size={34}/><h3>{title}</h3><p>{text}</p></div>; }

function Guard({ user, loading, role, children }) {
  const location = useLocation();
  if (loading) return <div className="empty" role="status">Loading your workspace…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace/>;
  if (user.role !== role) return <Navigate to={user.role === 'ADMIN' ? '/admin/bookings' : '/rentals'} replace/>;
  return children;
}

function BookingModal({ item, onClose, onBooked }) {
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true; setChecking(true); setError(''); setAvailability(null);
    api(`/equipment/${item.id}/availability?start=${start}&end=${end}`).then(data => { if (alive) setAvailability(data); }).catch(err => { if (alive) setError(err.message); }).finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [start, end, item.id]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/bookings', { method: 'POST', body: { equipmentId: item.id, startDate: start, endDate: end } }); await onBooked(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Modal title="Make it yours. For a while." onClose={onClose}><div className="booking-summary"><div className={'summary-art art-' + item.category.toLowerCase()}><EquipmentArt category={item.category} small/></div><div><h3>{item.name}</h3><p>{money(item.dailyRate)} / day</p></div></div><ProductPhotos item={item}/><form className="form-stack" onSubmit={submit}><div className="two-fields"><label>Start date<input type="date" required min={today()} value={start} onChange={event => { setStart(event.target.value); if (event.target.value > end) setEnd(event.target.value); }}/></label><label>End date<input type="date" required min={start || today()} value={end} onChange={event => setEnd(event.target.value)}/></label></div><div className="price-summary"><span>{availability ? `${availability.days} ${availability.days === 1 ? 'day' : 'days'} × ${money(item.dailyRate)}` : 'Rental estimate'}<strong>{availability ? money(availability.total) : '—'}</strong></span><small>Both start and end dates are included. Maximum rental: 90 days.</small></div>{checking ? <p className="helper">Checking availability…</p> : availability && <p className={availability.available ? 'availability-yes' : 'form-error'}>{availability.available ? '✓ Available for these dates' : 'Already reserved or under maintenance. Try different dates.'}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button dark full" disabled={busy || checking || !availability?.available}>{busy ? 'Sending request…' : 'Request booking'}<Icon name="arrow" size={18}/></button><p className="helper">Dates are reserved immediately while the admin reviews your request. Late returns add {money(item.dailyRate)} per overdue day.</p></form></Modal>;
}

function EquipmentModal({ item, onClose, onSave, working }) {
  const [form, setForm] = useState(item ? { name: item.name, category: item.category, description: item.description, dailyRate: item.dailyRate } : blankEquipment);
  const change = event => setForm({ ...form, [event.target.name]: event.target.value });
  return <Modal title={item ? 'Give your gear an update.' : 'Add something great.'} onClose={onClose}><form className="form-stack" onSubmit={event => { event.preventDefault(); onSave({ ...form, dailyRate: Number(form.dailyRate) }); }}><label>Equipment name<input name="name" required minLength={2} maxLength={100} value={form.name} onChange={change}/></label><div className="two-fields"><label>Category<select name="category" value={form.category} onChange={change}>{CATEGORIES.slice(1).map(cat => <option key={cat}>{cat}</option>)}</select></label><label>Daily rate (₹)<input name="dailyRate" type="number" required min="1" max="1000000" step="0.01" value={form.dailyRate} onChange={change}/></label></div><label>Description<textarea name="description" required maxLength={1500} rows={4} value={form.description} onChange={change}/></label><p className="helper">Each listing represents one physical item. Existing bookings retain their original daily rate.</p><button className="button dark full" disabled={working}>{working ? 'Saving…' : 'Save equipment'}</button></form></Modal>;
}

function ReturnModal({ booking, onClose, onSave, working }) {
  const [returnedDate, setReturnedDate] = useState(today());
  const overdueDays = Math.max(0, Math.round((new Date(returnedDate + 'T00:00:00Z') - new Date(booking.endDate + 'T00:00:00Z')) / 86400000));
  return <Modal title="Back from a good adventure." onClose={onClose}><p className="modal-description">Record the actual return date for {booking.equipmentName}.</p><form className="form-stack" onSubmit={event => { event.preventDefault(); onSave(returnedDate); }}><label>Return date<input type="date" required min={booking.startDate} max={today()} value={returnedDate} onChange={event => setReturnedDate(event.target.value)}/></label><div className="price-summary"><span>Original rental<strong>{money(booking.rentalAmount)}</strong></span><span>Late fee ({overdueDays || 0} days)<strong>{money((overdueDays || 0) * Number(booking.dailyRate))}</strong></span><span className="total-row">Final total<strong>{money(Number(booking.rentalAmount) + (overdueDays || 0) * Number(booking.dailyRate))}</strong></span></div><button className="button dark full" disabled={working || booking.startDate > today()}>{working ? 'Saving…' : 'Confirm return'}</button>{booking.startDate > today() && <p className="form-error">This rental has not started yet.</p>}</form></Modal>;
}
