// js/auth.js
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
console.log(" 1. Archivo auth.js cargado e iniciando...");

const formulario = document.getElementById('formulario-login');
const mensajeError = document.getElementById('mensaje-error');

// Buscamos el botón directamente dentro del formulario para no fallar
const btnSubmit = formulario ? formulario.querySelector('button') : null;

if (formulario) {
    console.log("✅ 2. Formulario detectado correctamente en el HTML.");
    
    formulario.addEventListener('submit', (evento) => {
        // Detenemos la recarga
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

const btnOjito = document.getElementById('btn-ojito-login');
const inputPassword = document.getElementById('password');

if (btnOjito && inputPassword) {
    btnOjito.addEventListener('click', () => {
        if (inputPassword.type === "password") {
            inputPassword.type = "text";
            // Cambia el ícono a un ojo tachado
            btnOjito.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        } else {
            inputPassword.type = "password";
            // Cambia el ícono al ojo normal
            btnOjito.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        }
    });
}

// --- NUEVO: RECUPERAR CONTRASEÑA ---
const linkRecuperar = document.getElementById('link-recuperar');
if (linkRecuperar) {
    linkRecuperar.addEventListener('click', (e) => {
        e.preventDefault(); // Evita que la página salte
        const correoInput = document.getElementById('usuario').value.trim();
        
        if (!correoInput) {
            alert("⚠️ Por favor, escribe tu correo en la casilla de arriba para enviarte el enlace de recuperación.");
            return;
        }

        sendPasswordResetEmail(auth, correoInput)
            .then(() => {
                alert(`✅ ¡Listo! Se ha enviado un correo a ${correoInput} con las instrucciones para crear una nueva contraseña.`);
            })
            .catch((error) => {
                console.error("Error al enviar correo:", error);
                alert("❌ Ocurrió un error. Verifica que tu correo esté bien escrito y registrado.");
            });
    });
}
