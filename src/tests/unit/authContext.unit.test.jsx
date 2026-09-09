import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth, AuthProvider } from '../../contexts/AuthContext';
import { onAuthStateChanged } from 'firebase/auth';
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
  const { isMasterAdmin, isAdmin, isUninvited, loading } = useAuth();
  if (loading) return <div data-testid="loading">Loading</div>;
  return (
    <div>
      <span data-testid="master">{isMasterAdmin ? 'true' : 'false'}</span>
      <span data-testid="admin">{isAdmin ? 'true' : 'false'}</span>
      <span data-testid="uninvited">{isUninvited ? 'true' : 'false'}</span>
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
});
