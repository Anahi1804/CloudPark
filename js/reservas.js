// js/reservas.js
import { db, ref, onValue } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const usuarioLogueado = localStorage.getItem('usuarioLogueado');
    if (!usuarioLogueado) { window.location.href = '../index.html'; return; }

    const btnSalir = document.getElementById('btn-salir');
    if (btnSalir) {
        btnSalir.addEventListener('click', () => {
            localStorage.removeItem('usuarioLogueado');
            window.location.href = '../index.html';
        });
    }

    const cajonesElementos = document.querySelectorAll('.cajon');
    const infoCajon = document.getElementById('info-cajon');
    const btnIrCarrito = document.getElementById('btn-ir-carrito');
    let cajonSeleccionado = null;

    // --- VARIABLES DE LA MÁQUINA DE ESTADOS ---
    let estadoFisico = {}; 
    let infoTickets = {}; // Guardará el estado exacto de cada cajón

    // 1. ESCUCHAR HARDWARE (ESP32)
    const estacionamientoRef = ref(db, 'estacionamiento_actual');
    onValue(estacionamientoRef, (snapshot) => {
        estadoFisico = snapshot.val() || {};
        procesarMapa(); 
    });

    // 2. ESCUCHAR COMPRAS (NUBE)
    const ticketsRef = ref(db, 'tickets_activos');
    onValue(ticketsRef, (snapshot) => {
        const tickets = snapshot.val() || {};
        infoTickets = {}; // Limpiamos la memoria
        for (let id in tickets) {
            infoTickets[tickets[id].cajon] = tickets[id].estado;
        }
        procesarMapa(); 
    });

    // 3. LA LÓGICA DE MATRIZ DE ESTADOS
    function procesarMapa() {
        const equivalencias = {
            'A1': estadoFisico.cajon_1, 'A2': estadoFisico.cajon_2, 'A3': estadoFisico.cajon_3,
            'B1': estadoFisico.cajon_4, 'B2': estadoFisico.cajon_5, 'B3': estadoFisico.cajon_6
        };

        cajonesElementos.forEach(cajon => {
            const numero = cajon.querySelector('.numero-cajon').textContent;
            const estadoSensor = equivalencias[numero]; // "libre" o "ocupado"
            const estadoTicket = infoTickets[numero]; // "reservado", "en_uso", "pagado"...

            cajon.classList.remove('disponible', 'ocupado', 'reservado', 'en-camino', 'seleccionado');

            // 🚀 TU NUEVA MATRIZ DE COLORES:
            if (estadoSensor === 'ocupado') {
                cajon.classList.add('ocupado'); // Rojo para el usuario (siempre)
                if (cajonSeleccionado === numero) resetearSeleccion();
            } else if (estadoTicket === 'en_uso') {
                cajon.classList.add('en-camino'); // Morado (Pasó caseta pero no llega)
                if (cajonSeleccionado === numero) resetearSeleccion();
            } else if (estadoTicket === 'reservado') {
                cajon.classList.add('reservado'); // Amarillo (Comprado sin llegar)
                if (cajonSeleccionado === numero) resetearSeleccion();
            } else {
                cajon.classList.add('disponible'); // Verde (Libre digital y físicamente)
                if (cajonSeleccionado === numero) cajon.classList.add('seleccionado');
            }
        });
    }

    // 4. Lógica de clics
    cajonesElementos.forEach(cajon => {
        cajon.addEventListener('click', () => {
            // No dejar tocar si está ocupado o reservado por alguien más
            if (cajon.classList.contains('ocupado') || cajon.classList.contains('reservado')) return;

            cajonesElementos.forEach(c => c.classList.remove('seleccionado'));
            cajon.classList.add('seleccionado');
            cajonSeleccionado = cajon.querySelector('.numero-cajon').textContent;

            infoCajon.innerHTML = `
                <p class="etiqueta-info">Cajón seleccionado:</p>
                <p class="valor-info cyan-glow">${cajonSeleccionado}</p>
            `;
            btnIrCarrito.disabled = false;
        });
    });

    function resetearSeleccion() {
        cajonSeleccionado = null;
        infoCajon.innerHTML = `<p class="etiqueta-info">Estado actual:</p><p class="valor-info" style="font-size: 1.2rem; color: var(--text-muted);">Esperando selección...</p>`;
        btnIrCarrito.disabled = true;
    }

    if (btnIrCarrito) {
        btnIrCarrito.addEventListener('click', () => {
            if (cajonSeleccionado) {
                localStorage.setItem('cajonTemporal', cajonSeleccionado);
                window.location.href = 'carrito.html';
            }
        });
    }
});