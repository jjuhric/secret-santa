import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import santaScrollIcon from '../assets/santa-scroll.jpg';

export default function Login() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin() {
    try {
      setError('');
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

  return (
    <div className="login-container">
      <div className="glass-card login-card">
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

        <h1 className="title">Secret Santa</h1>
        <p className="subtitle">Sign in to view your recipient, check off family gifts, and update your wishlist.</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <button 
          className="btn btn-primary btn-large" 
          onClick={handleLogin} 
          disabled={loading}
          style={{ fontSize: '1.05rem', letterSpacing: '0.3px' }}
        >
          {loading ? 'Signing in...' : '🎅 Sign in with Google'}
        </button>
      </div>
      
      {/* Decorative ambient holiday glows */}
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
    </div>
  );
}
