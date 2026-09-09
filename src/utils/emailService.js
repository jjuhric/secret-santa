import emailjs from '@emailjs/browser';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function getEmailConfig() {
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'emailjs'));
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (err) {
    console.warn("Could not fetch remote EmailJS settings:", err);
  }
  
  const local = localStorage.getItem('secret_santa_emailjs');
  return local ? JSON.parse(local) : null;
}

export async function saveEmailConfig({ serviceId, templateId, publicKey }) {
  const config = {
    serviceId: serviceId?.trim() || '',
    templateId: templateId?.trim() || '',
    publicKey: publicKey?.trim() || '',
    updatedAt: Date.now()
  };
  localStorage.setItem('secret_santa_emailjs', JSON.stringify(config));
  try {
    await setDoc(doc(db, 'settings', 'emailjs'), config);
  } catch (err) {
    console.warn("Could not save EmailJS settings to Firestore:", err);
  }
  return config;
}

export async function sendInviteEmail({ toEmail, toName, familyName, invitedBy }) {
  const inviteLink = window.location.origin + window.location.pathname;
  const config = await getEmailConfig();

  if (!config || !config.serviceId || !config.templateId || !config.publicKey) {
    return {
      success: false,
      notConfigured: true,
      message: 'EmailJS is not configured yet. You can configure it in the Admin Panel or share the invite link directly.',
      inviteLink
    };
  }

  const templateParams = {
    to_email: toEmail,
    to_name: toName,
    family_name: familyName,
    invited_by: invitedBy || 'Your Family Admin',
    invite_link: inviteLink,
    app_url: inviteLink,
    message: `You have been invited to join the ${familyName} Secret Santa Christmas gift exchange!`
  };

  try {
    const response = await emailjs.send(
      config.serviceId,
      config.templateId,
      templateParams,
      config.publicKey
    );
    return {
      success: true,
      status: response.status,
      message: `Invite email successfully sent to ${toEmail}!`
    };
  } catch (error) {
    console.error("EmailJS Send Error:", error);
    return {
      success: false,
      error,
      message: error?.text || 'Failed to send invite email via EmailJS.',
      inviteLink
    };
  }
}

export async function sendBugReportEmail({
  masterEmail,
  reporterName,
  reporterEmail,
  issueDescription,
  pageUrl,
  timestamp,
  metadata
}) {
  const config = await getEmailConfig();

  if (!config || !config.serviceId || !config.templateId || !config.publicKey) {
    return {
      success: false,
      notConfigured: true,
      message: 'EmailJS is not yet configured.'
    };
  }

  const templateParams = {
    to_email: masterEmail,
    from_name: reporterName || 'Anonymous User',
    reply_to: reporterEmail || '',
    subject: `[Bug Report] Secret Santa issue from ${reporterName || 'User'}`,
    message: `Issue Description:
${issueDescription}

--- Trace Details ---
Time: ${timestamp}
Page / URL: ${pageUrl}
User: ${reporterName || 'N/A'} (${reporterEmail || 'N/A'})
Browser / OS: ${metadata?.browser || navigator.userAgent}
Screen Resolution: ${metadata?.viewport || `${window.innerWidth}x${window.innerHeight}`}
Runtime Error: ${metadata?.lastError || 'None detected'}
`
  };

  try {
    const response = await emailjs.send(
      config.serviceId,
      config.templateId,
      templateParams,
      config.publicKey
    );
    return {
      success: true,
      status: response.status
    };
  } catch (error) {
    console.error("EmailJS Bug Report Error:", error);
    return {
      success: false,
      error,
      message: error?.text || 'EmailJS failed to deliver bug report email.'
    };
  }
}
