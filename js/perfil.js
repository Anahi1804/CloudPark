// js/perfil.js
import { auth, firestoreDB, doc, getDoc, updateDoc, onAuthStateChanged } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const inputNombre = document.getElementById('edit-nombre');
    const inputPlaca = document.getElementById('edit-placa');
    const formPerfil = document.getElementById('form-editar-perfil');
    const btnGuardar = document.getElementById('btn-guardar-perfil');
    const mensajeUI = document.getElementById('mensaje-perfil');

    let usuarioActualUID = null;

    function mostrarMensaje(mensaje, tipo) {
        mensajeUI.textContent = mensaje;
        mensajeUI.className = 'mensaje-terminal'; 
        mensajeUI.classList.add(tipo);
        mensajeUI.classList.remove('oculto');
        setTimeout(() => { mensajeUI.classList.add('oculto'); }, 4000);
    }

    // 1. Cargar los datos del usuario actual
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            usuarioActualUID = user.uid;
            try {
                const docRef = doc(firestoreDB, "usuarios", usuarioActualUID);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const datos = docSnap.data();
                    inputNombre.value = datos.nombre || "";
                    inputPlaca.value = datos.placa || "";
                }
            } catch (error) {
                console.error("Error al cargar perfil:", error);
            }
        } else {
            // Si nadie inició sesión, lo botamos
            window.location.href = '../index.html';
        }
    });

    // 2. Guardar los cambios con validación
    formPerfil.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nuevoNombre = inputNombre.value.trim();
        const nuevaPlaca = inputPlaca.value.trim().toUpperCase();

        // 🛡️ VALIDACIÓN DE PLACA ESTRICTA
        const regexPlaca = /^[A-Z]{3,4}-\d{2,4}$/;
        if (!regexPlaca.test(nuevaPlaca)) {
            mostrarMensaje("Placa inválida. Usa formato real (Ej. YZA-1234)", "error");
            return;
        }

        btnGuardar.textContent = "Guardando en nube...";
        btnGuardar.disabled = true;

        try {
            const docRef = doc(firestoreDB, "usuarios", usuarioActualUID);
            await updateDoc(docRef, {
                nombre: nuevoNombre,
                placa: nuevaPlaca
            });

            // Actualizamos la memoria local para que la App no tenga que recargar
            localStorage.setItem('nombreUsuario', nuevoNombre);
            localStorage.setItem('placaUsuario', nuevaPlaca);

            mostrarMensaje("¡Datos actualizados con éxito!", "exito");
        } catch (error) {
            console.error("Error al actualizar:", error);
            mostrarMensaje("Error al guardar cambios.", "error");
        }

        btnGuardar.textContent = "Guardar Cambios";
        btnGuardar.disabled = false;
    });
});