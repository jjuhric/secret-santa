import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from '../../components/Login';
import { BrowserRouter } from 'react-router-dom';

const mockLoginWithGoogle = vi.fn();
const mockLoginWithEmail = vi.fn();
const mockActivateEmailAccount = vi.fn();
const mockResetPassword = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    loginWithGoogle: mockLoginWithGoogle,
    loginWithEmail: mockLoginWithEmail,
    activateEmailAccount: mockActivateEmailAccount,
    resetPassword: mockResetPassword
  })
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('Login Component Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderLogin = () => {
    return render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
  };

  it('renders Google sign-in button and email form inputs', () => {
    renderLogin();

    expect(screen.getByTestId('google-signin-btn')).toBeInTheDocument();
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
    expect(screen.getByTestId('email-submit-btn')).toHaveTextContent(/Sign In with Email/i);
    expect(screen.getByTestId('toggle-activate-btn')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-forgot-btn')).toBeInTheDocument();
  });

  it('handles Google sign in successfully', async () => {
    mockLoginWithGoogle.mockResolvedValue();
    renderLogin();

    fireEvent.click(screen.getByTestId('google-signin-btn'));

    await waitFor(() => {
      expect(mockLoginWithGoogle).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('handles Email & Password login successfully', async () => {
    mockLoginWithEmail.mockResolvedValue();
    renderLogin();

    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'user@yahoo.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      expect(mockLoginWithEmail).toHaveBeenCalledWith('user@yahoo.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('toggles to Activate Account mode and validates password length & matching', async () => {
    renderLogin();

    // Toggle mode
    fireEvent.click(screen.getByTestId('toggle-activate-btn'));
    expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('email-submit-btn')).toHaveTextContent(/Activate & Sign In/i);

    // Try submitting with short password (< 6 chars)
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'new@yahoo.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: '123' } });
    fireEvent.submit(screen.getByTestId('email-auth-form'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-error')).toHaveTextContent(/at least 6 characters/i);
    });

    // Try submitting with non-matching passwords
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'different' } });
    fireEvent.submit(screen.getByTestId('email-auth-form'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-error')).toHaveTextContent(/Passwords do not match/i);
    });

    // Valid activation submission
    mockActivateEmailAccount.mockResolvedValue();
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByTestId('email-auth-form'));

    await waitFor(() => {
      expect(mockActivateEmailAccount).toHaveBeenCalledWith('new@yahoo.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('toggles to Forgot Password mode and submits reset email', async () => {
    mockResetPassword.mockResolvedValue();
    renderLogin();

    fireEvent.click(screen.getByTestId('toggle-forgot-btn'));

    expect(screen.queryByTestId('password-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('email-submit-btn')).toHaveTextContent(/Send Reset Link/i);

    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'forgot@yahoo.com' } });
    fireEvent.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('forgot@yahoo.com');
      expect(screen.getByTestId('auth-message')).toHaveTextContent(/Password reset link sent/i);
    });
  });
});
