import { useEffect, useState } from 'react';
import { api, http } from './api';
import EquipmentArt from './EquipmentArt';

export const conditionLabel = condition => ({ LIKE_NEW: 'Like new', GOOD: 'Good', FAIR: 'Fair — visible wear' }[condition] || 'Good');

export function ProductImage({ photo, alt, privatePhoto = false, className = '' }) {
  const [source, setSource] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    let objectUrl;
    setError(false);setSource(null);
    if (!privatePhoto || !photo?.url) return;
    http.get(photo.url.replace(/^\/api/, ''), { responseType: 'blob' }).then(response => {
      objectUrl = URL.createObjectURL(response.data);
      if (alive) setSource(objectUrl); else URL.revokeObjectURL(objectUrl);
    }).catch(() => { if (alive) setError(true); });
    return () => { alive = false;if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photo?.url, privatePhoto]);
  if (!photo || error) return <div className={'photo-placeholder ' + className}>Photo unavailable</div>;
  if (privatePhoto && !source) return <div className={'photo-placeholder ' + className} role="status">Loading photo…</div>;
  return <img src={privatePhoto ? source : photo.url} alt={alt} className={className} loading="lazy" onError={() => setError(true)}/>;
}

export default function ProductPhotos({ item, privatePhotos = false }) {
  const photos = item.photos || [];
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [item.id]);
  return <div className="product-photos">
    {photos.length ? <>
      <div className="gallery-main"><ProductImage photo={photos[Math.min(selected, photos.length - 1)]} alt={item.name + ' product condition'} privatePhoto={privatePhotos}/></div>
      {photos.length > 1 && <div className="gallery-thumbnails">{photos.map((photo, index) => <button type="button" key={photo.id} className={selected === index ? 'selected' : ''} aria-label={'View product photo ' + (index + 1)} aria-pressed={selected === index} onClick={() => setSelected(index)}><ProductImage photo={photo} alt={'Product photo ' + (index + 1)} privatePhoto={privatePhotos}/></button>)}</div>}
    </> : <div className={'gallery-empty art-' + item.category.toLowerCase()}><EquipmentArt category={item.category}/><span>Photos have not been added yet.</span></div>}
    <div className="condition-box"><strong>Condition: {conditionLabel(item.itemCondition)}</strong><p>{item.conditionNotes || 'Detailed condition notes have not been added yet.'}</p><span>Listed by {item.ownerName || 'Rentora'}</span></div>
  </div>;
}

export function PhotoUploadFields({ files, onChange }) {
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);
  function choose(event) {
    const next = Array.from(event.target.files || []);
    const invalid = next.length > 4 ? 'Choose no more than four photos.' : next.some(file => !['image/jpeg', 'image/png'].includes(file.type)) ? 'Use JPG or PNG photos.' : next.some(file => file.size > 5 * 1024 * 1024) ? 'Each photo must be no larger than 5 MB.' : '';
    setError(invalid);
    if (invalid) { event.target.value = '';onChange([]);return; }
    onChange(next);
  }
  return <div className="photo-upload-fields"><label className="upload-label">Product photos<input type="file" accept="image/jpeg,image/png" multiple required onChange={choose}/></label><p className="helper">Add 1–4 JPG/PNG photos, up to 5 MB each. Show the full product and any scratches or wear.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="upload-previews">{previews.map((url, index) => <img src={url} alt={'Selected product photo ' + (index + 1)} key={url}/>)}</div></div>;
}

export function AdminPhotoEditor({ item, onSaved }) {
  const [condition, setCondition] = useState(item.itemCondition || 'GOOD');
  const [notes, setNotes] = useState(item.conditionNotes || '');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();setError('');
    if (!files.length) { setError('Choose at least one product photo.');return; }
    setBusy(true);
    try {
      const body = new FormData();
      body.append('condition', new Blob([JSON.stringify({ itemCondition: condition, conditionNotes: notes })], { type: 'application/json' }));
      files.forEach(file => body.append('photos', file));
      const updated = await api(`/admin/equipment/${item.id}/photos`, { method: 'POST', body });
      await onSaved(updated);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form className="form-stack" onSubmit={submit}><p className="modal-description">Add current photos of {item.name}. Saving replaces its current photo gallery.</p><label>Product condition<select value={condition} onChange={event => setCondition(event.target.value)}><option value="LIKE_NEW">Like new</option><option value="GOOD">Good</option><option value="FAIR">Fair — visible wear</option></select></label><label>Condition notes<textarea required minLength={10} maxLength={1000} rows={3} value={notes} onChange={event => setNotes(event.target.value)}/></label><PhotoUploadFields files={files} onChange={setFiles}/>{error && <p className="form-error" role="alert">{error}</p>}<button className="button dark full" disabled={busy}>{busy ? 'Saving photos…' : 'Save photos and condition'}</button></form>;
}
