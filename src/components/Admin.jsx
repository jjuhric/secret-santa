import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { ShieldCheck, UserPlus, Trash2, Mail, Send, Settings, ArrowLeft, RefreshCw, Bug, CheckCircle } from 'lucide-react';
import { sendInviteEmail, getEmailConfig, saveEmailConfig } from '../utils/emailService';
import santaScrollIcon from '../assets/santa-scroll.jpg';

export default function Admin() {
  const { userProfile, isMasterAdmin, isAdmin } = useAuth();

  const [users, setUsers] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [family, setFamily] = useState(userProfile?.familyId || '');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [isManaged, setIsManaged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // EmailJS settings modal / drawer
  const [showEmailSettings, setShowEmailSettings] = useState(false);
  const [emailServiceId, setEmailServiceId] = useState('');
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [emailPublicKey, setEmailPublicKey] = useState('');
  const [savingEmailSettings, setSavingEmailSettings] = useState(false);

  // Filter for Master Admin
  const [familyFilter, setFamilyFilter] = useState('ALL');

  // Bug reports for Master Admin
  const [bugReports, setBugReports] = useState([]);
  const [showBugs, setShowBugs] = useState(false);

  useEffect(() => {
    fetchUsers();
    loadEmailSettings();
    if (isMasterAdmin) {
      fetchBugReports();
    }
  }, [userProfile, isMasterAdmin]);

  async function loadEmailSettings() {
    const config = await getEmailConfig();
    if (config) {
      setEmailServiceId(config.serviceId || '');
      setEmailTemplateId(config.templateId || '');
      setEmailPublicKey(config.publicKey || '');
    }
  }

  async function handleSaveEmailSettings(e) {
    e.preventDefault();
    setSavingEmailSettings(true);
    try {
      await saveEmailConfig({
        serviceId: emailServiceId,
        templateId: emailTemplateId,
        publicKey: emailPublicKey
      });
      setMessage("EmailJS configuration saved successfully!");
      setShowEmailSettings(false);
    } catch (err) {
      alert("Error saving EmailJS settings: " + err.message);
    } finally {
      setSavingEmailSettings(false);
    }
  }

  async function fetchUsers() {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }

  async function fetchBugReports() {
    try {
      const snap = await getDocs(collection(db, 'bug_reports'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBugReports(list);
    } catch (err) {
      console.warn("Could not fetch bug reports:", err);
    }
  }

  async function handleDeleteBug(bugId) {
    if (window.confirm("Delete this bug report?")) {
      await deleteDoc(doc(db, 'bug_reports', bugId));
      fetchBugReports();
    }
  }

  // Filter users based on role permissions:
  // Rule 6: Admins should have access to all non-admin accounts in their family.
  // Master Admin has access to all accounts.
  const visibleUsers = users.filter(u => {
    if (isMasterAdmin) {
      if (familyFilter === 'ALL') return true;
      return (u.familyId || '').toLowerCase() === familyFilter.toLowerCase();
    }
    // Family Admin: only non-admin accounts in their family (or themselves)
    const sameFamily = (u.familyId || '').toLowerCase() === (userProfile?.familyId || '').toLowerCase();
    if (!sameFamily) return false;
    // Allow seeing non-admin accounts in their family
    return !u.isAdmin || u.id === userProfile.id;
  });

  const distinctFamilies = Array.from(new Set(users.map(u => u.familyId).filter(Boolean)));

  async function handleAddUser(e) {
    e.preventDefault();
    const targetFamily = (isMasterAdmin ? family : userProfile?.familyId)?.trim();

    if (!name.trim() || !targetFamily) {
      alert("Name and Family Group are required.");
      return;
    }

    if (!isManaged && !email.trim()) {
      alert("Email is required for adult accounts.");
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const sanitizedFamily = targetFamily;
      const userEmail = isManaged ? null : email.toLowerCase().trim();

      // Rule 2: User Account must be unique. Admin Accounts must also be unique.
      if (userEmail) {
        const existingDoc = await getDoc(doc(db, 'users', userEmail));
        if (existingDoc.exists()) {
          alert(`An account with email ${userEmail} already exists! Both user and admin accounts must be unique.`);
          setLoading(false);
          return;
        }
      } else {
        // Uniqueness check for kid in the family
        const kidExists = users.some(
          u => (u.familyId || '').toLowerCase() === sanitizedFamily.toLowerCase() &&
               u.name.toLowerCase() === name.trim().toLowerCase()
        );
        if (kidExists) {
          alert(`A family member named "${name}" already exists in the ${sanitizedFamily} family.`);
          setLoading(false);
          return;
        }
      }

      const docId = isManaged 
        ? `kid-${sanitizedFamily.toLowerCase().replace(/[^a-z0-9]/g, '')}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`
        : userEmail;

      const newUserDoc = {
        name: name.trim(),
        email: userEmail,
        familyId: sanitizedFamily,
        isAdmin: isManaged ? false : newUserIsAdmin,
        role: newUserIsAdmin ? 'admin' : 'user',
        isManaged: isManaged,
        setupComplete: false,
        wishlist: [],
        recipientId: null,
        purchasedMembers: {},
        invitedBy: userProfile.name || userProfile.email,
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'users', docId), newUserDoc);

      // Rule 3: Send email to user informing of their invite to sign in and join the family. (Complete with family name).
      if (userEmail) {
        const emailResult = await sendInviteEmail({
          toEmail: userEmail,
          toName: name.trim(),
          familyName: sanitizedFamily,
          invitedBy: userProfile.name
        });

        if (emailResult.success) {
          setMessage(`User created! Invite email sent to ${userEmail}.`);
        } else if (emailResult.notConfigured) {
          setMessage(`User created! (Note: EmailJS keys can be set above to automate sending emails).`);
        } else {
          setMessage(`User created, but email could not be sent: ${emailResult.message}`);
        }
      } else {
        setMessage(`Child profile "${name.trim()}" added to family ${sanitizedFamily}!`);
      }

      setName('');
      setEmail('');
      if (isMasterAdmin) setFamily('');
      setNewUserIsAdmin(false);
      setIsManaged(false);
      fetchUsers();
    } catch (err) {
      console.error("Error adding user: ", err);
      alert("Error adding user: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendInvite(user) {
    if (!user.email) return;
    setLoading(true);
    const result = await sendInviteEmail({
      toEmail: user.email,
      toName: user.name,
      familyName: user.familyId,
      invitedBy: userProfile.name
    });
    setLoading(false);
    if (result.success) {
      alert(`Invite email sent to ${user.email}!`);
    } else {
      alert(result.message || "Failed to send email.");
    }
  }

  async function handleDelete(docId, userName) {
    if (window.confirm(`Are you sure you want to remove "${userName}"?`)) {
      await deleteDoc(doc(db, 'users', docId));
      fetchUsers();
    }
  }

  function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
  }

  async function handleDraw() {
    if (users.length < 3) {
      alert('Need at least 3 users across families to conduct the draw.');
      return;
    }

    let validDraw = false;
    let attempts = 0;
    let assignments = {};

    setLoading(true);
    
    while (!validDraw && attempts < 2000) {
      attempts++;
      
      let shuffledRecipients = [...users];
      // Run through randomizer minimum of 3 times as requested
      for (let i = 0; i < 3; i++) {
        shuffledRecipients = shuffle(shuffledRecipients);
      }
      shuffledRecipients = shuffle(shuffledRecipients);
      
      validDraw = true;
      assignments = {};

      for (let i = 0; i < users.length; i++) {
        const buyer = users[i];
        const recipient = shuffledRecipients[i];

        // Rule: Buyer cannot be recipient, and buyer cannot buy for member of same family
        if (buyer.id === recipient.id || (buyer.familyId && recipient.familyId && buyer.familyId.toLowerCase() === recipient.familyId.toLowerCase())) {
          validDraw = false;
          break;
        }

        assignments[buyer.id] = recipient.id;
      }
    }

    if (!validDraw) {
      alert('Could not find a valid combination where no family member buys for their own family. Please make sure there are enough different families with balanced members.');
      setLoading(false);
      return;
    }

    try {
      for (const [buyerId, recipientId] of Object.entries(assignments)) {
        await setDoc(doc(db, 'users', buyerId), { recipientId }, { merge: true });
      }
      alert('Christmas Shopping List Draw completed successfully! All buyers have been assigned recipients from outside their family.');
      fetchUsers();
    } catch (err) {
      console.error('Error saving draw: ', err);
      alert('Failed to save the draw.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}>
      
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', textDecoration: 'none', marginBottom: '0.5rem' }}>
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h1 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <img 
              src={santaScrollIcon} 
              alt="Santa reading wishlist scroll" 
              style={{ width: '38px', height: '38px', borderRadius: '10px', objectFit: 'cover', border: '1.5px solid rgba(251, 191, 36, 0.6)', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }} 
            />
            {isMasterAdmin ? 'Master Admin Panel' : `Admin Panel (${userProfile?.familyId} Family)`}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isMasterAdmin && (
            <>
              <button 
                className="btn" 
                onClick={() => setShowBugs(!showBugs)} 
                style={{ background: bugReports.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)', color: bugReports.length > 0 ? '#f87171' : 'white', border: bugReports.length > 0 ? '1px solid #ef4444' : 'none' }}
              >
                <Bug size={18} /> Bug Reports ({bugReports.length})
              </button>

              <button 
                className="btn" 
                onClick={() => setShowEmailSettings(!showEmailSettings)} 
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
              >
                <Settings size={18} /> EmailJS Setup
              </button>
              
              <button 
                className="btn btn-primary" 
                onClick={handleDraw} 
                disabled={loading || users.length < 3}
              >
                Run Christmas Shopping List Draw
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#10b981', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          {message}
        </div>
      )}

      {/* EmailJS Settings Drawer (Master Admin Only) */}
      {isMasterAdmin && showEmailSettings && (
        <div className="glass-card" style={{ marginBottom: '2rem', border: '1px solid var(--primary)' }}>
          <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail color="var(--primary)" /> EmailJS Automated Invite Setup
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            To send automated email invites completely on the free tier, sign up at <a href="https://www.emailjs.com" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>emailjs.com</a> and enter your keys below. Template parameters supported: <code>{"{{to_name}}"}</code>, <code>{"{{to_email}}"}</code>, <code>{"{{family_name}}"}</code>, <code>{"{{invite_link}}"}</code>.
          </p>

          <form onSubmit={handleSaveEmailSettings} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Service ID</label>
              <input 
                type="text" 
                placeholder="service_xxx" 
                value={emailServiceId} 
                onChange={e => setEmailServiceId(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                required 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Template ID</label>
              <input 
                type="text" 
                placeholder="template_xxx" 
                value={emailTemplateId} 
                onChange={e => setEmailTemplateId(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                required 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Public Key</label>
              <input 
                type="text" 
                placeholder="Public Key" 
                value={emailPublicKey} 
                onChange={e => setEmailPublicKey(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                required 
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={savingEmailSettings}>
                {savingEmailSettings ? 'Saving...' : 'Save Keys'}
              </button>
              <button type="button" className="btn" onClick={() => setShowEmailSettings(false)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bug Reports Drawer (Master Admin Only) */}
      {isMasterAdmin && showBugs && (
        <div className="glass-card" style={{ marginBottom: '2rem', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171' }}>
              <Bug size={20} color="#ef4444" /> Received Bug Reports ({bugReports.length})
            </h3>
            <button 
              className="btn" 
              onClick={() => setShowBugs(false)} 
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              Close
            </button>
          </div>

          {bugReports.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No bug reports logged yet. Everything is smooth!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {bugReports.map((b) => (
                <div 
                  key={b.id} 
                  style={{
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#f8fafc' }}>
                        {b.issue}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                        Reported by: <strong>{b.reporterName}</strong> ({b.reporterEmail}) • {b.localTime || b.timeReported}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteBug(b.id)}
                      className="btn"
                      style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      <Trash2 size={14} /> Remove Report
                    </button>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                    <div><strong>Page / URL:</strong> {b.pageUrl || b.route}</div>
                    <div><strong>Browser / OS:</strong> {b.metadata?.browser || 'N/A'}</div>
                    <div><strong>Screen:</strong> {b.metadata?.viewport || 'N/A'}</div>
                    {b.metadata?.lastError && b.metadata.lastError !== 'None detected' && (
                      <div style={{ color: '#f87171', marginTop: '0.2rem' }}><strong>Error Trace:</strong> {b.metadata.lastError}</div>
                    )}
                  </div>

                  {b.screenshot && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Attached Screenshot:</div>
                      <a href={b.screenshot} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={b.screenshot} 
                          alt="Bug report screenshot" 
                          style={{ maxHeight: '140px', maxWidth: '100%', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.2)', objectFit: 'contain' }} 
                        />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add User / Member Card */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserPlus color="var(--primary)" /> Add New Member / User
        </h2>

        <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="checkbox" 
                id="isManaged"
                checked={isManaged} 
                onChange={e => setIsManaged(e.target.checked)} 
                style={{ width: '18px', height: '18px' }}
              />
              <label htmlFor="isManaged" style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Child Profile (No Google email needed)
              </label>
            </div>

            {!isManaged && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="newUserIsAdmin"
                  checked={newUserIsAdmin} 
                  onChange={e => setNewUserIsAdmin(e.target.checked)} 
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="newUserIsAdmin" style={{ cursor: 'pointer', fontWeight: 'bold', color: 'var(--primary)' }}>
                  ⭐ Is Admin (Can view admin panel for this family)
                </label>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>Full Name</label>
              <input 
                type="text" 
                placeholder="Full Name" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: 'white' }}
                required
              />
            </div>

            {!isManaged && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>Google Email (Unique)</label>
                <input 
                  type="email" 
                  placeholder="Google Email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: 'white' }}
                  required
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>Family Group Name</label>
              <input 
                type="text" 
                placeholder="Family Name (e.g. Uhrick)" 
                value={isMasterAdmin ? family : userProfile?.familyId} 
                onChange={e => isMasterAdmin && setFamily(e.target.value)} 
                disabled={!isMasterAdmin}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: isMasterAdmin ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.05)', color: 'white' }}
                required
              />
            </div>
          </div>

          <div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add & Send Invite'}
            </button>
          </div>
        </form>
      </div>

      {/* Users List Card */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem' }}>
              {isMasterAdmin ? `All Members (${visibleUsers.length})` : `Family Members (${visibleUsers.length})`}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {isMasterAdmin 
                ? 'Master Admin oversight across all families' 
                : 'Showing non-admin members in your family'}
            </p>
          </div>

          {/* Family Filter for Master Admin */}
          {isMasterAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Filter Family:</span>
              <select 
                value={familyFilter} 
                onChange={e => setFamilyFilter(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <option value="ALL">All Families</option>
                {distinctFamilies.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Name</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Family</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Role</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Email</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>
                    {u.name}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', color: '#ec4899' }}>
                    {u.familyId}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {u.isMaster ? (
                      <span style={{ background: '#ec4899', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Master</span>
                    ) : u.isAdmin ? (
                      <span style={{ background: '#8b5cf6', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Admin</span>
                    ) : u.isManaged ? (
                      <span style={{ background: 'rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem' }}>Child</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Member</span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {u.email || '—'}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      {u.email && (
                        <button 
                          onClick={() => handleResendInvite(u)}
                          title="Resend Invite Email"
                          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#60a5fa', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          <Send size={15} />
                        </button>
                      )}
                      {/* Can delete if Master Admin or if user is non-admin */}
                      {(isMasterAdmin || !u.isAdmin) && (
                        <button 
                          onClick={() => handleDelete(u.id, u.name)}
                          title="Delete User"
                          style={{ background: 'rgba(239,68,68,0.2)', border: 'none', color: '#ef4444', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
