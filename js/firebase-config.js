// js/firebase-config.js
// Importamos Firebase directamente desde los servidores de Google (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// Tus llaves de oro (¡Intactas!)
const firebaseConfig = {
    apiKey: "AIzaSyB97Nlac70vu_rc_6XqCGPkfMa7rHCjkBk",
    authDomain: "cloudpark-bcc27.firebaseapp.com",
    projectId: "cloudpark-bcc27",
    storageBucket: "cloudpark-bcc27.firebasestorage.app",
    messagingSenderId: "191406001807",
    appId: "1:191406001807:web:6707805a5ac1c409d16afa",
    measurementId: "G-N4L9ECTCD0"
};

// Inicializamos CloudPark
const app = initializeApp(firebaseConfig);

// Exportamos la Autenticación (Login) y la Base de Datos para usarlas en otros archivos
export const auth = getAuth(app);
export const db = getFirestore(app);