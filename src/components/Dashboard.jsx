import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Gift, CheckCircle, LogOut, Users, Plus, ShieldCheck, ExternalLink, Trash2, CheckSquare, Square } from 'lucide-react';
import SetupWizard from './SetupWizard';
import santaScrollIcon from '../assets/santa-scroll.jpg';

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

    const unsub = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter out the active user themselves so they see the other family members to shop for
      setFamilyMembers(members.filter(m => m.id !== (userProfile.id || userProfile.email)));
      // Managed kids for the profile switcher
      setManagedKids(members.filter(m => m.isManaged));
      setLoading(false);
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

  // Calculate shopping checklist stats
  const completedCount = familyMembers.filter(m => activeData?.purchasedMembers?.[m.id]).length;
  const totalFamilyToShop = familyMembers.length;
  const progressPercent = totalFamilyToShop > 0 ? Math.round((completedCount / totalFamilyToShop) * 100) : 0;

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

      {/* Main Grid: Family Shopping Checklist (Rule 4) & Secret Santa Assignment & My Wishlist (Rule 5) */}
      <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        
        {/* RULE 4: Family Member Shopping List with Checkboxes */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>
                {activeData?.name}'s Family Shopping List
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {userProfile.familyId} Family Members
              </p>
            </div>
            <span style={{ fontSize: '0.85rem', color: progressPercent === 100 ? '#10b981' : 'var(--primary)', fontWeight: 'bold' }}>
              {completedCount} / {totalFamilyToShop} Done ({progressPercent}%)
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(to right, var(--primary), #10b981)', transition: 'width 0.4s ease' }} />
          </div>

          {familyMembers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
              No other family members in the {userProfile.familyId} group yet. Add them in the Admin Panel!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {familyMembers.map(member => {
                const isBought = activeData?.purchasedMembers?.[member.id] || false;
                return (
                  <div 
                    key={member.id} 
                    style={{
                      padding: '0.9rem',
                      borderRadius: '12px',
                      background: isBought ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isBought ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label 
                        style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', flex: 1 }}
                        onClick={() => toggleFamilyShopping(member.id)}
                      >
                        {isBought ? (
                          <CheckSquare size={20} color="#10b981" />
                        ) : (
                          <Square size={20} color="var(--text-muted)" />
                        )}
                        <span style={{ textDecoration: isBought ? 'line-through' : 'none', color: isBought ? '#10b981' : 'white' }}>
                          {member.name}
                        </span>
                        {member.isManaged && (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal' }}>(Child)</span>
                        )}
                      </label>

                      {isBought && (
                        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>Shopped</span>
                      )}
                    </div>

                    {/* Member's Wishlist Preview */}
                    {member.wishlist && member.wishlist.length > 0 && (
                      <div style={{ marginTop: '0.25rem', paddingLeft: '1.8rem', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Wishes: </span>
                        {member.wishlist.map((item, idx) => (
                          <span key={item.id || idx} style={{ color: '#cbd5e1', marginRight: '0.5rem' }}>
                            • {item.name}
                            {item.link && (
                              <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', marginLeft: '3px' }}>
                                <ExternalLink size={12} style={{ display: 'inline' }} />
                              </a>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 2: Secret Santa Recipient & My Wishlist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Secret Santa Draw Result Card */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>
              🎁 Christmas Shopping List Assignment
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Assigned through random 3x shuffle (outside your family)
            </p>

            {recipientData ? (
              <div>
                <div style={{ background: 'rgba(236,72,153,0.15)', border: '1px solid var(--primary)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>You are buying for:</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '0.25rem' }}>
                    {recipientData.name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#ec4899', marginTop: '0.25rem' }}>
                    Family: {recipientData.familyId}
                  </div>
                </div>

                <div 
                  onClick={toggleSecretSantaPurchased}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.85rem',
                    background: activeData?.giftPurchased ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.25)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    marginBottom: '1.25rem',
                    border: `1px solid ${activeData?.giftPurchased ? '#10b981' : 'rgba(255,255,255,0.1)'}`
                  }}
                >
                  <CheckCircle size={22} color={activeData?.giftPurchased ? '#10b981' : 'gray'} />
                  <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: activeData?.giftPurchased ? '#10b981' : 'white' }}>
                    {activeData?.giftPurchased ? 'Gift Purchased for ' + recipientData.name : 'Mark Gift as Purchased'}
                  </span>
                </div>

                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Their Wishlist:</h3>
                {(!recipientData.wishlist || recipientData.wishlist.length === 0) ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>They haven't added any wishlist items yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {recipientData.wishlist.map(item => (
                      <div key={item.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            Link <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)' }}>
                <p>The Christmas Shopping List draw hasn't been conducted yet.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Once the Master Admin runs the draw, your recipient will appear here!</p>
              </div>
            )}
          </div>

          {/* RULE 5: My Wishlist with Add Item */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
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
                  style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                >
                  <Plus size={16} /> Add Item
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

      </div>

    </div>
  );
}
