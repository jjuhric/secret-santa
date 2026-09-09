import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth, AuthProvider } from '../../contexts/AuthContext';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc, setDoc, getDocs } from 'firebase/firestore';

vi.mock('../../firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {}
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
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

const TestComponent = () => {
  const { userProfile, loading } = useAuth();
  if (loading) return <div data-testid="loading">Loading</div>;
  return <div data-testid="profile">{userProfile ? userProfile.role : 'none'}</div>;
};

describe('AuthContext Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assigns Master Admin to the first ever user to sign in', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({ email: 'first@test.com', displayName: 'First User' });
      return vi.fn();
    });

    // User doc doesn't exist yet
    getDoc.mockResolvedValue({ exists: () => false });
    
    // NO users exist in the database (getDocs is empty)
    getDocs.mockResolvedValue({ empty: true });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(setDoc).toHaveBeenCalledWith(
        undefined, // Because doc() is mocked
        expect.objectContaining({
          role: 'master',
          isMaster: true,
          email: 'first@test.com'
        })
      );
      expect(screen.getByTestId('profile').textContent).toBe('master');
    });
  });

  it('sets isUninvited for subsequent users not in DB', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({ email: 'second@test.com' });
      return vi.fn();
    });

    // User doc doesn't exist
    getDoc.mockResolvedValue({ exists: () => false });
    
    // Other users DO exist in the database (getDocs is not empty)
    getDocs.mockResolvedValue({ empty: false });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      // It should NOT call setDoc
      expect(setDoc).not.toHaveBeenCalled();
      expect(screen.getByTestId('profile').textContent).toBe('none');
    });
  });
});
