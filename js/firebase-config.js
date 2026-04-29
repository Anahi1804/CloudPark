// js/firebase-config.js
// 1. Importamos las herramientas de Firebase directamente desde los servidores de Google
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
// Si luego usan el login real, importaríamos la autenticación aquí también

// 2. Las llaves de tu proyecto CloudPark
const firebaseConfig = {
  apiKey: "AIzaSyB97Nlac70vu_rc_6XqCGPkfMa7rHCjkBk",
  databaseURL: "https://cloudpark-bcc27-default-rtdb.firebaseio.com/",
  projectId: "cloudpark-bcc27" 
};

// 3. Inicializamos la conexión
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 4. Exportamos la base de datos para que los otros archivos (.js) puedan usarla
export { db, ref, onValue, set, update };