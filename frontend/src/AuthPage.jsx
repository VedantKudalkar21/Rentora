import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from './api';
import GoogleSignIn from './GoogleSignIn';

export default function AuthPage({ register = false, config, onSuccess }) {
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = event => setForm({ ...form, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await api(register ? '/auth/register' : '/auth/login', {
        method: 'POST', skipAuth: true, body: register ? form : { email: form.email, password: form.password },
      });
      onSuccess(response);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className="auth-page container-fluid px-0"><div className="row g-4 align-items-center">
    <div className="col-lg-6 auth-intro"><div className="eyebrow">YOUR NEXT GREAT IDEA STARTS HERE</div><h1>{register ? 'Make room for possibility.' : 'Welcome back to possibility.'}</h1><p>One account. The right gear. More room to create, explore, and make things happen.</p><div className="auth-promise">✓ Flexible rental dates<br/>✓ Clear pricing and booking history<br/>✓ Equipment for work and weekends</div></div>
    <div className="col-lg-6"><div className="auth-card card"><h2>{register ? 'Create your account' : 'Sign in to Rentora'}</h2><p className="modal-description">{register ? 'Your next plan is one step closer.' : 'Good to have you here again.'}</p>
      <div className="auth-tabs"><Link to="/login" state={location.state} className={!register ? 'active' : ''}>Sign in</Link><Link to="/register" state={location.state} className={register ? 'active' : ''}>Create account</Link></div>
      <form className="form-stack" onSubmit={submit}>
        {register && <label>Full name<input className="form-control" required minLength={2} maxLength={80} autoComplete="name" name="name" value={form.name} onChange={change}/></label>}
        <label>Email address<input className="form-control" required type="email" maxLength={120} autoComplete="email" name="email" value={form.email} onChange={change} placeholder="you@example.com"/></label>
        <label>Password<input className="form-control" required type="password" minLength={8} maxLength={72} autoComplete={register ? 'new-password' : 'current-password'} name="password" value={form.password} onChange={change}/></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary w-100" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
      </form>
      <div className="auth-divider"><span>or</span></div><GoogleSignIn config={config} onSuccess={onSuccess}/>
      {!register && <div className="demo-logins"><span>TRY THE DEMO</span><button onClick={() => setForm({ name: '', email: 'user@rentora.local', password: 'User@1234' })}>Fill customer login</button><button onClick={() => setForm({ name: '', email: 'admin@rentora.local', password: 'Admin@123' })}>Fill admin login</button></div>}
    </div></div>
  </div></section>;
}
