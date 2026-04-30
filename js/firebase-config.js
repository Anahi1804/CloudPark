// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
// Agregamos onAuthStateChanged y signOut
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// Agregamos getDoc
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB97Nlac70vu_rc_6XqCGPkfMa7rHCjkBk",
  databaseURL: "https://cloudpark-bcc27-default-rtdb.firebaseio.com/",
  projectId: "cloudpark-bcc27"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app); 
const auth = getAuth(app); 
const firestoreDB = getFirestore(app); 

// Exportamos TODO
export { db, auth, firestoreDB, ref, onValue, set, update, get, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, doc, setDoc, getDoc };