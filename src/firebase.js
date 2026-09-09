import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBXJBC-fbD5ZncWbHxoMhR-C40RhBaUyeM",
  authDomain: "uhrick-christmas-list.firebaseapp.com",
  projectId: "uhrick-christmas-list",
  storageBucket: "uhrick-christmas-list.firebasestorage.app",
  messagingSenderId: "1075806188742",
  appId: "1:1075806188742:web:db6cff12f0e06b0cf493c7",
  measurementId: "G-5CYN99RNWT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
