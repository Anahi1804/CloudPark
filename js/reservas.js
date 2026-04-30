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
    let estadoFisico = {}; // Lo que dice el hardware
    let cajonesReservados = []; // Lo que dicen los tickets

    // 1. ESCUCHAR HARDWARE (ESP32)
    const estacionamientoRef = ref(db, 'estacionamiento_actual');
    onValue(estacionamientoRef, (snapshot) => {
        estadoFisico = snapshot.val() || {};
        procesarMapa(); // Recalcular mapa
    });

    // 2. ESCUCHAR COMPRAS (NUBE)
    const ticketsRef = ref(db, 'tickets_activos');
    onValue(ticketsRef, (snapshot) => {
        const tickets = snapshot.val() || {};
        // Filtramos solo los cajones que tienen un ticket en estado "reservado"
        cajonesReservados = Object.values(tickets)
            .filter(ticket => ticket.estado === "reservado")
            .map(ticket => ticket.cajon);
            
        procesarMapa(); // Recalcular mapa
    });

    // 3. LA LÓGICA DE NEGOCIO (Cruzando datos)
    function procesarMapa() {
        // Mapeamos los nombres del ESP32 con la web
        const equivalencias = {
            'A1': estadoFisico.cajon_1, 'A2': estadoFisico.cajon_2, 'A3': estadoFisico.cajon_3,
            'B1': estadoFisico.cajon_4, 'B2': estadoFisico.cajon_5, 'B3': estadoFisico.cajon_6
        };

        cajonesElementos.forEach(cajon => {
            const numero = cajon.querySelector('.numero-cajon').textContent;
            const estadoSensor = equivalencias[numero]; // "libre" u "ocupado"
            const tieneReservaActiva = cajonesReservados.includes(numero);

            // Limpiamos colores
            cajon.classList.remove('disponible', 'ocupado', 'reservado', 'seleccionado');

            // MÁQUINA DE ESTADOS:
            if (estadoSensor === 'ocupado') {
                // ESTADO 3: Físicamente ocupado (Rojo) - ¡Vence a cualquier reserva!
                cajon.classList.add('ocupado');
                if (cajonSeleccionado === numero) resetearSeleccion();

            } else if (tieneReservaActiva) {
                // ESTADO 2: Vacío físicamente, pero alguien ya lo pagó (Naranja)
                cajon.classList.add('reservado');
                if (cajonSeleccionado === numero) resetearSeleccion();

            } else {
                // ESTADO 1: Libre de todo (Verde)
                cajon.classList.add('disponible');
                // Si estaba seleccionado por el usuario actual, se lo respetamos
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