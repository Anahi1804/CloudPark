// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
// 1. Agregamos "get" en esta línea
import { getDatabase, ref, onValue, set, update, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB97Nlac70vu_rc_6XqCGPkfMa7rHCjkBk",
  databaseURL: "https://cloudpark-bcc27-default-rtdb.firebaseio.com/",
  projectId: "cloudpark-bcc27"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// 2. Agregamos "get" al final de esta lista para que otros archivos puedan usarlo
export { db, auth, ref, onValue, set, update, get, signInWithEmailAndPassword };
