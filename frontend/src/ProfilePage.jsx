import { useEffect, useState } from 'react';
import { api, setAuthSession } from './api';
import GoogleSignIn from './GoogleSignIn';

export default function ProfilePage({ user, config, onUserChange, notify }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', city: '', bio: '' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [loadError, setLoadError] = useState('');
  function accept(data) {
    setProfile(data);setForm({ name: data.name, phone: data.phone || '', city: data.city || '', bio: data.bio || '' });
  }
  useEffect(() => {
    let alive = true;
    api('/profile').then(data => { if (alive) accept(data); }).catch(error => { if (alive) setLoadError(error.message); });
    return () => { alive = false; };
  }, [user.id]);
  async function save(event) {
    event.preventDefault();setBusy(true);
    try { const data = await api('/profile', { method: 'PUT', body: form });accept(data);onUserChange({ ...user, name: data.name });notify('Your profile has been updated.'); }
    catch (error) { notify(error.message, true); } finally { setBusy(false); }
  }
  async function updatePassword(event) {
    event.preventDefault();
    if (password.newPassword !== password.confirm) { notify('The new passwords do not match.', true);return; }
    setChangingPassword(true);
    try {
      const response = await api('/profile/password', { method: 'PUT', body: { currentPassword: password.currentPassword, newPassword: password.newPassword } });
      onUserChange(setAuthSession(response));setProfile({ ...profile, passwordLoginEnabled: true });
      setPassword({ currentPassword: '', newPassword: '', confirm: '' });notify('Password updated. Your other sign-ins have been revoked.');
    } catch (error) { notify(error.message, true); } finally { setChangingPassword(false); }
  }
  if (loadError) return <div className="error-banner" role="alert">{loadError}</div>;
  if (!profile) return <div className="empty" role="status">Loading your profile…</div>;
  return <section className="profile-page container-fluid px-0">
    <div className="page-heading"><div className="eyebrow subtle">YOUR RENTORA ACCOUNT</div><h1>{user.role === 'ADMIN' ? 'Your admin profile.' : 'A little more about you.'}</h1><p>Keep your details current and manage how you sign in.</p></div>
    <div className="row g-4">
      <div className="col-lg-7"><div className="card profile-card"><div className="d-flex align-items-center gap-3 mb-4"><div className="profile-avatar">{profile.name[0].toUpperCase()}</div><div><h2>{profile.name}</h2><span className="status status-approved">{profile.role === 'ADMIN' ? 'Administrator' : 'Customer'}</span></div></div>
        <form className="form-stack" onSubmit={save}>
          <label>Full name<input className="form-control" required minLength={2} maxLength={80} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></label>
          <label>Email address<input className="form-control" type="email" value={profile.email} readOnly/></label>
          <div className="two-fields"><label>Phone number<input className="form-control" type="tel" maxLength={20} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })}/></label><label>City<input className="form-control" maxLength={80} value={form.city} onChange={event => setForm({ ...form, city: event.target.value })}/></label></div>
          <label>About you<textarea className="form-control" rows={4} maxLength={500} value={form.bio} onChange={event => setForm({ ...form, bio: event.target.value })}/></label>
          <p className="helper">Your email and account role are managed by Rentora and cannot be changed here.</p>
          <button className="btn btn-primary align-self-start" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        </form>
      </div></div>
      <div className="col-lg-5"><div className="card profile-card mb-4"><h2>Sign-in security</h2><p className="modal-description">{profile.passwordLoginEnabled ? 'Choose a strong password for your account.' : 'You signed up with Google. You can also add a password.'}</p>
        <form className="form-stack" onSubmit={updatePassword}>
          {profile.passwordLoginEnabled && <label>Current password<input className="form-control" required type="password" maxLength={72} autoComplete="current-password" value={password.currentPassword} onChange={event => setPassword({ ...password, currentPassword: event.target.value })}/></label>}
          <label>New password<input className="form-control" required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={password.newPassword} onChange={event => setPassword({ ...password, newPassword: event.target.value })}/></label>
          <label>Confirm new password<input className="form-control" required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={password.confirm} onChange={event => setPassword({ ...password, confirm: event.target.value })}/></label>
          <button className="btn btn-outline-primary" disabled={changingPassword}>{changingPassword ? 'Updating…' : profile.passwordLoginEnabled ? 'Update password' : 'Add password'}</button>
        </form>
      </div><div className="card profile-card"><h2>Connected accounts</h2>{profile.googleLinked ? <div className="alert alert-success mt-3 mb-0" role="status">Google account connected.</div> : <><p className="modal-description">Connect the Google account that uses your Rentora email address.</p><GoogleSignIn config={config} link onSuccess={data => { accept(data);notify('Your Google account is connected.'); }}/></>}</div></div>
    </div>
  </section>;
}
