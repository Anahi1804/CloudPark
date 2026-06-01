// js/dashboard.js
// Importamos también 'db', 'ref' y 'get' para que el dashboard pueda espiar a Firebase
import { auth, firestoreDB, doc, getDoc, onAuthStateChanged, signOut, db, ref, get } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const nombreUsuario = document.getElementById('nombre-usuario');
    const placaUsuario = document.getElementById('placa-usuario');
    const btnSalir = document.getElementById('btn-salir');
    const tarjetaTicket = document.getElementById('tarjeta-ticket');

    // 1. Escuchar sesión
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const docRef = doc(firestoreDB, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const datosUsuario = docSnap.data();
                nombreUsuario.textContent = datosUsuario.nombre;
                if (placaUsuario) placaUsuario.textContent = datosUsuario.placa;
                localStorage.setItem('nombreUsuario', datosUsuario.nombre);
                localStorage.setItem('placaUsuario', datosUsuario.placa);
            }
        } else {
            window.location.href = '../index.html';
        }
    });

    btnSalir.addEventListener('click', () => {
        signOut(auth).then(() => {
            localStorage.removeItem('usuarioLogueado');
            localStorage.removeItem('ticketActual');
            window.location.href = '../index.html';
        });
    });

    // 2. MAGIA ANTI-BUGS: Revisar si el ticket sigue vivo en la base de datos
    const ticketLocalString = localStorage.getItem('ticketActual');
    
    if (!ticketLocalString) {
        mostrarSinReservas();
    } else {
        const ticketLocal = JSON.parse(ticketLocalString);
        
        // Vamos a la Realtime Database a preguntar si el código todavía existe
        get(ref(db, 'tickets_activos/' + ticketLocal.codigo)).then((snapshot) => {
            if (!snapshot.exists()) {
                // Si el Súper Admin o el Recolector de Basura lo eliminaron, lo borramos del celular
                console.log("El ticket expiró o fue forzado. Limpiando caché...");
                localStorage.removeItem('ticketActual');
                mostrarSinReservas();
            } else {
                // Sigue vivo, le dejamos el botón activado
                tarjetaTicket.classList.remove('deshabilitada');
                tarjetaTicket.querySelector('.texto-secundario').textContent = "Ver Ticket";
            }
        });
    }

    function mostrarSinReservas() {
        tarjetaTicket.classList.add('deshabilitada');
        tarjetaTicket.querySelector('.texto-secundario').textContent = "Sin reservas";
        tarjetaTicket.removeAttribute('href'); // Desactiva el clic
    }
});