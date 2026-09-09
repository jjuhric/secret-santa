import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Admin from '../../components/Admin';
import { useAuth } from '../../contexts/AuthContext';
import { MemoryRouter } from 'react-router-dom';
import { getDocs, setDoc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { sendInviteEmail } from '../../utils/emailService';

// Mock Firebase
vi.mock('../../firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((db, col, id) => ({ id })),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn()
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

  it('allows Family Admin to delete non-admin family members but not themselves', async () => {
    useAuth.mockReturnValue({
      userProfile: { id: 'admin1', name: 'Admin User', familyId: 'Smith', isAdmin: true },
      isMasterAdmin: false,
      isAdmin: true
    });

    getDocs.mockResolvedValue({
      docs: [
        { id: 'admin1', data: () => ({ name: 'Admin User', familyId: 'Smith', isAdmin: true }) },
        { id: 'member1', data: () => ({ name: 'John Smith', familyId: 'Smith', isAdmin: false }) }
      ]
    });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument();
    });

    // Delete button should NOT exist for admin1
    expect(screen.queryByTestId('delete-user-admin1')).not.toBeInTheDocument();

    // Delete button SHOULD exist for member1
    const deleteMemberBtn = screen.getByTestId('delete-user-member1');
    expect(deleteMemberBtn).toBeInTheDocument();

    fireEvent.click(deleteMemberBtn);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('John Smith'));
    expect(deleteDoc).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('allows Master Admin to delete any member or admin, but not their own account', async () => {
    useAuth.mockReturnValue({
      userProfile: { id: 'master1', name: 'Master User', familyId: 'Main', role: 'master', isMaster: true },
      isMasterAdmin: true,
      isAdmin: true
    });

    getDocs.mockResolvedValue({
      docs: [
        { id: 'master1', data: () => ({ name: 'Master User', familyId: 'Main', role: 'master', isMaster: true }) },
        { id: 'adminOther', data: () => ({ name: 'Other Admin', familyId: 'Jones', isAdmin: true }) },
        { id: 'memberOther', data: () => ({ name: 'Other Member', familyId: 'Jones', isAdmin: false }) }
      ]
    });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Other Admin')).toBeInTheDocument();
      expect(screen.getByText('Other Member')).toBeInTheDocument();
    });

    // Master Admin cannot delete self
    expect(screen.queryByTestId('delete-user-master1')).not.toBeInTheDocument();

    // Master Admin CAN delete other family admin
    const deleteAdminBtn = screen.getByTestId('delete-user-adminOther');
    expect(deleteAdminBtn).toBeInTheDocument();
    fireEvent.click(deleteAdminBtn);
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Other Admin'));

    // Master Admin CAN delete other regular member
    const deleteMemberBtn = screen.getByTestId('delete-user-memberOther');
    expect(deleteMemberBtn).toBeInTheDocument();
    fireEvent.click(deleteMemberBtn);
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Other Member'));

    expect(deleteDoc).toHaveBeenCalledTimes(2);

    confirmSpy.mockRestore();
  });

  it('allows Family Admin to update an Extra member name and email', async () => {
    useAuth.mockReturnValue({
      userProfile: { id: 'admin1', name: 'Admin User', familyId: 'Smith', isAdmin: true },
      isMasterAdmin: false,
      isAdmin: true
    });

    getDocs.mockResolvedValue({
      docs: [
        { id: 'admin1', data: () => ({ name: 'Admin User', familyId: 'Smith', isAdmin: true }) },
        { id: 'extra1', data: () => ({ name: 'Test', familyId: 'Smith', isAdmin: false, isExtra: true, email: null }) }
      ]
    });

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('Extra')).toBeInTheDocument();
    });

    const editBtn = screen.getByTestId('edit-user-extra1');
    expect(editBtn).toBeInTheDocument();

    fireEvent.click(editBtn);

    expect(screen.getByText(/Edit Member/i)).toBeInTheDocument();
    const nameInput = screen.getByTestId('edit-user-name-input');
    const emailInput = screen.getByTestId('edit-user-email-input');

    expect(nameInput.value).toBe('Test');
    expect(emailInput.value).toBe('');

    fireEvent.change(nameInput, { target: { value: 'Test Updated' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    fireEvent.click(screen.getByTestId('save-edit-user-btn'));

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Test Updated',
          email: 'test@example.com'
        })
      );
    });
  });
});
