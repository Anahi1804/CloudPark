// js/auth.js
// 1. Importamos tu conexión y la función mágica de login de Firebase
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('formulario-login');
    const mensajeError = document.getElementById('mensaje-error');
    const btnSubmit = document.querySelector('.btn-neon'); // Atrapamos el botón

    if (formulario) {
        formulario.addEventListener('submit', (evento) => {
            // Detenemos la recarga de la página
            evento.preventDefault(); 

            // Obtenemos lo que el usuario escribió
            const usuario = document.getElementById('usuario').value.trim();
            const password = document.getElementById('password').value;

            // Efecto visual: Deshabilitamos el botón mientras Firebase procesa
            btnSubmit.textContent = "Verificando en la nube...";
            btnSubmit.disabled = true;
            mensajeError.classList.add('oculto'); // Escondemos errores previos

            // 2. LA MAGIA: Intentamos iniciar sesión con Firebase
            signInWithEmailAndPassword(auth, usuario, password)
                .then((credenciales) => {
                    // ¡ÉXITO! Firebase confirmó que el usuario y la contraseña coinciden
                    const usuarioConfirmado = credenciales.user.email;
                    
                    // Guardamos el correo en el navegador para que el dashboard sepa quién entró
                    localStorage.setItem('usuarioLogueado', usuarioConfirmado);
                    
                    // Redirigimos al sistema
                    window.location.href = 'html/dashboard.html';
                })
                .catch((error) => {
                    // ERROR: Contraseña mal, usuario no existe, o no hay internet
                    console.error("Acceso denegado por Firebase:", error.code);
                    
                    // Mostramos el mensaje de error de David
                    mensajeError.classList.remove('oculto');
                    
                    // Volvemos a prender el botón para que intente de nuevo
                    btnSubmit.textContent = "Ingresar al Sistema";
                    btnSubmit.disabled = false;
                });
        });
    }
});