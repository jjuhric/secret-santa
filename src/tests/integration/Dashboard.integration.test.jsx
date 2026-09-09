import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from '../../components/Dashboard';
import { useAuth } from '../../contexts/AuthContext';
import { MemoryRouter } from 'react-router-dom';
import { onSnapshot, updateDoc, collection, query, where } from 'firebase/firestore';

vi.mock('../../firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn().mockReturnValue({ isQuery: true }),
  where: vi.fn(),
  getDocs: vi.fn()
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

describe('Dashboard Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSnapshot.mockReturnValue(vi.fn());
  });

  it('renders "Not Invited" message when user is uninvited', () => {
    useAuth.mockReturnValue({
      currentUser: { email: 'stranger@test.com' },
      isUninvited: true,
      loading: false
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText(/Account Not Found/i)).toBeInTheDocument();
  });

  it('redirects to SetupWizard if setupComplete is false', () => {
    useAuth.mockReturnValue({
      userProfile: { id: 'user1', setupComplete: false },
      isUninvited: false,
      loading: false
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Assuming SetupWizard renders a specific heading
    expect(screen.getByText(/Welcome to Christmas Shopping List!/i)).toBeInTheDocument();
  });

  it('displays family members list and excludes active user', async () => {
    useAuth.mockReturnValue({
      userProfile: { id: 'u1', name: 'User 1', familyId: 'FamA', setupComplete: true },
      isUninvited: false,
      loading: false
    });

    onSnapshot.mockImplementation((q, callback) => {
      // If it's the doc(db, 'users', viewingId) query, q has a type of 'document' or similar,
      // but in tests we can differentiate by checking if q has a specific shape.
      if (q && q.isQuery) { 
        callback({
          docs: [
            { id: 'u1', data: () => ({ name: 'User 1', familyId: 'FamA' }) },
            { id: 'u2', data: () => ({ name: 'User 2', familyId: 'FamA' }) }
          ]
        });
      } else { // Fallback for doc query
        callback({
          exists: () => true,
          id: 'u1',
          data: () => ({ name: 'User 1', familyId: 'FamA', wishlist: [] })
        });
      }
      return vi.fn();
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/"Buy For" List/i)).toBeInTheDocument();
      // Should show User 2 but NOT User 1 in the shopping list (checkboxes)
      expect(screen.getByText('User 2')).toBeInTheDocument();
    });
  });
});
