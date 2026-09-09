import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Admin from '../../components/Admin';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { MemoryRouter } from 'react-router-dom';
import { getDocs, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { sendInviteEmail } from '../../utils/emailService';

// Mock Firebase
vi.mock('../../firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn()
}));

vi.mock('../../utils/emailService', () => ({
  sendInviteEmail: vi.fn(),
  getEmailConfig: vi.fn().mockResolvedValue(null),
  saveEmailConfig: vi.fn()
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

describe('Admin Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Bug Reports panel only for Master Admin', async () => {
    useAuth.mockReturnValue({
      userProfile: { id: 'master1', name: 'Master', familyId: 'FamA', role: 'master' },
      isMasterAdmin: true,
      isAdmin: true
    });

    getDocs.mockResolvedValue({
      docs: [
        { id: 'u1', data: () => ({ name: 'User 1', familyId: 'FamA', isAdmin: false }) }
      ],
      map: Array.prototype.map
    });

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Bug Reports/i)).toBeInTheDocument();
      expect(screen.getByText(/EmailJS Setup/i)).toBeInTheDocument();
      expect(screen.getByText(/Run Christmas Shopping List Draw/i)).toBeInTheDocument();
    });
  });

  it('hides Master Admin controls from Family Admin', async () => {
    useAuth.mockReturnValue({
      userProfile: { id: 'admin1', name: 'Admin', familyId: 'FamA', isAdmin: true },
      isMasterAdmin: false,
      isAdmin: true
    });

    getDocs.mockResolvedValue({ docs: [] });

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Bug Reports/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/EmailJS Setup/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Run Christmas Shopping List Draw/i)).not.toBeInTheDocument();
    });
  });

  it('prevents adding a user with an already existing email', async () => {
    useAuth.mockReturnValue({
      userProfile: { id: 'admin1', name: 'Admin', familyId: 'FamA', isAdmin: true },
      isMasterAdmin: false,
      isAdmin: true
    });

    getDocs.mockResolvedValue({ docs: [] });
    // Simulate user already existing
    getDoc.mockResolvedValue({ exists: () => true });

    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/Full Name/i), { target: { value: 'New User' } });
    fireEvent.change(screen.getByPlaceholderText(/Google Email/i), { target: { value: 'exist@test.com' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Add & Send Invite/i }));

    await waitFor(() => {
      expect(getDoc).toHaveBeenCalled();
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('already exists'));
    });

    alertMock.mockRestore();
  });
});
