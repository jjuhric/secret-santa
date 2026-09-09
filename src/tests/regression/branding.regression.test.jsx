import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../../App';
import { onAuthStateChanged } from 'firebase/auth';

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
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ empty: true }),
  query: vi.fn(),
  where: vi.fn()
}));

import { AuthProvider } from '../../contexts/AuthContext';

describe('Branding Regression', () => {
  it('does not render "Secret Santa" anywhere in the default unauthenticated view', () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null); // Triggers loading=false
      return vi.fn();
    });

    const { container } = render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );
    
    const textContent = container.textContent.toLowerCase();
    expect(textContent).not.toContain('secret santa');
    expect(textContent).toContain('christmas shopping list');
  });
});
