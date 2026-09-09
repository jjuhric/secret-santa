import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth, AuthProvider } from '../../contexts/AuthContext';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { getDoc, onSnapshot, getDocs } from 'firebase/firestore';

// Mock Firebase
vi.mock('../../firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {}
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  onSnapshot: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  query: vi.fn()
}));

const TestComponent = ({ onContextReady }) => {
  const auth = useAuth();
  React.useEffect(() => {
    if (onContextReady) onContextReady(auth);
  }, [auth, onContextReady]);

  if (auth.loading) return <div data-testid="loading">Loading</div>;
  return (
    <div>
      <span data-testid="master">{auth.isMasterAdmin ? 'true' : 'false'}</span>
      <span data-testid="admin">{auth.isAdmin ? 'true' : 'false'}</span>
      <span data-testid="uninvited">{auth.isUninvited ? 'true' : 'false'}</span>
    </div>
  );
};

describe('AuthContext Unit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles Master Admin correctly', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({ email: 'test@master.com' });
      return vi.fn();
    });

    getDoc.mockResolvedValue({ exists: () => true });
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        exists: () => true,
        id: 'test@master.com',
        data: () => ({ role: 'master' })
      });
      return vi.fn();
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('master').textContent).toBe('true');
      expect(screen.getByTestId('admin').textContent).toBe('true'); // Master is also an admin
    });
  });

  it('handles Family Admin correctly', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({ email: 'test@admin.com' });
      return vi.fn();
    });

    getDoc.mockResolvedValue({ exists: () => true });
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        exists: () => true,
        id: 'test@admin.com',
        data: () => ({ isAdmin: true, role: 'admin' })
      });
      return vi.fn();
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('master').textContent).toBe('false');
      expect(screen.getByTestId('admin').textContent).toBe('true');
    });
  });

  it('handles normal member correctly', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({ email: 'test@user.com' });
      return vi.fn();
    });

    getDoc.mockResolvedValue({ exists: () => true });
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        exists: () => true,
        id: 'test@user.com',
        data: () => ({ isAdmin: false, role: 'user' })
      });
      return vi.fn();
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('master').textContent).toBe('false');
      expect(screen.getByTestId('admin').textContent).toBe('false');
    });
  });

  it('calls signInWithEmailAndPassword on loginWithEmail', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return vi.fn();
    });

    let capturedAuth;
    render(
      <AuthProvider>
        <TestComponent onContextReady={(ctx) => { capturedAuth = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuth).toBeDefined();
    });

    signInWithEmailAndPassword.mockResolvedValue({ user: { email: 'user@yahoo.com' } });
    await act(async () => {
      await capturedAuth.loginWithEmail('User@Yahoo.com ', 'secret123');
    });

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'user@yahoo.com',
      'secret123'
    );
  });

  it('activates email account when user exists in firestore', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return vi.fn();
    });

    let capturedAuth;
    render(
      <AuthProvider>
        <TestComponent onContextReady={(ctx) => { capturedAuth = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuth).toBeDefined();
    });

    getDoc.mockResolvedValue({ exists: () => true });
    createUserWithEmailAndPassword.mockResolvedValue({ user: { email: 'invited@yahoo.com' } });

    await act(async () => {
      await capturedAuth.activateEmailAccount('Invited@yahoo.com', 'password123');
    });

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'invited@yahoo.com',
      'password123'
    );
  });

  it('rejects activating uninvited email when user collection has members', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return vi.fn();
    });

    let capturedAuth;
    render(
      <AuthProvider>
        <TestComponent onContextReady={(ctx) => { capturedAuth = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuth).toBeDefined();
    });

    getDoc.mockResolvedValue({ exists: () => false });
    getDocs.mockResolvedValue({ empty: false });

    await expect(
      capturedAuth.activateEmailAccount('stranger@yahoo.com', 'password123')
    ).rejects.toThrow(/not been invited/i);

    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('calls sendPasswordResetEmail on resetPassword', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return vi.fn();
    });

    let capturedAuth;
    render(
      <AuthProvider>
        <TestComponent onContextReady={(ctx) => { capturedAuth = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuth).toBeDefined();
    });

    sendPasswordResetEmail.mockResolvedValue();
    await act(async () => {
      await capturedAuth.resetPassword('User@Yahoo.com ');
    });

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      'user@yahoo.com'
    );
  });
});
