import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Gift, CheckCircle, LogOut, Users } from 'lucide-react';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const [parentData, setParentData] = useState(null);
  const [managedKids, setManagedKids] = useState([]);
  
  const [viewingId, setViewingId] = useState(null);
  const [activeData, setActiveData] = useState(null);
  const [recipientData, setRecipientData] = useState(null);
  
  const [newItemName, setNewItemName] = useState('');
  const [newItemLink, setNewItemLink] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. Initial Load: Find Parent by Email
  useEffect(() => {
    if (!currentUser?.email) return;
    const emailId = currentUser.email.toLowerCase();
    
    const unsub = onSnapshot(doc(db, 'users', emailId), async (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setParentData(data);
        if (!viewingId) {
          setViewingId(data.id);
        }
        
        // Find managed kids in the same family
        const q = query(
          collection(db, 'users'), 
          where('familyId', '==', data.familyId),
          where('isManaged', '==', true)
        );
        const kidsSnap = await getDocs(q);
        const kids = kidsSnap.docs.map(k => ({ id: k.id, ...k.data() }));
        setManagedKids(kids);
      } else {
        setParentData(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  // 2. Listen to Active Profile (Parent or Kid)
  useEffect(() => {
    if (!viewingId) return;
    
    const unsub = onSnapshot(doc(db, 'users', viewingId), (docSnap) => {
      if (docSnap.exists()) {
        setActiveData({ id: docSnap.id, ...docSnap.data() });
      }
    });
    return () => unsub();
  }, [viewingId]);

  // 3. Listen to Active Profile's Recipient
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

  async function handleAddWishlistItem(e) {
    e.preventDefault();
    if (!newItemName || !activeData) return;
    
    const updatedWishlist = [...(activeData.wishlist || []), { name: newItemName, link: newItemLink, id: Date.now() }];
    await updateDoc(doc(db, 'users', activeData.id), { wishlist: updatedWishlist });
    setNewItemName('');
    setNewItemLink('');
  }

  async function handleRemoveWishlistItem(itemId) {
    if(!activeData) return;
    const updatedWishlist = activeData.wishlist.filter(item => item.id !== itemId);
    await updateDoc(doc(db, 'users', activeData.id), { wishlist: updatedWishlist });
  }

  async function togglePurchased() {
    if(!activeData) return;
    await updateDoc(doc(db, 'users', activeData.id), { giftPurchased: !activeData.giftPurchased });
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading your dashboard...</div>;

  if (!parentData) {
    return (
      <div className="login-container">
        <div className="glass-card login-card">
          <h2>Account Not Found</h2>
          <p>Your email ({currentUser.email}) is not registered in the Secret Santa system. Please ask the Admin to add you.</p>
          <button className="btn btn-primary btn-large" onClick={logout} style={{ marginTop: '1rem' }}>
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Gift color="var(--primary)" /> Secret Santa
        </h1>
        <button onClick={logout} className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
          Logout
        </button>
      </header>

      {/* Profile Switcher */}
      {managedKids.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '2rem', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', overflowX: 'auto' }}>
          <Users color="var(--text-muted)" /> 
          <strong style={{ color: 'var(--text-muted)' }}>Profiles:</strong>
          
          <button 
            onClick={() => setViewingId(parentData.id)}
            style={{ 
              padding: '0.5rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
              background: viewingId === parentData.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
              color: 'white', fontWeight: 'bold'
            }}
          >
            My Account
          </button>
          
          {managedKids.map(kid => (
            <button 
              key={kid.id}
              onClick={() => setViewingId(kid.id)}
              style={{ 
                padding: '0.5rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
                background: viewingId === kid.id ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                color: 'white', fontWeight: 'bold'
              }}
            >
              {kid.name}
            </button>
          ))}
        </div>
      )}

      {activeData && (
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          
          {/* Recipient Section */}
          <div className="glass-card">
            <h2 style={{ marginBottom: '1rem', color: viewingId === parentData.id ? 'var(--primary)' : '#8b5cf6' }}>
              {activeData.name}'s Recipient
            </h2>
            {recipientData ? (
              <>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                  Buying for: {recipientData.name}
                </p>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                  <input 
                    type="checkbox" 
                    id="purchased"
                    checked={activeData.giftPurchased || false} 
                    onChange={togglePurchased} 
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <label htmlFor="purchased" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Gift Purchased for {recipientData.name} <CheckCircle size={20} color={activeData.giftPurchased ? '#10b981' : '#666'} />
                  </label>
                </div>

                <h3>Their Wishlist:</h3>
                {(!recipientData.wishlist || recipientData.wishlist.length === 0) ? (
                  <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>They haven't added anything yet.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
                    {recipientData.wishlist.map(item => (
                      <li key={item.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '8px' }}>
                        <strong>{item.name}</strong>
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: '#60a5fa', textDecoration: 'none', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                            View Item Link &rarr;
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>The drawing hasn't happened yet! Check back later.</p>
            )}
          </div>

          {/* My Wishlist Section */}
          <div className="glass-card">
            <h2 style={{ marginBottom: '1rem' }}>{activeData.name}'s Wishlist</h2>
            <form onSubmit={handleAddWishlistItem} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                placeholder="Item Name (e.g. Lego Set)" 
                value={newItemName} 
                onChange={e => setNewItemName(e.target.value)} 
                style={{ padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' }}
                required
              />
              <input 
                type="url" 
                placeholder="Link to item (optional)" 
                value={newItemLink} 
                onChange={e => setNewItemLink(e.target.value)} 
                style={{ padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' }}
              />
              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Add Item</button>
            </form>

            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
              {(activeData.wishlist || []).map(item => (
                <li key={item.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                    {item.link && <div style={{ fontSize: '0.8rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>{item.link}</div>}
                  </div>
                  <button 
                    onClick={() => handleRemoveWishlistItem(item.id)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {parentData.email === 'admin@family.com' && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link to="/admin" style={{ color: '#94a3b8' }}>Admin Panel</Link>
        </div>
      )}
    </div>
  );
}
