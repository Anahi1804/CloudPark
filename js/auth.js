// js/auth.js
import { auth, firestoreDB, signInWithEmailAndPassword, sendPasswordResetEmail, doc, getDoc } from './firebase-config.js';

const formulario = document.getElementById('formulario-login');
const mensajeError = document.getElementById('mensaje-error');
const btnSubmit = formulario ? formulario.querySelector('button') : null;

if (formulario) {
    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();

        const usuario = document.getElementById('usuario').value.trim();
        const password = document.getElementById('password').value;

        if (btnSubmit) {
            btnSubmit.textContent = "Verificando en la nube...";
            btnSubmit.disabled = true;
        }
        if (mensajeError) mensajeError.classList.add('oculto');

        try {
            const credenciales = await signInWithEmailAndPassword(auth, usuario, password);
            const uid = credenciales.user.uid;
            localStorage.setItem('usuarioLogueado', credenciales.user.email);

            // Consultamos el expediente del usuario para saber si es Conductor o Administrador
            const docSnap = await getDoc(doc(firestoreDB, "usuarios", uid));
            if (docSnap.exists()) {
                const datos = docSnap.data();
                localStorage.setItem('nombreUsuario', datos.nombre || "Usuario");
                localStorage.setItem('placaUsuario', datos.placa || "S/N");
                localStorage.setItem('rolUsuario', datos.rol || "cliente");

                if (datos.rol === "admin") {
                    window.location.href = 'html/admin.html';
                    return;
                }
            }

            window.location.href = 'html/dashboard.html';
        } catch (error) {
            console.error("Acceso denegado:", error.code, error.message);
            if (mensajeError) mensajeError.classList.remove('oculto');
            if (btnSubmit) {
                btnSubmit.textContent = "Ingresar al Sistema";
                btnSubmit.disabled = false;
            }
        }
    });
}

// Mostrar / ocultar contraseña
const btnOjito = document.getElementById('btn-ojito-login');
const inputPassword = document.getElementById('password');

if (btnOjito && inputPassword) {
    btnOjito.addEventListener('click', () => {
        if (inputPassword.type === "password") {
            inputPassword.type = "text";
            btnOjito.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        } else {
            inputPassword.type = "password";
            btnOjito.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        }
    });
}

// Recuperar contraseña
const linkRecuperar = document.getElementById('link-recuperar');
if (linkRecuperar) {
    linkRecuperar.addEventListener('click', (e) => {
        e.preventDefault();
        const correoInput = document.getElementById('usuario').value.trim();

        if (!correoInput) {
            alert("Por favor, escribe tu correo en la casilla de arriba para enviarte el enlace de recuperación.");
            return;
        }

        sendPasswordResetEmail(auth, correoInput)
            .then(() => {
                alert(`¡Listo! Se ha enviado un correo a ${correoInput} con las instrucciones para restablecer tu contraseña.`);
            })
            .catch((error) => {
                console.error("Error al enviar correo:", error);
                alert("Ocurrió un error. Verifica que tu correo esté bien escrito y registrado.");
            });
    });
}