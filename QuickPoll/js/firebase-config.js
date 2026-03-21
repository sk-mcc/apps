// Firebase configuration and initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
  getDatabase,
  ref,
  push,
  set,
  get,
  update,
  remove,
  onValue,
  off,
  onDisconnect,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAB5J8X1uf3eCIU50T_9VZ5vT7S1hS0t4c",
  authDomain: "quick-poll-4951b.firebaseapp.com",
  databaseURL: "https://quick-poll-4951b-default-rtdb.firebaseio.com",
  projectId: "quick-poll-4951b",
  storageBucket: "quick-poll-4951b.firebasestorage.app",
  messagingSenderId: "54942238268",
  appId: "1:54942238268:web:a484e977de3ee6b5b52539"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Export Firebase functions and references
export {
  db,
  auth,
  ref,
  push,
  set,
  get,
  update,
  remove,
  onValue,
  off,
  onDisconnect,
  serverTimestamp,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};
