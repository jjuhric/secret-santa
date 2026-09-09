import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, setDoc, deleteDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Gift, CheckCircle, LogOut, Users, Plus, ShieldCheck, ExternalLink, Trash2, CheckSquare, Square, X } from 'lucide-react';
import SetupWizard from './SetupWizard';
import santaScrollIcon from '../assets/santa-scroll.jpg';
import { sendInviteEmail } from '../utils/emailService';

export default function Dashboard() {
  const { currentUser, userProfile, isAdmin, isMasterAdmin, isUninvited, logout } = useAuth();

  // Family members list (same family group)
  const [familyMembers, setFamilyMembers] = useState([]);
  // Managed child accounts in this family
  const [managedKids, setManagedKids] = useState([]);
  
  // Currently active viewing profile (defaults to the logged-in user, can switch to kid)
  const [viewingId, setViewingId] = useState(null);
  const [activeData, setActiveData] = useState(null);
  
  // Christmas Shopping List assigned recipient for active profile
  const [recipientData, setRecipientData] = useState(null);
  
  // Wishlist item addition
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemLink, setNewItemLink] = useState('');

  // Extra Person addition
  const [isAddingExtraPerson, setIsAddingExtraPerson] = useState(false);
  const [newExtraPersonName, setNewExtraPersonName] = useState('');
  const [newExtraPersonEmail, setNewExtraPersonEmail] = useState('');

  // Wishlist modal
  const [wishlistModalMember, setWishlistModalMember] = useState(null);

  const [loading, setLoading] = useState(true);

  // Set default active viewing profile
  useEffect(() => {
    if (userProfile && !viewingId) {
      setViewingId(userProfile.id);
      setActiveData(userProfile);
    }
  }, [userProfile]);

  // Listen to active profile changes
  useEffect(() => {
    if (!viewingId) return;
    const unsub = onSnapshot(doc(db, 'users', viewingId), (docSnap) => {
      if (docSnap.exists()) {
        setActiveData({ id: docSnap.id, ...docSnap.data() });
      }
    });
    return () => unsub();
  }, [viewingId]);

  // Load Family Members (Rule 4: Only members of their own family group)
  useEffect(() => {
    if (!userProfile?.familyId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('familyId', '==', userProfile.familyId)
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const members = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter out the active user themselves so they see the other family members to shop for
      setFamilyMembers(members.filter(m => m.id !== (userProfile.id || userProfile.email)));
      // Managed kids for the profile switcher (exclude extra people)
      setManagedKids(members.filter(m => m.isManaged && !m.isExtra));
      setLoading(false);

      // Auto-sync: If user profile has extraPeople not yet in Firestore 'users', save them to family
      if (userProfile?.extraPeople && Array.isArray(userProfile.extraPeople)) {
        for (const ep of userProfile.extraPeople) {
          const docId = ep.id || (ep.email ? ep.email.toLowerCase().trim() : null);
          if (!docId) continue;
          const existsInMembers = members.some(m => m.id === docId || (ep.email && m.email === ep.email));
          if (!existsInMembers) {
            try {
              await setDoc(doc(db, 'users', docId), {
                id: docId,
                name: ep.name,
                email: ep.email || null,
                familyId: userProfile.familyId,
                isAdmin: false,
                role: 'user',
                isManaged: !ep.email,
                isExtra: true,
                setupComplete: false,
                wishlist: [],
                recipientId: null,
                purchasedMembers: {},
                invitedBy: userProfile.name || userProfile.email || '',
                createdAt: Date.now()
              });
            } catch (err) {
              console.warn("Could not sync extra person to family:", err);
            }
          }
        }
      }
    });

    return () => unsub();
  }, [userProfile?.familyId, userProfile?.id, userProfile?.email]);

  // Listen to Active Profile's Secret Santa Recipient
  useEffect(() => {
    if (!activeData?.recipientId) {
      setRecipientData(null);
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', activeData.recipientId), (docSnap) => {
      if (docSnap.exists()) {
        setRecipientData({ id: docSnap.id, ...docSnap.data() });
      }
    });
    return () => unsub();
  }, [activeData?.recipientId]);

  // Toggle Shopping Checkbox for a family member (Rule 4)
  async function toggleFamilyShopping(memberId) {
    if (!activeData) return;
    const currentStatus = activeData.purchasedMembers?.[memberId] || false;
    const updatedPurchasedMembers = {
      ...(activeData.purchasedMembers || {}),
      [memberId]: !currentStatus
    };

    await updateDoc(doc(db, 'users', activeData.id), {
      purchasedMembers: updatedPurchasedMembers
    });
  }

  // Toggle Secret Santa assignment gift purchased
  async function toggleSecretSantaPurchased() {
    if (!activeData) return;
    await updateDoc(doc(db, 'users', activeData.id), {
      giftPurchased: !activeData.giftPurchased
    });
  }

  // Add Extra Person to Buy For list and create user document in the family
  async function handleAddExtraPerson(e) {
    e.preventDefault();
    if (!newExtraPersonName.trim() || !activeData) return;
    
    const cleanEmail = newExtraPersonEmail.trim().toLowerCase() || null;
    const docId = cleanEmail || `extra_${Date.now()}`;
    const familyId = userProfile?.familyId || activeData?.familyId || '';
    
    const newPersonDoc = {
      id: docId,
      name: newExtraPersonName.trim(),
      email: cleanEmail,
      familyId: familyId,
      isAdmin: false,
      role: 'user',
      isManaged: !cleanEmail,
      isExtra: true,
      setupComplete: false,
      wishlist: [],
      recipientId: null,
      purchasedMembers: {},
      invitedBy: userProfile?.name || userProfile?.email || '',
      createdAt: Date.now()
    };

    try {
      await setDoc(doc(db, 'users', docId), newPersonDoc);
      
      if (cleanEmail) {
        try {
          await sendInviteEmail({
            toEmail: cleanEmail,
            toName: newExtraPersonName.trim(),
            familyName: familyId,
            invitedBy: userProfile?.name || userProfile?.email || 'Family Member'
          });
        } catch (mailErr) {
          console.warn("Could not send invite to extra person:", mailErr);
        }
      }
    } catch (err) {
      console.error("Error creating extra user doc in family:", err);
    }
    
    const newPerson = {
      id: docId,
      name: newExtraPersonName.trim(),
      email: cleanEmail,
      isExtra: true
    };
    
    const updatedExtraPeople = [...(activeData.extraPeople || []), newPerson];
    await updateDoc(doc(db, 'users', activeData.id), { extraPeople: updatedExtraPeople });
    
    setNewExtraPersonName('');
    setNewExtraPersonEmail('');
    setIsAddingExtraPerson(false);
  }

  // Delete Extra Person from Buy For list and Firestore
  async function handleDeleteExtraPerson(personId, personName) {
    if (window.confirm(`Remove "${personName}" from your shopping list?`)) {
      try {
        const updated = (activeData?.extraPeople || []).filter(p => p.id !== personId);
        await updateDoc(doc(db, 'users', activeData.id), { extraPeople: updated });
        try {
          await deleteDoc(doc(db, 'users', personId));
        } catch (delErr) {
          console.warn("Could not delete extra person doc:", delErr);
        }
      } catch (err) {
        console.error("Error deleting extra person:", err);
        alert("Failed to remove extra person: " + err.message);
      }
    }
  }

  // Add Item to active profile's wishlist (Rule 5)
  async function handleAddWishlistItem(e) {
    e.preventDefault();
    if (!newItemName.trim() || !activeData) return;

    const newItem = {
      id: Date.now(),
      name: newItemName.trim(),
      link: newItemLink.trim()
    };

    const updatedWishlist = [...(activeData.wishlist || []), newItem];
    await updateDoc(doc(db, 'users', activeData.id), { wishlist: updatedWishlist });
    
    setNewItemName('');
    setNewItemLink('');
    setIsAddingItem(false);
  }

  // Remove Item from wishlist
  async function handleRemoveWishlistItem(itemId) {
    if (!activeData) return;
    const updatedWishlist = (activeData.wishlist || []).filter(item => item.id !== itemId);
    await updateDoc(doc(db, 'users', activeData.id), { wishlist: updatedWishlist });
  }

  // Rule 1: User first time login should be taken to the setup wizard to setup their account.
  if (userProfile && userProfile.setupComplete !== true) {
    return <SetupWizard onComplete={() => {}} />;
  }

  if (loading) {
    return (
      <div className="login-container">
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Gift size={48} color="var(--primary)" style={{ animation: 'bounce 1s infinite' }} />
          <h2 style={{ marginTop: '1rem' }}>Loading your Christmas Dashboard...</h2>
        </div>
      </div>
    );
  }

  // If user signed in with Google but is not invited / has no record
  if (isUninvited || !userProfile) {
    return (
      <div className="login-container">
        <div className="glass-card login-card">
          <div className="icon-wrapper" style={{ background: 'rgba(239,68,68,0.2)', boxShadow: 'none' }}>
            <Gift size={36} color="#ef4444" />
          </div>
          <h2>Account Not Found</h2>
          <p className="subtitle" style={{ marginTop: '0.5rem' }}>
            The email <strong>{currentUser?.email}</strong> has not been invited to a Christmas Shopping List family yet.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Please contact your Family Admin to send you an invitation email.
          </p>
          <button className="btn btn-primary btn-large" onClick={logout}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Combine all people into unified "Buy For" list
  const buyForList = [];
  
  // 1. Secret Santa Recipient
  if (recipientData) {
    buyForList.push({
      id: recipientData.id,
      name: recipientData.name,
      type: 'secret_santa',
      isBought: activeData?.giftPurchased || false,
      wishlist: recipientData.wishlist || [],
      onToggle: toggleSecretSantaPurchased
    });
  }
  
  // 2. Family Members
  familyMembers.forEach(member => {
    if (recipientData && member.id === recipientData.id) return;

    buyForList.push({
      id: member.id,
      name: member.name,
      type: member.isExtra ? 'extra' : 'family',
      isManaged: member.isManaged,
      isBought: activeData?.purchasedMembers?.[member.id] || false,
      wishlist: member.wishlist || [],
      onToggle: () => toggleFamilyShopping(member.id)
    });
  });
  
  // 3. Extra People (fallback for any not yet synced into familyMembers)
  if (activeData?.extraPeople) {
    activeData.extraPeople.forEach(person => {
      const alreadyInList = buyForList.some(item => 
        item.id === person.id || 
        (person.email && item.email === person.email) ||
        (person.name && item.name.toLowerCase() === person.name.toLowerCase() && item.type === 'extra')
      );
      if (!alreadyInList) {
        buyForList.push({
          id: person.id,
          name: person.name,
          type: 'extra',
          isBought: activeData?.purchasedMembers?.[person.id] || false,
          wishlist: [],
          onToggle: () => toggleFamilyShopping(person.id)
        });
      }
    });
  }

  // Calculate shopping checklist stats based on unified list
  const completedCount = buyForList.filter(m => m.isBought).length;
  const totalToShop = buyForList.length;
  const progressPercent = totalToShop > 0 ? Math.round((completedCount / totalToShop) * 100) : 0;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '1.8rem' }}>
            <img 
              src={santaScrollIcon} 
              alt="Santa reading wishlist scroll" 
              style={{ width: '38px', height: '38px', borderRadius: '10px', objectFit: 'cover', border: '1.5px solid rgba(251, 191, 36, 0.6)', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }} 
            />
            Christmas Shopping List
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Welcome back, <strong>{userProfile.name}</strong>
            </span>
            <span style={{ background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)', color: '#f87171', padding: '0.15rem 0.5rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              {userProfile.familyId} Family
            </span>
            {isMasterAdmin && (
              <span style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#1a0f02', padding: '0.15rem 0.5rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800' }}>
                Master Admin
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {(isAdmin || isMasterAdmin) && (
            <Link to="/admin" className="btn" style={{ background: 'rgba(220,38,38,0.18)', border: '1px solid var(--primary)', color: 'white', textDecoration: 'none' }}>
              <ShieldCheck size={18} color="var(--primary)" /> Admin Panel
            </Link>
          )}

          <button onClick={logout} className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Managed Profiles Switcher (Rule 6: Admins & Parents have access to kids) */}
      {managedKids.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '2rem', padding: '0.85rem 1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center', overflowX: 'auto' }}>
          <Users color="var(--text-muted)" size={20} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            Managing Profiles:
          </span>

          <button
            onClick={() => setViewingId(userProfile.id)}
            style={{
              padding: '0.45rem 0.9rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
              background: viewingId === userProfile.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
              color: 'white', fontWeight: 'bold', fontSize: '0.85rem', whiteSpace: 'nowrap'
            }}
          >
            {userProfile.name} (Me)
          </button>

          {managedKids.map(kid => (
            <button
              key={kid.id}
              onClick={() => setViewingId(kid.id)}
              style={{
                padding: '0.45rem 0.9rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
                background: viewingId === kid.id ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                color: 'white', fontWeight: 'bold', fontSize: '0.85rem', whiteSpace: 'nowrap'
              }}
            >
              {kid.name} (Child)
            </button>
          ))}
        </div>
      )}

            {/* Main Grid: Unified Buy For List & My Wishlist */}
      <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        
        {/* Unified "Buy For" List */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>
                {activeData?.name}'s "Buy For" List
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Track everyone you need to shop for
              </p>
            </div>
            <span style={{ fontSize: '0.85rem', color: progressPercent === 100 && totalToShop > 0 ? '#10b981' : 'var(--primary)', fontWeight: 'bold' }}>
              {completedCount} / {totalToShop} Done ({progressPercent}%)
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(to right, var(--primary), #10b981)', transition: 'width 0.4s ease' }} />
          </div>

          {buyForList.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
              Your shopping list is empty. Add extra people below!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {buyForList.map(member => (
                <div 
                  key={member.id} 
                  style={{
                    padding: '0.9rem',
                    borderRadius: '12px',
                    background: member.isBought ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${member.isBought ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
                      {/* Checkbox ONLY for toggling */}
                      <div 
                        onClick={(e) => { e.stopPropagation(); member.onToggle(); }} 
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        {member.isBought ? (
                          <CheckSquare size={20} color="#10b981" />
                        ) : (
                          <Square size={20} color="var(--text-muted)" />
                        )}
                      </div>

                      {/* Click anywhere else opens the wishlist modal */}
                      <div 
                        onClick={() => setWishlistModalMember(member)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}
                      >
                        <span style={{ textDecoration: member.isBought ? 'line-through' : 'none', color: member.isBought ? '#10b981' : 'white', fontWeight: 'bold', fontSize: '1rem' }}>
                          {member.name}
                        </span>
                        {member.type === 'secret_santa' && (
                          <span style={{ fontSize: '0.75rem', color: '#ec4899', fontWeight: 'normal' }}>(Secret Santa)</span>
                        )}
                        {member.type === 'extra' && (
                          <span style={{ fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 'normal' }}>(Extra)</span>
                        )}
                        {member.isManaged && (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal' }}>(Child)</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {member.isBought && (
                        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>Shopped</span>
                      )}
                      {member.type === 'extra' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteExtraPerson(member.id, member.name); }}
                          title="Remove extra person"
                          data-testid={`delete-extra-${member.id}`}
                          style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#ef4444', cursor: 'pointer', borderRadius: '6px', padding: '0.3rem', display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Extra Person */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
            {!isAddingExtraPerson ? (
              <button 
                className="btn btn-secondary" 
                onClick={() => setIsAddingExtraPerson(true)}
                style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white' }}
              >
                <Plus size={16} /> Add Extra Person
              </button>
            ) : (
              <form onSubmit={handleAddExtraPerson} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Name (e.g. Grandma, Teacher)"
                    value={newExtraPersonName}
                    onChange={e => setNewExtraPersonName(e.target.value)}
                    style={{ flex: 1, minWidth: '150px', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={newExtraPersonEmail}
                    onChange={e => setNewExtraPersonEmail(e.target.value)}
                    style={{ flex: 1, minWidth: '150px', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>Add</button>
                  <button type="button" className="btn" onClick={() => setIsAddingExtraPerson(false)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* RULE 5: My Wishlist with Add Item */}
        <div className="glass-card" style={{ height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>
                {activeData?.name}'s Wishlist
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Gift ideas for your Christmas Shopping List buyer
              </p>
            </div>

            {!isAddingItem && (
              <button 
                className="btn btn-primary" 
                onClick={() => setIsAddingItem(true)}
                style={{ 
                  padding: '0.4rem 0.85rem', 
                  fontSize: '0.85rem', 
                  whiteSpace: 'nowrap', 
                  flexShrink: 0,
                  borderRadius: '10px'
                }}
              >
                <Plus size={15} /> Add Item
              </button>
            )}
          </div>

          {/* Inline Add Item Form */}
          {isAddingItem && (
            <form onSubmit={handleAddWishlistItem} style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Item Name (e.g. Wireless Headphones)"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                required
              />
              <input
                type="url"
                placeholder="Link to item (optional Amazon, Target, etc.)"
                value={newItemLink}
                onChange={e => setNewItemLink(e.target.value)}
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.6rem' }}>
                  Save Item
                </button>
                <button type="button" className="btn" onClick={() => setIsAddingItem(false)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.6rem 1rem' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Wishlist Items List */}
          {(!activeData?.wishlist || activeData.wishlist.length === 0) ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>
              No items on your wishlist yet. Click "Add Item" above to add your first gift idea!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {activeData.wishlist.map(item => (
                <div key={item.id} style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem 1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{item.name}</div>
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.2rem' }}>
                        View Link <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <button 
                    onClick={() => handleRemoveWishlistItem(item.id)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.4rem' }}
                    title="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Wishlist Modal */}
      {wishlistModalMember && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem'
        }} onClick={() => setWishlistModalMember(null)}>
          <div className="glass-card" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', color: 'white', margin: 0 }}>{wishlistModalMember.name}'s Wishlist</h2>
              <button onClick={() => setWishlistModalMember(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}>
                <X size={20} />
              </button>
            </div>
            
            {wishlistModalMember.wishlist && wishlistModalMember.wishlist.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {wishlistModalMember.wishlist.map((item, idx) => (
                  <li key={item.id || idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: item.link ? '0.5rem' : '0' }}>{item.name}</div>
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <ExternalLink size={14} /> View Item
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                <Gift size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                <p>{wishlistModalMember.name} hasn't added any items to their wishlist yet.</p>
              </div>
            )}
            
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setWishlistModalMember(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}