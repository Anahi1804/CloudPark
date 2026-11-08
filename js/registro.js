// js/registro.js
import { auth, firestoreDB, createUserWithEmailAndPassword, doc, setDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('formulario-registro');
    const mensajeRegistro = document.getElementById('mensaje-registro');
    const btnSubmit = formulario.querySelector('button');

    const inputRol = document.getElementById('reg-rol');
    const wrapperPlaca = document.getElementById('wrapper-placa');
    const inputPlaca = document.getElementById('reg-placa');
    const botonesRol = document.querySelectorAll('.opcion-rol');

    // Selector entre Conductor y Administrador
    botonesRol.forEach(btn => {
        btn.addEventListener('click', () => {
            botonesRol.forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');
            const rolElegido = btn.getAttribute('data-rol');
            inputRol.value = rolElegido;

            if (rolElegido === 'admin') {
                wrapperPlaca.classList.add('oculto');
                inputPlaca.removeAttribute('required');
            } else {
                wrapperPlaca.classList.remove('oculto');
                inputPlaca.setAttribute('required', 'required');
            }
        });
    });

    // Ojito de contraseña
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

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();

        const rol = inputRol.value;
        const nombre = document.getElementById('reg-nombre').value.trim();
        const placa = rol === 'admin' ? 'ADMIN-PRO' : inputPlaca.value.trim().toUpperCase();
        const correo = document.getElementById('reg-correo').value.trim();
        const password = inputPassword.value;

        const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regexCorreo.test(correo)) {
            mostrarMensaje("Por favor, ingresa un correo electrónico válido.", "error");
            return;
        }

        if (rol === 'cliente') {
            const regexPlaca = /^[A-Z]{3,4}-\d{2,4}$/;
            if (!regexPlaca.test(placa)) {
                mostrarMensaje("La placa debe tener formato válido (Ej. YZA-1234 o ABC-123).", "error");
                return;
            }
        }

        btnSubmit.textContent = "Creando cuenta...";
        btnSubmit.disabled = true;
        mensajeRegistro.classList.add('oculto');

        try {
            const credenciales = await createUserWithEmailAndPassword(auth, correo, password);
            const usuarioUID = credenciales.user.uid;

            const datosPerfil = {
                nombre: nombre,
                placa: placa,
                correo: correo,
                fechaRegistro: new Date().toLocaleString(),
                rol: rol
            };

            await setDoc(doc(firestoreDB, "usuarios", usuarioUID), datosPerfil);

            mostrarMensaje("¡Cuenta creada con éxito! Ingresando...", "exito");
            localStorage.setItem('usuarioLogueado', correo);
            localStorage.setItem('nombreUsuario', nombre);
            localStorage.setItem('placaUsuario', placa);
            localStorage.setItem('rolUsuario', rol);

            setTimeout(() => {
                window.location.href = rol === 'admin' ? 'admin.html' : 'dashboard.html';
            }, 1200);
        } catch (error) {
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
        }
    });
});