import { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, limit, query } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUninvited, setIsUninvited] = useState(false);

  function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider);
  }

  function logout() {
    setUserProfile(null);
    setIsUninvited(false);
    return signOut(auth);
  }

  useEffect(() => {
    let unsubscribeDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user && user.email) {
        const email = user.email.toLowerCase().trim();
        const userRef = doc(db, 'users', email);

        try {
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            // Check if ANY users exist in the entire collection
            const q = query(collection(db, 'users'), limit(1));
            const allUsersSnap = await getDocs(q);

            if (allUsersSnap.empty) {
              // First ever user to sign in! Assign Master Admin
              const initialMaster = {
                id: email,
                name: user.displayName || 'Master Admin',
                email: email,
                photoURL: user.photoURL || '',
                familyId: '',
                role: 'master',
                isAdmin: true,
                isMaster: true,
                isManaged: false,
                setupComplete: false,
                wishlist: [],
                recipientId: null,
                purchasedMembers: {},
                createdAt: Date.now()
              };
              await setDoc(userRef, initialMaster);
              setUserProfile(initialMaster);
              setIsUninvited(false);
            } else {
              // Not the first user, and no invite found for this email
              setUserProfile(null);
              setIsUninvited(true);
            }
          } else {
            setIsUninvited(false);
          }

          // Set up real-time listener for current user's profile
          unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile({ id: docSnap.id, ...docSnap.data() });
              setIsUninvited(false);
            }
          });
        } catch (err) {
          console.error("Auth state handling error:", err);
        }
      } else {
        setUserProfile(null);
        setIsUninvited(false);
      }

      setLoading(false);
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const isMasterAdmin = userProfile?.isMaster === true || userProfile?.role === 'master';
  const isFamilyAdmin = userProfile?.isAdmin === true || isMasterAdmin;

  const value = {
    currentUser,
    userProfile,
    isMasterAdmin,
    isAdmin: isFamilyAdmin,
    isUninvited,
    loading,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
