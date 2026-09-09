import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [family, setFamily] = useState('');
  const [isManaged, setIsManaged] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setUsers(usersList);
  }

  async function handleAddUser(e) {
    e.preventDefault();
    if (!name || !family) return;
    if (!isManaged && !email) {
      alert("Email is required for adult accounts.");
      return;
    }
    
    setLoading(true);
    try {
      const sanitizedFamily = family.toLowerCase().trim();
      const docId = isManaged 
        ? `kid-${sanitizedFamily}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`
        : email.toLowerCase().trim();

      await setDoc(doc(db, 'users', docId), {
        name: name.trim(),
        email: isManaged ? null : email.toLowerCase().trim(),
        familyId: sanitizedFamily,
        isManaged: isManaged,
        wishlist: [],
        recipientId: null,
        giftPurchased: false
      });
      
      setName('');
      setEmail('');
      setIsManaged(false);
      fetchUsers();
    } catch (err) {
      console.error("Error adding user: ", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(docId) {
    if(window.confirm("Are you sure you want to remove this user?")) {
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
      alert('Need at least 3 users to draw.');
      return;
    }

    let validDraw = false;
    let attempts = 0;
    let assignments = {};

    setLoading(true);
    
    while (!validDraw && attempts < 1000) {
      attempts++;
      
      let shuffledRecipients = [...users];
      for(let i=0; i<3; i++) {
        shuffledRecipients = shuffle(shuffledRecipients);
      }
      shuffledRecipients = shuffle(shuffledRecipients);
      
      validDraw = true;
      assignments = {};

      for (let i = 0; i < users.length; i++) {
        const buyer = users[i];
        const recipient = shuffledRecipients[i];

        if (buyer.id === recipient.id || buyer.familyId === recipient.familyId) {
          validDraw = false;
          break;
        }

        assignments[buyer.id] = recipient.id;
      }
    }

    if (!validDraw) {
      alert('Could not find a valid combination. Check family distributions.');
      setLoading(false);
      return;
    }

    try {
      for (const [buyerId, recipientId] of Object.entries(assignments)) {
        await setDoc(doc(db, 'users', buyerId), { recipientId }, { merge: true });
      }
      alert('Draw completed successfully!');
      fetchUsers();
    } catch (err) {
      console.error('Error saving draw: ', err);
      alert('Failed to save the draw.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-container" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Admin Panel: Manage Users</h2>
        <button className="btn btn-primary" onClick={handleDraw} disabled={loading || users.length < 3}>
          Run Secret Santa Draw!
        </button>
      </div>
      
      <div className="glass-card" style={{ marginBottom: '2rem', marginTop: '1rem' }}>
        <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input 
              type="checkbox" 
              id="isManaged"
              checked={isManaged} 
              onChange={e => setIsManaged(e.target.checked)} 
              style={{ width: '18px', height: '18px' }}
            />
            <label htmlFor="isManaged" style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              This is a managed child account (no email needed)
            </label>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="Name" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              style={{ padding: '0.5rem', borderRadius: '8px', flex: 1 }}
              required
            />
            {!isManaged && (
              <input 
                type="email" 
                placeholder="Google Email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                style={{ padding: '0.5rem', borderRadius: '8px', flex: 1 }}
                required
              />
            )}
            <input 
              type="text" 
              placeholder="Family Group (e.g. Smith)" 
              value={family} 
              onChange={e => setFamily(e.target.value)} 
              style={{ padding: '0.5rem', borderRadius: '8px', flex: 1 }}
              required
            />
          </div>
          
          <div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Add User
            </button>
          </div>
        </form>
      </div>

      <div className="glass-card">
        <h3>Current Users ({users.length})</h3>
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
          {users.map(u => (
            <li key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span>
                <strong>{u.name}</strong> {u.isManaged ? <span style={{color: '#94a3b8'}}>(Child)</span> : `(${u.email})`} 
                <span style={{ marginLeft: '10px', color: '#ec4899' }}>Family: {u.familyId}</span>
              </span>
              <button onClick={() => handleDelete(u.id)} style={{ background: 'red', color: 'white', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer' }}>Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
