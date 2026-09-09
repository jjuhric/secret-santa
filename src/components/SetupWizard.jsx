import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, collection, setDoc, getDocs, getDoc, query, where } from 'firebase/firestore';
import { Gift, CheckCircle, Sparkles, UserPlus, ArrowRight, ShieldCheck } from 'lucide-react';
import { sendInviteEmail } from '../utils/emailService';
import santaScrollIcon from '../assets/santa-scroll.jpg';

export default function SetupWizard({ onComplete }) {
  const { userProfile, isMasterAdmin } = useAuth();

  const [step, setStep] = useState(1);
  const [name, setName] = useState(userProfile?.name || '');
  const [familyName, setFamilyName] = useState(userProfile?.familyId || '');
  
  // Wishlist items added during setup
  const [wishlistItems, setWishlistItems] = useState(userProfile?.wishlist || []);
  const [itemName, setItemName] = useState('');
  const [itemLink, setItemLink] = useState('');

  // Quick invite member during setup
  const [invitedMembers, setInvitedMembers] = useState([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberIsAdmin, setNewMemberIsAdmin] = useState(false);
  const [newMemberIsChild, setNewMemberIsChild] = useState(false);
  const [inviteStatus, setInviteStatus] = useState('');

  const [saving, setSaving] = useState(false);

  // Step 1: Save Profile & Family
  async function handleStep1Submit(e) {
    e.preventDefault();
    if (!name.trim() || !familyName.trim()) return;

    setSaving(true);
    try {
      const sanitizedFamily = familyName.trim();
      await updateDoc(doc(db, 'users', userProfile.id), {
        name: name.trim(),
        familyId: sanitizedFamily
      });
      setStep(2);
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Failed to save profile: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Step 2: Add Wishlist item
  function handleAddWishlistItem(e) {
    e.preventDefault();
    if (!itemName.trim()) return;

    const newItem = {
      id: Date.now(),
      name: itemName.trim(),
      link: itemLink.trim()
    };

    setWishlistItems(prev => [...prev, newItem]);
    setItemName('');
    setItemLink('');
  }

  function handleRemoveWishlistItem(id) {
    setWishlistItems(prev => prev.filter(item => item.id !== id));
  }

  async function handleStep2Submit() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', userProfile.id), {
        wishlist: wishlistItems
      });
      // If admin, go to family members invite step. Otherwise, go to finish!
      if (userProfile.isAdmin || isMasterAdmin) {
        setStep(3);
      } else {
        await finishSetup();
      }
    } catch (err) {
      console.error("Error saving wishlist:", err);
      alert("Failed to save wishlist: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Step 3: Quick invite member
  async function handleAddMember(e) {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    if (!newMemberIsChild && !newMemberEmail.trim()) {
      alert("Please provide an email for adult accounts.");
      return;
    }

    setSaving(true);
    setInviteStatus('Adding member...');

    try {
      const sanitizedFamily = familyName.trim();
      const memberEmail = newMemberIsChild ? null : newMemberEmail.toLowerCase().trim();

      // Check uniqueness if adult
      if (memberEmail) {
        const existingRef = doc(db, 'users', memberEmail);
        const existingSnap = await getDoc(existingRef);
        if (existingSnap.exists()) {
          alert(`An account with email ${memberEmail} already exists! Accounts must be unique.`);
          setSaving(false);
          setInviteStatus('');
          return;
        }
      } else {
        // Unique kid validation within this family
        const q = query(collection(db, 'users'), where('familyId', '==', sanitizedFamily), where('name', '==', newMemberName.trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          alert(`A family member named "${newMemberName}" already exists in this family.`);
          setSaving(false);
          setInviteStatus('');
          return;
        }
      }

      const docId = newMemberIsChild
        ? `kid-${sanitizedFamily.toLowerCase().replace(/[^a-z0-9]/g, '')}-${newMemberName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`
        : memberEmail;

      const newMemberData = {
        id: docId,
        name: newMemberName.trim(),
        email: memberEmail,
        familyId: sanitizedFamily,
        isAdmin: newMemberIsChild ? false : newMemberIsAdmin,
        role: newMemberIsAdmin ? 'admin' : 'user',
        isManaged: newMemberIsChild,
        setupComplete: false,
        wishlist: [],
        recipientId: null,
        purchasedMembers: {},
        invitedBy: userProfile.name || userProfile.email,
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'users', docId), newMemberData);

      // Attempt to send email invite if adult
      if (memberEmail) {
        const emailRes = await sendInviteEmail({
          toEmail: memberEmail,
          toName: newMemberName.trim(),
          familyName: sanitizedFamily,
          invitedBy: userProfile.name
        });
        if (emailRes.success) {
          setInviteStatus(`Invite email delivered to ${memberEmail}!`);
        } else if (emailRes.notConfigured) {
          setInviteStatus(`User added! (Note: EmailJS setup in Admin Panel can automate emails)`);
        } else {
          setInviteStatus(`User added, but email failed: ${emailRes.message}`);
        }
      } else {
        setInviteStatus(`Child profile "${newMemberName}" added!`);
      }

      setInvitedMembers(prev => [...prev, newMemberData]);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberIsAdmin(false);
      setNewMemberIsChild(false);
    } catch (err) {
      console.error("Error adding member:", err);
      alert("Failed to add member: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Complete the entire setup wizard
  async function finishSetup() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', userProfile.id), {
        setupComplete: true
      });
      if (onComplete) onComplete();
    } catch (err) {
      console.error("Error finalizing setup:", err);
      alert("Error finalizing setup: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="login-container" style={{ minHeight: '100vh', padding: '2rem 1rem' }}>
      <div className="glass-card" style={{ maxWidth: '600px', width: '100%', position: 'relative', zIndex: 10 }}>
        
        {/* Header / Stepper indicator */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div 
            className="icon-wrapper" 
            style={{ 
              width: '84px', 
              height: '84px', 
              borderRadius: '20px', 
              overflow: 'hidden', 
              padding: 0, 
              border: '2px solid rgba(251, 191, 36, 0.6)', 
              boxShadow: '0 8px 25px rgba(220, 38, 38, 0.45)' 
            }}
          >
            <img 
              src={santaScrollIcon} 
              alt="Santa reading wishlist scroll" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          </div>
          <h2 className="title" style={{ fontSize: '1.8rem' }}>Welcome to Secret Santa!</h2>
          <p className="subtitle" style={{ marginBottom: '1rem' }}>
            {isMasterAdmin ? 'Master Admin First-Time Setup' : 'First-Time Account Setup Wizard'}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
            <div style={{ width: '30px', height: '6px', borderRadius: '3px', background: step >= 1 ? 'var(--primary)' : 'rgba(255,255,255,0.2)' }} />
            <div style={{ width: '30px', height: '6px', borderRadius: '3px', background: step >= 2 ? 'var(--primary)' : 'rgba(255,255,255,0.2)' }} />
            {(userProfile?.isAdmin || isMasterAdmin) && (
              <div style={{ width: '30px', height: '6px', borderRadius: '3px', background: step >= 3 ? 'var(--primary)' : 'rgba(255,255,255,0.2)' }} />
            )}
            <div style={{ width: '30px', height: '6px', borderRadius: '3px', background: step === 4 ? 'var(--primary)' : 'rgba(255,255,255,0.2)' }} />
          </div>
        </div>

        {/* STEP 1: Profile & Family Name */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              Step 1: Your Profile & Family
            </h3>
            
            {isMasterAdmin && (
              <div style={{ background: 'rgba(236,72,153,0.15)', border: '1px solid var(--primary)', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.9rem' }}>
                ⭐ <strong>You are the Master Admin!</strong> You are the first user to set up the system. You have full access to manage all families and conduct the Secret Santa draw.
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Your Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Jane Uhrick"
                style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1rem' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Family Group Name</label>
              <input
                type="text"
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                placeholder="e.g. Uhrick"
                style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1rem' }}
                required
              />
              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                Family members in this group will not pick each other during the Secret Santa draw.
              </small>
            </div>

            <button type="submit" className="btn btn-primary btn-large" disabled={saving} style={{ marginTop: '1rem' }}>
              {saving ? 'Saving...' : 'Continue to Wishlist'} <ArrowRight size={18} />
            </button>
          </form>
        )}

        {/* STEP 2: Initial Wishlist */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              Step 2: Add Gift Ideas to Your Wishlist
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Help whoever draws your name! Add 1 or 2 items you'd love to receive (you can add more anytime on your dashboard).
            </p>

            <form onSubmit={handleAddWishlistItem} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px' }}>
              <input
                type="text"
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                placeholder="Item name (e.g. Cozy Wool Sweater)"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
              />
              <input
                type="url"
                value={itemLink}
                onChange={e => setItemLink(e.target.value)}
                placeholder="Link to item (optional Amazon, Target, etc.)"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
              />
              <button type="submit" className="btn" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
                <Gift size={16} /> Add to List
              </button>
            </form>

            {wishlistItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <strong>Current Wishlist ({wishlistItems.length}):</strong>
                {wishlistItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                    <span>{item.name}</span>
                    <button onClick={() => handleRemoveWishlistItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button className="btn" onClick={() => setStep(1)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                Back
              </button>
              <button className="btn btn-primary" onClick={handleStep2Submit} disabled={saving} style={{ flex: 1 }}>
                {saving ? 'Saving...' : (userProfile?.isAdmin || isMasterAdmin ? 'Continue to Invite Members' : 'Complete Setup')} <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Quick Invite Members (Admins only) */}
        {step === 3 && (userProfile?.isAdmin || isMasterAdmin) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              Step 3: Invite Family Members
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Add members to the <strong>{familyName}</strong> family. Adult accounts receive an email invite to log in with Google.
            </p>

            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="wizardIsChild"
                  checked={newMemberIsChild}
                  onChange={e => setNewMemberIsChild(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="wizardIsChild" style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  Child / Managed profile (No email needed, parent manages)
                </label>
              </div>

              <input
                type="text"
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                placeholder="Full Name (e.g. Timmy Uhrick)"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                required
              />

              {!newMemberIsChild && (
                <>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={e => setNewMemberEmail(e.target.value)}
                    placeholder="Google Email (for login)"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                    required
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      id="wizardIsAdmin"
                      checked={newMemberIsAdmin}
                      onChange={e => setNewMemberIsAdmin(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <label htmlFor="wizardIsAdmin" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                      <ShieldCheck size={16} color="var(--primary)" /> <strong>Is Admin</strong> (Can view admin panel for {familyName})
                    </label>
                  </div>
                </>
              )}

              <button type="submit" className="btn btn-primary" disabled={saving}>
                <UserPlus size={16} /> {newMemberIsChild ? 'Add Child Profile' : 'Invite Family Member'}
              </button>
            </form>

            {inviteStatus && (
              <div style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                {inviteStatus}
              </div>
            )}

            {invitedMembers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <strong>Added Members ({invitedMembers.length}):</strong>
                {invitedMembers.map((m, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                    <strong>{m.name}</strong> {m.isManaged ? '(Child)' : `(${m.email})`} {m.isAdmin && '⭐ Admin'}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button className="btn" onClick={() => setStep(2)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                Back
              </button>
              <button className="btn btn-primary" onClick={() => setStep(4)} style={{ flex: 1 }}>
                Ready to Finish <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Ready & Finish */}
        {step === 4 && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem 0' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <CheckCircle size={48} color="#10b981" />
            </div>
            
            <h3 style={{ fontSize: '1.5rem' }}>You're All Set!</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Your account has been configured. You can now view your family shopping checklist, update your wishlist anytime, and see your Secret Santa recipient once the draw is run!
            </p>

            <button className="btn btn-primary btn-large" onClick={finishSetup} disabled={saving}>
              {saving ? 'Finalizing...' : 'Enter Secret Santa Dashboard'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
