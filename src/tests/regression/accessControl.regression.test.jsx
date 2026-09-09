import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../../App';
import { AuthProvider } from '../../contexts/AuthContext';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc, getDocs } from 'firebase/firestore';

vi.mock('../../firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {}
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn()
}));

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Admin from '../../components/Admin';
import Dashboard from '../../components/Dashboard';

describe('Access Control Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects uninvited users immediately to the uninvited screen', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({ email: 'hacker@test.com' });
      return vi.fn();
    });

    // Hacker is not in database
    getDoc.mockResolvedValue({ exists: () => false });
    getDocs.mockResolvedValue({ empty: false });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Account Not Found/i)).toBeInTheDocument();
    });
  });

  it('prevents rendering protected Admin routes for normal users', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({ email: 'user@test.com' });
      return vi.fn();
    });

    // User is just a normal member
    getDoc.mockResolvedValue({ 
      exists: () => true, 
      data: () => ({ role: 'user', isAdmin: false, setupComplete: true }) 
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      // Normal user trying to reach admin should just see no Family Admin Panel
      expect(screen.queryByText(/Family Admin Panel/i)).not.toBeInTheDocument();
    });
  });
});
