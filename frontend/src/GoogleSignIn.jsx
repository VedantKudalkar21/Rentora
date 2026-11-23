import { useEffect, useRef, useState } from 'react';
import { api } from './api';

let sdkPromise;
function loadGoogleSdk() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => { sdkPromise = undefined; reject(new Error('Google sign-in could not load. Check your internet connection.')); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
export default function GoogleSignIn({ config, onSuccess, link = false }) {
  const container = useRef();
  const callback = useRef(onSuccess);
  callback.current = onSuccess;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!config?.googleEnabled) return;
    let alive = true;
    const nonce = crypto.randomUUID() + crypto.randomUUID();
    loadGoogleSdk().then(google => {
      if (!alive) return;
      google.accounts.id.initialize({ client_id: config.googleClientId, nonce, auto_select: false,
        callback: async response => {
          if (!alive) return;
          setBusy(true); setError('');
          try {
            const result = await api(link ? '/profile/google' : '/auth/google', {
              method: 'POST', body: { credential: response.credential, nonce }, skipAuth: !link,
            });
            if (alive) callback.current(result);
          } catch (err) { if (alive) setError(err.message); }
          finally { if (alive) setBusy(false); }
        },
      });
      google.accounts.id.renderButton(container.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 290 });
    }).catch(err => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [config?.googleEnabled, config?.googleClientId, link]);
  return <div className="google-signin">
    {config?.googleEnabled ? <div ref={container} className={busy ? 'google-busy' : ''}/> : <><button type="button" className="btn btn-outline-secondary w-100" disabled>Continue with Google</button><p className="helper">Google sign-in is currently unavailable.</p></>}
    {busy && <p className="helper" role="status">Verifying your Google account…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
