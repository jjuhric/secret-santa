import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../../App';
import { AuthProvider } from '../../contexts/AuthContext';
import { onAuthStateChanged } from 'firebase/auth';
import { MemoryRouter } from 'react-router-dom';

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
  getDoc: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ role: 'user', setupComplete: true }) }),
  setDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ empty: true }),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn()
}));

describe('Bug Button Visibility Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ensures BugReportModal does not show up randomly across the application without an error', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({ email: 'user@test.com' });
      return vi.fn();
    });

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    // Initial load: no bug button should be visible anywhere
    await waitFor(() => {
      expect(screen.queryByText(/Report Bug/i)).not.toBeInTheDocument();
    });
  });
});
