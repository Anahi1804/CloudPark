// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
// Agregamos createUserWithEmailAndPassword
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// NUEVO: Importamos Firestore
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB97Nlac70vu_rc_6XqCGPkfMa7rHCjkBk",
  databaseURL: "https://cloudpark-bcc27-default-rtdb.firebaseio.com/",
  projectId: "cloudpark-bcc27"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app); // La Realtime Database para los sensores
const auth = getAuth(app); // Para el login
const firestoreDB = getFirestore(app); // NUEVO: Para guardar los perfiles y el historial

// Exportamos todo para que los demás archivos lo usen
export { db, auth, firestoreDB, ref, onValue, set, update, get, signInWithEmailAndPassword, createUserWithEmailAndPassword, doc, setDoc };