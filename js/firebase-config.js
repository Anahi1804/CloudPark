// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update, get, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB97Nlac70vu_rc_6XqCGPkfMa7rHCjkBk",
  databaseURL: "https://cloudpark-bcc27-default-rtdb.firebaseio.com/",
  projectId: "cloudpark-bcc27"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const firestoreDB = getFirestore(app);

// --- CONFIGURACIÓN CENTRALIZADA DE PARKIL ---
const PARKIL_CONFIG = {
  // En true: 1 segundo real = 1 minuto de cobro y 30s de tolerancia de salida (ideal para demostración en vivo)
  // En false: tiempos reales en minutos y 15 min de tolerancia de salida
  MODO_DEMO: true,
  TARIFA_HORA_DEFAULT: 25.00,
  TOLERANCIA_SALIDA_MS: 30000, // 30 seg en demo (900000 ms para 15 min reales)
  ESTACIONAMIENTO_DEFAULT_ID: "parkil_central_campeche",
  SENSORES_MAQUETA: {
    'A1': 'cajon_1', 'A2': 'cajon_2', 'A3': 'cajon_3',
    'B1': 'cajon_4', 'B2': 'cajon_5', 'B3': 'cajon_6'
  },
  SENSORES_INVERSO: {
    'cajon_1': 'A1', 'cajon_2': 'A2', 'cajon_3': 'A3',
    'cajon_4': 'B1', 'cajon_5': 'B2', 'cajon_6': 'B3'
  }
};

// Función para insertar el nuevo logo de Parkil (Auto + Nube + Tope Neón) en cualquier vista
function obtenerLogoParkilSVG(size = 64) {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="14 22 114 68" fill="none">
    <g stroke="#0A84FF" stroke-width="4.75" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M 38.0 66.50 L 25.5 66.50 Q 22.3 66.50 22.3 63.30 L 22.3 56.80 Q 22.3 54.00 25.0 53.46 L 41.35 50.78 L 50.2 38.4 Q 51.0 37.14 52.5 37.14 L 69.8 37.14 Q 71.3 37.14 72.1 38.4 L 80.97 50.78 L 97.2 53.46 Q 99.94 54.0 99.94 56.8 L 99.94 63.30 Q 99.94 66.50 96.74 66.50 L 90.0 66.50" />
      <circle cx="47.12" cy="66.50" r="6.22" fill="none" />
      <path d="M 65.5 72.72 H 79.5 A 4.2 4.2 0 0 0 79.5 64.3 A 5.4 5.4 0 0 0 69.2 62.5 A 4.6 4.6 0 0 0 65.5 72.72 Z" />
    </g>
    <g stroke="#FFE600" stroke-width="4.75" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M 105.5 72.72 L 109.0 65.50 L 117.5 65.50 L 121.0 72.72 Z" />
    </g>
  </svg>`;
}

export {
    db, auth, firestoreDB,
    PARKIL_CONFIG, obtenerLogoParkilSVG,
    ref, onValue, set, update, get, runTransaction,
    signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail,
    doc, setDoc, getDoc, updateDoc, collection, getDocs, addDoc, deleteDoc
};