// js/auth.js
//import { auth } from './firebase-config.js';
//import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

console.log("🔥 1. Archivo auth.js cargado e iniciando...");

const formulario = document.getElementById('formulario-login');
const mensajeError = document.getElementById('mensaje-error');

// Buscamos el botón directamente dentro del formulario para no fallar
const btnSubmit = formulario ? formulario.querySelector('button') : null;

if (formulario) {
    console.log("✅ 2. Formulario detectado correctamente en el HTML.");
    
    formulario.addEventListener('submit', (evento) => {
        // ¡Detenemos la recarga!
        evento.preventDefault(); 
        console.log("🛑 3. Clic detectado. Recarga bloqueada.");

        const usuario = document.getElementById('usuario').value.trim();
        const password = document.getElementById('password').value;

        // Cambiamos el texto del botón
        if (btnSubmit) {
            btnSubmit.textContent = "Verificando en la nube...";
            btnSubmit.disabled = true;
        }
        if (mensajeError) mensajeError.classList.add('oculto');

        console.log(`⏳ 4. Intentando iniciar sesión con: ${usuario}`);

        // Intentamos iniciar sesión con Firebase
        signInWithEmailAndPassword(auth, usuario, password)
            .then((credenciales) => {
                console.log("🎉 5. ¡ÉXITO! Firebase autorizó el acceso.");
                localStorage.setItem('usuarioLogueado', credenciales.user.email);
                
                // IMPORTANTE: Asegúrate de que esta ruta sea correcta para tu proyecto
                window.location.href = 'html/dashboard.html'; 
            })
            .catch((error) => {
                console.error("❌ 5. ACCESO DENEGADO:", error.code, error.message);
                if (mensajeError) mensajeError.classList.remove('oculto');
                if (btnSubmit) {
                    btnSubmit.textContent = "Ingresar al Sistema";
                    btnSubmit.disabled = false;
                }
            });
    });
} else {
    console.error("💀 ERROR FATAL: No se encontró el id 'formulario-login' en tu HTML.");
}
