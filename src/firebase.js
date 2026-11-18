import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { firebaseConfig } from './config.js';
import { state } from './state.js';

export function initFirebase() {
  const app = initializeApp(firebaseConfig);
  state.db = getFirestore(app);
  state.auth = getAuth(app);
}

// Re-export SDK symbols so feature modules can import them from one place
export {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updateEmail, updatePassword, deleteUser
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

export {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs,
  onSnapshot, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';