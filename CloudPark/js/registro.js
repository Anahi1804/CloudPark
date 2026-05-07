// js/registro.js
import { auth, firestoreDB, createUserWithEmailAndPassword, doc, setDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('formulario-registro');
    const mensajeRegistro = document.getElementById('mensaje-registro');
    const btnSubmit = formulario.querySelector('button');

    function mostrarMensaje(mensaje, tipo) {
        mensajeRegistro.textContent = mensaje;
        mensajeRegistro.className = 'mensaje-terminal'; 
        mensajeRegistro.classList.add(tipo);
        mensajeRegistro.classList.remove('oculto');
    }

    formulario.addEventListener('submit', (evento) => {
        evento.preventDefault();

        // 1. Obtener los datos del formulario
        const nombre = document.getElementById('reg-nombre').value.trim();
        const placa = document.getElementById('reg-placa').value.trim().toUpperCase();
        const correo = document.getElementById('reg-correo').value.trim();
        const password = document.getElementById('reg-password').value;

        btnSubmit.textContent = "Creando cuenta...";
        btnSubmit.disabled = true;
        mensajeRegistro.classList.add('oculto');

        // 2. Crear la cuenta de autenticación en Firebase
        createUserWithEmailAndPassword(auth, correo, password)
            .then((credenciales) => {
                const usuarioUID = credenciales.user.uid; // El ID único e irrepetible del usuario

                // 3. Crear su "Expediente" en Firestore usando su UID
                const perfilRef = doc(firestoreDB, "usuarios", usuarioUID);
                
                const datosPerfil = {
                    nombre: nombre,
                    placa: placa,
                    correo: correo,
                    fechaRegistro: new Date().toLocaleString(),
                    rol: "cliente" // Etiqueta para el futuro Panel de Administrador
                };

                // Guardamos en Firestore
                return setDoc(perfilRef, datosPerfil);
            })
            .then(() => {
                // Todo salió perfecto
                mostrarMensaje("¡Cuenta creada con éxito! Ingresando...", "exito");
                
                // Guardamos el correo en local para simular la sesión activa
                localStorage.setItem('usuarioLogueado', correo);
                
                // Redirigimos al Dashboard después de 1.5 segundos
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            })
            .catch((error) => {
                console.error("Error en el registro:", error);
                
                // Manejo de errores comunes
                if (error.code === 'auth/email-already-in-use') {
                    mostrarMensaje("Este correo ya está registrado.", "error");
                } else if (error.code === 'auth/weak-password') {
                    mostrarMensaje("La contraseña debe tener al menos 6 caracteres.", "error");
                } else {
                    mostrarMensaje("Error al crear la cuenta. Intenta de nuevo.", "error");
                }

                btnSubmit.textContent = "Crear Cuenta";
                btnSubmit.disabled = false;
            });
    });
});