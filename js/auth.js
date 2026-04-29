// js/auth.js
// 1. Importamos la conexión (Esto mantiene a Firebase despierto)
import { auth } from './firebase-config.js';

// 2. Esperamos a que el HTML cargue por completo
document.addEventListener('DOMContentLoaded', () => {
    
    console.log("🚀 El archivo auth.js está vivo y conectado a Firebase!");
    
    const formulario = document.getElementById('formulario-login');
    const mensajeError = document.getElementById('mensaje-error');

    // 3. Controlamos el botón de Ingresar
    if (formulario) {
        formulario.addEventListener('submit', (evento) => {
            // ¡ESTO ES VITAL! Detiene la recarga automática de la página
            evento.preventDefault(); 

            const usuario = document.getElementById('usuario').value;
            const password = document.getElementById('password').value;

            // Validación temporal (luego pondremos la de Firebase real)
            if (usuario !== '' && password === '1234') {
                
                // Guardamos la sesión
                localStorage.setItem('usuarioLogueado', usuario);
                
                // Redirigimos al dashboard (Asegúrate de que tu carpeta se llame 'html' en minúsculas en Vercel)
                window.location.href = 'html/dashboard.html';
                
            } else {
                // Si la contraseña está mal, mostramos el error
                mensajeError.classList.remove('oculto');
            }
        });
    }
});
