// js/registro.js
import { auth, firestoreDB, createUserWithEmailAndPassword, doc, setDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('formulario-registro');
    const mensajeRegistro = document.getElementById('mensaje-registro');
    const btnSubmit = formulario.querySelector('button');

    // --- LÓGICA DEL OJITO (Exclusivo Registro) ---
    const btnOjito = document.getElementById('btn-ojito-registro');
    const inputPassword = document.getElementById('reg-password');

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
        const password = inputPassword.value; 

        // --- VALIDACIONES ESTRICTAS ---
        const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regexCorreo.test(correo)) {
            mostrarMensaje("Por favor, ingresa un correo electrónico válido.", "error");
            return; // Detiene el código si está mal
        }

        const regexPlaca = /^[A-Z]{3,4}-\d{2,4}$/;
        if (!regexPlaca.test(placa)) {
            mostrarMensaje("La placa debe tener formato real (Ej. ABC-1234 o YZA-123)", "error");
            return; // Detiene el código si está mal
        }
        // ---------------------------------

        btnSubmit.textContent = "Creando cuenta...";
        btnSubmit.disabled = true;
        mensajeRegistro.classList.add('oculto');

        // 2. Crear la cuenta de autenticación en Firebase
        createUserWithEmailAndPassword(auth, correo, password)
            .then((credenciales) => {
                const usuarioUID = credenciales.user.uid; 

                // 3. Crear su "Expediente" en Firestore
                const perfilRef = doc(firestoreDB, "usuarios", usuarioUID);
                
                const datosPerfil = {
                    nombre: nombre,
                    placa: placa,
                    correo: correo,
                    fechaRegistro: new Date().toLocaleString(),
                    rol: "cliente" 
                };

                return setDoc(perfilRef, datosPerfil);
            })
            .then(() => {
                mostrarMensaje("¡Cuenta creada con éxito! Ingresando...", "exito");
                localStorage.setItem('usuarioLogueado', correo);
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            })
            .catch((error) => {
                console.error("Error en el registro:", error);
                
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