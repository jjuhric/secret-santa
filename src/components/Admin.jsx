import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [family, setFamily] = useState('');
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
    if (!name || !email || !family) return;
    
    setLoading(true);
    try {
      // Use email as the document ID for easy lookup on login
      await setDoc(doc(db, 'users', email.toLowerCase()), {
        name,
        email: email.toLowerCase(),
        familyId: family.toLowerCase(),
        wishlist: [],
        recipientId: null,
        giftPurchased: false
      });
      setName('');
      setEmail('');
      fetchUsers();
    } catch (err) {
      console.error("Error adding user: ", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(emailId) {
    if(window.confirm("Are you sure you want to remove this user?")) {
      await deleteDoc(doc(db, 'users', emailId));
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
      
      // Prompt requirement: run through randomizer minimum 3 times
      let shuffledRecipients = [...users];
      for(let i=0; i<3; i++) {
        shuffledRecipients = shuffle(shuffledRecipients);
      }
      
      // Shuffle one more time if needed, but we already did 3 minimum
      shuffledRecipients = shuffle(shuffledRecipients);
      
      validDraw = true;
      assignments = {};

      for (let i = 0; i < users.length; i++) {
        const buyer = users[i];
        const recipient = shuffledRecipients[i];

        // Constraint: Cannot pick yourself
        if (buyer.id === recipient.id) {
          validDraw = false;
          break;
        }

        // Constraint: Cannot pick someone in the same family
        if (buyer.familyId === recipient.familyId) {
          validDraw = false;
          break;
        }

        assignments[buyer.id] = recipient.id;
      }
    }

    if (!validDraw) {
      alert('Could not find a valid combination. Please check family distributions (e.g., one family cannot make up more than half the group).');
      setLoading(false);
      return;
    }

    // Save assignments to Firestore
    try {
      for (const [buyerId, recipientId] of Object.entries(assignments)) {
        await setDoc(doc(db, 'users', buyerId), { recipientId }, { merge: true });
      }
      alert('Draw completed successfully!');
      fetchUsers(); // Refresh to see assignments
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
      
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            style={{ padding: '0.5rem', borderRadius: '8px' }}
          />
          <input 
            type="email" 
            placeholder="Google Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            style={{ padding: '0.5rem', borderRadius: '8px' }}
          />
          <input 
            type="text" 
            placeholder="Family Group (e.g. Smith)" 
            value={family} 
            onChange={e => setFamily(e.target.value)} 
            style={{ padding: '0.5rem', borderRadius: '8px' }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            Add User
          </button>
        </form>
      </div>

      <div className="glass-card">
        <h3>Current Users ({users.length})</h3>
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
          {users.map(u => (
            <li key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span>{u.name} ({u.email}) - Family: {u.familyId}</span>
              <button onClick={() => handleDelete(u.id)} style={{ background: 'red', color: 'white', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer' }}>Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
