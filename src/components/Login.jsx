import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import santaScrollIcon from '../assets/santa-scroll.jpg';

export default function Login() {
  const { loginWithGoogle, loginWithEmail, activateEmailAccount, resetPassword } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'activate' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleGoogleLogin() {
    try {
      setError('');
      setMessage('');
      setLoading(true);
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('Failed to log in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (authMode === 'forgot') {
      try {
        setLoading(true);
        await resetPassword(email);
        setMessage('Password reset link sent! Check your inbox.');
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to send password reset email.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (authMode === 'activate') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      try {
        setLoading(true);
        await activateEmailAccount(email, password);
        navigate('/');
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to activate account.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // authMode === 'login'
    try {
      setLoading(true);
      await loginWithEmail(email, password);
      navigate('/');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Invalid email or password. If this is your first time, click "Activate Account" below.');
      } else {
        setError(err.message || 'Failed to sign in with email.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="glass-card login-card" style={{ maxWidth: '480px' }}>
        {/* Santa Reading Wishlist Scroll Icon */}
        <div 
          className="icon-wrapper"
          style={{
            border: '2px solid rgba(251, 191, 36, 0.6)',
            boxShadow: '0 8px 30px rgba(220, 38, 38, 0.45)',
            background: 'rgba(0, 0, 0, 0.4)'
          }}
        >
          <img 
            src={santaScrollIcon} 
            alt="Santa reading Christmas wishlist scroll" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        </div>

        <h1 className="title" style={{ fontSize: '2.2rem' }}>Christmas Shopping List</h1>
        <p className="subtitle" style={{ marginBottom: '1.25rem' }}>
          Sign in to view your recipient, check off family gifts, and update your wishlist.
        </p>
        
        {error && <div className="error-message" data-testid="auth-error">{error}</div>}
        {message && (
          <div 
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              padding: '0.85rem',
              borderRadius: '12px',
              marginBottom: '1.25rem',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontSize: '0.95rem'
            }}
            data-testid="auth-message"
          >
            {message}
          </div>
        )}

        {/* Quick Google Sign In */}
        <button 
          className="btn btn-primary btn-large" 
          onClick={handleGoogleLogin} 
          disabled={loading}
          data-testid="google-signin-btn"
          style={{ fontSize: '1rem', letterSpacing: '0.3px', marginBottom: '1.25rem' }}
        >
          {loading && authMode === 'google' ? 'Signing in...' : '🎅 Sign in with Google'}
        </button>

        {/* Festive Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0 1.25rem', opacity: 0.7 }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
          <span style={{ padding: '0 0.8rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            or use any email
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailSubmit} style={{ textAlign: 'left' }} data-testid="email-auth-form">
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Email Address
            </label>
            <input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              data-testid="email-input"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: 'rgba(0, 0, 0, 0.25)',
                color: 'var(--text-main)',
                fontSize: '0.95rem',
                outline: 'none'
              }}
            />
          </div>

          {authMode !== 'forgot' && (
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Password {authMode === 'activate' && '(min 6 characters)'}
              </label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="password-input"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  outline: 'none'
                }}
              />
            </div>
          )}

          {authMode === 'activate' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Confirm Password
              </label>
              <input 
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="confirm-password-input"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  outline: 'none'
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="email-submit-btn"
            className="btn btn-gold"
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginTop: '0.5rem' }}
          >
            {loading 
              ? 'Please wait...' 
              : authMode === 'activate' 
                ? '✨ Activate & Sign In' 
                : authMode === 'forgot'
                  ? '✉️ Send Reset Link'
                  : '✉️ Sign In with Email'}
          </button>
        </form>

        {/* Links to switch modes */}
        <div style={{ marginTop: '1.25rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {authMode === 'login' && (
            <>
              <div>
                First time here?{' '}
                <button 
                  type="button" 
                  onClick={() => { setAuthMode('activate'); setError(''); setMessage(''); }}
                  data-testid="toggle-activate-btn"
                  style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                >
                  Activate Account
                </button>
              </div>
              <div>
                <button 
                  type="button" 
                  onClick={() => { setAuthMode('forgot'); setError(''); setMessage(''); }}
                  data-testid="toggle-forgot-btn"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Forgot Password?
                </button>
              </div>
            </>
          )}

          {authMode === 'activate' && (
            <div>
              Already activated?{' '}
              <button 
                type="button" 
                onClick={() => { setAuthMode('login'); setError(''); setMessage(''); }}
                data-testid="toggle-login-btn"
                style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
              >
                Sign In with Password
              </button>
            </div>
          )}

          {authMode === 'forgot' && (
            <div>
              Remembered your password?{' '}
              <button 
                type="button" 
                onClick={() => { setAuthMode('login'); setError(''); setMessage(''); }}
                data-testid="toggle-login-btn-2"
                style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Decorative ambient holiday glows */}
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
    </div>
  );
}
