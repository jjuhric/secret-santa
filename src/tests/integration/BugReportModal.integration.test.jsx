import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BugReportModal from '../../components/BugReportModal';
import { AuthProvider } from '../../contexts/AuthContext';
import { addDoc } from 'firebase/firestore';

// Mock Firebase
vi.mock('../../firebase', () => ({
  auth: {},
  googleProvider: {},
  db: {}
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ empty: true })
}));

vi.mock('../../utils/emailService', () => ({
  sendBugReportEmail: vi.fn()
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({
    currentUser: { email: 'test@test.com' },
    userProfile: { name: 'Test User' }
  }),
  AuthProvider: ({ children }) => <div>{children}</div>
}));

describe('BugReportModal Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is hidden by default', () => {
    render(<BugReportModal />);
    expect(screen.queryByText(/Report Bug/i)).not.toBeInTheDocument();
  });

  it('appears when an app-error event is dispatched', async () => {
    vi.useRealTimers();
    render(<BugReportModal />);
    window.dispatchEvent(new CustomEvent('app-error', { detail: 'Fake Error' }));
    
    await waitFor(() => {
      expect(screen.getByText(/Report Bug/i)).toBeInTheDocument();
    });
  });

  it('auto-hides after 60 seconds of inactivity', async () => {
    vi.useFakeTimers();
    render(<BugReportModal />);
    window.dispatchEvent(new CustomEvent('app-error', { detail: 'Fake Error' }));
    
    // In fake timer environment, we can just check if it's there instantly (state update might be synchronous or need act)
    expect(screen.getByText(/Report Bug/i)).toBeInTheDocument();

    // Advance timer by 61 seconds
    vi.advanceTimersByTime(61000);

    expect(screen.queryByText(/Report Bug/i)).not.toBeInTheDocument();
  });

  it('opens modal, submits successfully, and hides immediately after OK', async () => {
    vi.useRealTimers();
    render(<BugReportModal />);
    window.dispatchEvent(new CustomEvent('app-error', { detail: 'Fake Error' }));
    
    // Open modal
    fireEvent.click(screen.getByText(/Report Bug/i));
    
    await waitFor(() => {
      expect(screen.getByText(/Report an Issue/i)).toBeInTheDocument();
    });

    // Fill description
    fireEvent.change(screen.getByPlaceholderText(/Describe what happened/i), {
      target: { value: 'Something broke' }
    });

    // Submit form
    addDoc.mockResolvedValue({ id: 'bug1' });
    fireEvent.click(screen.getByRole('button', { name: /Send Bug Report/i }));

    // Wait for success popup
    await waitFor(() => {
      expect(screen.getByText(/Bug Report Submitted/i)).toBeInTheDocument();
    });

    // Click OK
    fireEvent.click(screen.getByRole('button', { name: /OK/i }));

    // Verify EVERYTHING is hidden
    await waitFor(() => {
      expect(screen.queryByText(/Bug Report Submitted/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Report an Issue/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Report Bug/i)).not.toBeInTheDocument(); // Floating button should be gone
    });
  });
});
