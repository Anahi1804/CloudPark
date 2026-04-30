// js/dashboard.js
import { auth, firestoreDB, doc, getDoc, onAuthStateChanged, signOut } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const nombreUsuario = document.getElementById('nombre-usuario');
    const btnSalir = document.getElementById('btn-salir');
    const tarjetaTicket = document.getElementById('tarjeta-ticket');

    // 1. Escuchar el estado de seguridad de Firebase en tiempo real
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // ¡El usuario es legítimo! Vamos a buscar su expediente a Firestore
            const docRef = doc(firestoreDB, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const datosUsuario = docSnap.data();
                // Ponemos su nombre real en la pantalla
                nombreUsuario.textContent = datosUsuario.nombre;
                
                // Opcional: Guardamos su correo en local solo por si otros scripts viejos lo necesitan temporalmente
                localStorage.setItem('usuarioLogueado', datosUsuario.correo);
            }
        } else {
            // Si no hay sesión válida, lo regresamos al login por seguridad
            window.location.href = '../index.html';
        }
    });

    // 2. Cerrar sesión de verdad en la nube
    btnSalir.addEventListener('click', () => {
        signOut(auth).then(() => {
            localStorage.removeItem('usuarioLogueado');
            window.location.href = '../index.html';
        });
    });

    // 3. Revisar si tiene un ticket activo (Esto se conectará a Firestore más adelante)
    const ticketActual = localStorage.getItem('ticketActual');
    if (!ticketActual) {
        tarjetaTicket.classList.add('deshabilitada');
        tarjetaTicket.querySelector('.texto-secundario').textContent = "Sin reservas";
    } else {
        tarjetaTicket.classList.remove('deshabilitada');
        tarjetaTicket.querySelector('.texto-secundario').textContent = "Ver Ticket";
    }
});