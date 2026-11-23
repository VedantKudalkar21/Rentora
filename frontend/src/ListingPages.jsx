import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import ProductPhotos, { PhotoUploadFields } from './ProductPhotos';

const CATEGORIES = ['Cameras', 'Tools', 'Outdoor', 'Electronics', 'Events'];
const blank = { name: '', category: 'Cameras', description: '', dailyRate: '', itemCondition: 'GOOD', conditionNotes: '' };
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
const label = status => ({ PENDING: 'Pending review', APPROVED: 'Approved', REJECTED: 'Rejected' }[status]);

function ListingCard({ listing, children, admin = false }) {
  const item = listing.equipment;
  return <article className="listing-card card"><div className="listing-card-heading"><div><h3>{item.name}</h3><p>{item.category} · {money(item.dailyRate)} / day</p></div><span className={'status status-' + listing.status.toLowerCase()}>{label(listing.status)}</span></div>
    <ProductPhotos item={item} privatePhotos={listing.status !== 'APPROVED'}/>
    <p className="listing-description">{item.description}</p>
    {admin && <p className="listing-owner"><strong>Owner:</strong> {item.ownerName}<br/>{listing.ownerEmail}</p>}
    {listing.reviewNote && <p className={'review-note ' + (listing.status === 'REJECTED' ? 'rejected-note' : '')}><strong>Admin review:</strong> {listing.reviewNote}</p>}
    {children}
  </article>;
}

export function CustomerListingsPage({ user, notify }) {
  const [form, setForm] = useState(blank);
  const [files, setFiles] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const load = useCallback(async () => {
    try { setListings(await api('/listings/mine'));setLoadError(''); }
    catch (error) { setLoadError(error.message); }
    finally { setLoading(false); }
  }, [user.id]);
  useEffect(() => { load(); }, [load]);
  const change = event => setForm({ ...form, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault();setFormError('');
    if (!files.length) { setFormError('Add at least one product photo before submitting.');return; }
    setBusy(true);
    try {
      const body = new FormData();
      body.append('listing', new Blob([JSON.stringify({ ...form, dailyRate: Number(form.dailyRate) })], { type: 'application/json' }));
      files.forEach(file => body.append('photos', file));
      const created = await api('/listings', { method: 'POST', body });
      setListings(previous => [created, ...previous]);setForm(blank);setFiles([]);setResetKey(previous => previous + 1);
      notify('Your equipment was submitted. It will appear in the catalogue after admin approval.');
    } catch (error) { setFormError(error.message); } finally { setBusy(false); }
  }
  return <section className="marketplace-page"><div className="page-heading"><div className="eyebrow subtle">PUT YOUR GEAR TO WORK</div><h1>Offer your equipment.</h1><p>Share the details, show its condition, and send it to our admin for review.</p></div>
    <div className="row g-4"><div className="col-xl-6"><div className="card listing-form-card"><h2>List a product for rent</h2><p className="modal-description">Each listing represents one physical item. Photos and condition notes help other customers choose confidently.</p>
      <form className="form-stack" onSubmit={submit}>
        <label>Product name<input name="name" required minLength={2} maxLength={100} value={form.name} onChange={change} placeholder="For example: Canon DSLR camera"/></label>
        <div className="two-fields"><label>Category<select name="category" value={form.category} onChange={change}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label><label>Daily rental rate (₹)<input name="dailyRate" type="number" min="1" max="1000000" step="0.01" required value={form.dailyRate} onChange={change}/></label></div>
        <label>Product description<textarea name="description" required maxLength={1500} rows={4} value={form.description} onChange={change} placeholder="Describe the item, included accessories, and what it can be used for."/></label>
        <label>Product condition<select name="itemCondition" value={form.itemCondition} onChange={change}><option value="LIKE_NEW">Like new</option><option value="GOOD">Good</option><option value="FAIR">Fair — visible wear</option></select></label>
        <label>Condition notes<textarea name="conditionNotes" required minLength={10} maxLength={1000} rows={3} value={form.conditionNotes} onChange={change} placeholder="Mention scratches, wear, missing accessories, or anything a renter should know."/></label>
        <PhotoUploadFields key={resetKey} files={files} onChange={setFiles}/>
        <div className="review-explanation">Your submission stays private until an admin checks the details and photos. You can follow its status here.</div>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="button dark full" disabled={busy}>{busy ? 'Sending for review…' : 'Submit for admin review'}</button>
      </form>
    </div></div><div className="col-xl-6"><div className="listing-history-heading"><h2>My submitted products</h2><button className="button secondary small" onClick={load}>Refresh</button></div>
      {loading && <p className="helper" role="status">Loading your submissions…</p>}
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {!loading && !loadError && !listings.length && <div className="empty"><h3>Your first listing starts here.</h3><p>Submit the form to send your equipment for review.</p></div>}
      <div className="listing-cards">{listings.map(listing => <ListingCard key={listing.equipment.id} listing={listing}/>)}</div>
    </div></div>
  </section>;
}

export function AdminListingsPage({ notify, onCatalogueChange }) {
  const [listings, setListings] = useState([]);
  const [filter, setFilter] = useState('PENDING');
  const [reasons, setReasons] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setListings(await api('/admin/listings'));setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function decide(id, approve) {
    const reason = reasons[id]?.trim() || '';
    if (!approve && reason.length < 5) { notify('Enter a rejection reason of at least five characters.', true);return; }
    setBusy(true);
    try {
      const updated = await api(`/admin/listings/${id}/${approve ? 'approve' : 'reject'}`, { method: 'PATCH', ...(approve ? {} : { body: { reason } }) });
      setListings(previous => previous.map(listing => listing.equipment.id === id ? updated : listing));
      await onCatalogueChange();notify(approve ? 'Listing approved and published in the catalogue.' : 'Listing rejected. The customer can see your reason.');
    } catch (err) { notify(err.message, true); } finally { setBusy(false); }
  }
  const shown = listings.filter(listing => filter === 'ALL' || listing.status === filter);
  return <section className="marketplace-page"><div className="page-heading"><div className="eyebrow subtle">CUSTOMER EQUIPMENT REVIEW</div><h1>Review before it goes live.</h1><p>Check the product, photos, condition, and owner details before publishing a listing.</p></div>
    <div className="listing-review-toolbar"><strong>{listings.filter(listing => listing.status === 'PENDING').length} pending submissions</strong><div className="d-flex gap-2"><select aria-label="Filter equipment submissions" value={filter} onChange={event => setFilter(event.target.value)}><option value="PENDING">Pending review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="ALL">All submissions</option></select><button className="button secondary small" onClick={load}>Refresh</button></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p className="helper" role="status">Loading equipment submissions…</p> : !shown.length && <div className="empty"><h3>No submissions in this view.</h3><p>New customer equipment will appear here for review.</p></div>}
    <div className="admin-listing-grid">{shown.map(listing => <ListingCard key={listing.equipment.id} listing={listing} admin>{listing.status === 'PENDING' && <div className="review-actions"><button className="button dark full" disabled={busy} onClick={() => decide(listing.equipment.id, true)}>Approve and publish</button><label>Reason if rejecting<textarea rows={2} maxLength={500} value={reasons[listing.equipment.id] || ''} onChange={event => setReasons({ ...reasons, [listing.equipment.id]: event.target.value })} placeholder="Explain what the customer needs to correct."/></label><button className="button secondary full danger-text" disabled={busy} onClick={() => decide(listing.equipment.id, false)}>Reject listing</button></div>}</ListingCard>)}</div>
  </section>;
}
