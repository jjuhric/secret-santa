import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEmailConfig, saveEmailConfig, sendInviteEmail, sendBugReportEmail } from '../../utils/emailService';
import emailjs from '@emailjs/browser';
import { getDoc, setDoc } from 'firebase/firestore';

// Mock EmailJS
vi.mock('@emailjs/browser', () => ({
  default: {
    send: vi.fn()
  }
}));

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  db: {}
}));

describe('Email Service', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('getEmailConfig / saveEmailConfig', () => {
    it('reads from localStorage if Firestore fails/misses', async () => {
      getDoc.mockResolvedValue({ exists: () => false });
      localStorage.setItem('secret_santa_emailjs', JSON.stringify({ serviceId: 'local_svc' }));
      
      const config = await getEmailConfig();
      expect(config.serviceId).toBe('local_svc');
    });

    it('saves to localStorage and Firestore', async () => {
      setDoc.mockResolvedValue();
      const config = await saveEmailConfig({ serviceId: 's1', templateId: 't1', publicKey: 'p1' });
      
      expect(config.serviceId).toBe('s1');
      const local = JSON.parse(localStorage.getItem('secret_santa_emailjs'));
      expect(local.serviceId).toBe('s1');
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('sendInviteEmail', () => {
    it('returns notConfigured if keys are missing', async () => {
      getDoc.mockResolvedValue({ exists: () => false }); // no config
      const result = await sendInviteEmail({ toEmail: 'test@test.com' });
      expect(result.notConfigured).toBe(true);
      expect(result.success).toBe(false);
    });

    it('calls emailjs.send when configured', async () => {
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ serviceId: 's', templateId: 't', publicKey: 'p' })
      });
      emailjs.send.mockResolvedValue({ status: 200 });

      const result = await sendInviteEmail({
        toEmail: 'test@test.com',
        toName: 'Test',
        familyName: 'Fam',
        invitedBy: 'Admin'
      });

      expect(result.success).toBe(true);
      expect(emailjs.send).toHaveBeenCalledWith('s', 't', expect.objectContaining({
        to_email: 'test@test.com',
        family_name: 'Fam'
      }), 'p');
    });
  });

  describe('sendBugReportEmail', () => {
    it('calls emailjs.send with trace metadata', async () => {
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ serviceId: 's', templateId: 't', publicKey: 'p' })
      });
      emailjs.send.mockResolvedValue({ status: 200 });

      const result = await sendBugReportEmail({
        masterEmail: 'master@test.com',
        issueDescription: 'It broke',
        metadata: { browser: 'Chrome', lastError: 'TypeError' }
      });

      expect(result.success).toBe(true);
      expect(emailjs.send).toHaveBeenCalled();
      const params = emailjs.send.mock.calls[0][2];
      expect(params.message).toContain('It broke');
      expect(params.message).toContain('Chrome');
      expect(params.message).toContain('TypeError');
    });
  });
});
