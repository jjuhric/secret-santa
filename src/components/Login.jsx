import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Gift } from 'lucide-react';

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
        <div className="icon-wrapper">
          <Gift size={48} className="brand-icon" />
        </div>
        <h1 className="title">Secret Santa</h1>
        <p className="subtitle">Sign in to view your recipient and update your wishlist.</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <button 
          className="btn btn-primary btn-large" 
          onClick={handleLogin} 
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </div>
      
      {/* Decorative background elements */}
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
    </div>
  );
}
