// js/reservas.js - Renderizado Multi-Piso Dinámico y Sensores Híbridos (ESP32 + Virtuales)
import { db, ref, onValue, PARKIL_CONFIG } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const usuarioLogueado = localStorage.getItem('usuarioLogueado');
    if (!usuarioLogueado) { window.location.href = '../index.html'; return; }

    document.getElementById('btn-salir')?.addEventListener('click', () => {
        localStorage.removeItem('usuarioLogueado');
        window.location.href = '../index.html';
    });

    const contenedorCajones = document.getElementById('contenedor-cajones');
    const selectorPisosUI = document.getElementById('selector-pisos-user');
    const infoCajon = document.getElementById('info-cajon');
    const btnIrCarrito = document.getElementById('btn-ir-carrito');

    const sedeId = localStorage.getItem('estacionamientoSeleccionadoId') || PARKIL_CONFIG.ESTACIONAMIENTO_DEFAULT_ID;
    let pisoActual = 1;
    let cajonSeleccionado = null;
    let sensorFisicoSeleccionado = "";

    let estadoFisicoESP32 = {};
    let sensoresVirtuales = JSON.parse(localStorage.getItem('parkil_sensores_virtuales') || '{}');
    let infoTickets = {};

    // Plantilla de respaldo si aún no se ha abierto el Admin en este navegador
    const pisoRespaldo = {
        columnas: 5,
        filas: 4,
        celdas: [
            { tipo: "entrada", etiqueta: "ENTRADA" },
            { tipo: "calle", etiqueta: "→" },
            { tipo: "calle", etiqueta: "→" },
            { tipo: "elevador", etiqueta: "ELEVADOR" },
            { tipo: "escalera", etiqueta: "ESCALERA" },
            { tipo: "cajon", codigo: "A1", sensorFisico: "cajon_1" },
            { tipo: "cajon", codigo: "A2", sensorFisico: "cajon_2" },
            { tipo: "cajon", codigo: "A3", sensorFisico: "cajon_3" },
            { tipo: "discapacitado", codigo: "E1", sensorFisico: "" },
            { tipo: "calle", etiqueta: "↓" },
            { tipo: "cajon", codigo: "B1", sensorFisico: "cajon_4" },
            { tipo: "cajon", codigo: "B2", sensorFisico: "cajon_5" },
            { tipo: "cajon", codigo: "B3", sensorFisico: "cajon_6" },
            { tipo: "discapacitado", codigo: "E2", sensorFisico: "" },
            { tipo: "calle", etiqueta: "↓" },
            { tipo: "calle", etiqueta: "←" },
            { tipo: "calle", etiqueta: "←" },
            { tipo: "calle", etiqueta: "←" },
            { tipo: "calle", etiqueta: "←" },
            { tipo: "salida", etiqueta: "SALIDA" }
        ]
    };

    let catalogoSedes = JSON.parse(localStorage.getItem('parkil_catalogo_sedes') || '{}');
    let sedeActual = catalogoSedes[sedeId] || {
        id: sedeId,
        nombre: localStorage.getItem('estacionamientoSeleccionadoNombre') || "Parkil Centro Histórico",
        tarifaHora: Number(localStorage.getItem('tarifaHoraSeleccionada')) || 25,
        niveles: 2,
        pisos: { "1": pisoRespaldo, "2": pisoRespaldo }
    };

    document.getElementById('nombre-sede-header').textContent = sedeActual.nombre;

    function renderizarBotonesPisos() {
        selectorPisosUI.innerHTML = '';
        const niveles = Number(sedeActual.niveles) || 1;
        for (let p = 1; p <= niveles; p++) {
            const btn = document.createElement('button');
            btn.className = `btn-piso-user ${p === pisoActual ? 'activo' : ''}`;
            btn.textContent = `Nivel ${p}`;
            btn.addEventListener('click', () => {
                pisoActual = p;
                resetearSeleccion();
                renderizarBotonesPisos();
                dibujarPlano();
            });
            selectorPisosUI.appendChild(btn);
        }
    }

function obtenerEstadoSensor(celda, sensorAutoAsignado = '') {
        const sensorHw = celda.sensorFisico || sensorAutoAsignado || PARKIL_CONFIG.SENSORES_MAQUETA[celda.codigo];
        if (sensorHw && estadoFisicoESP32 && estadoFisicoESP32[sensorHw] !== undefined) {
            return String(estadoFisicoESP32[sensorHw]).trim().toLowerCase();
        }
        const virtSede = sensoresVirtuales[sedeActual.id] || {};
        return String(virtSede[celda.codigo] || 'libre').trim().toLowerCase();
    }

    function dibujarPlano() {
        const datosPiso = (sedeActual.pisos && sedeActual.pisos[String(pisoActual)]) || pisoRespaldo;
        contenedorCajones.style.gridTemplateColumns = `repeat(${datosPiso.columnas || 3}, 1fr)`;
        contenedorCajones.innerHTML = '';

        let contadorSensorMaqueta = 1;

        datosPiso.celdas.forEach(celda => {
            if (celda.tipo === 'vacio') {
                const vacio = document.createElement('div');
                contenedorCajones.appendChild(vacio);
                return;
            }
            if (celda.tipo === 'calle') {
                const calle = document.createElement('div');
                calle.className = 'celda-calle';
                calle.textContent = celda.etiqueta || '🛣️';
                contenedorCajones.appendChild(calle);
                return;
            }
            if (celda.tipo === 'elevador' || celda.tipo === 'escalera' || celda.tipo === 'entrada' || celda.tipo === 'salida') {
                const iconos = {
                    elevador: '🛗<br>ELEVADOR',
                    escalera: '🪜<br>ESCALERA',
                    entrada: '🚧<br>ENTRADA',
                    salida: '🏁<br>SALIDA'
                };
                const poi = document.createElement('div');
                poi.className = 'celda-poi';
                poi.innerHTML = iconos[celda.tipo];
                contenedorCajones.appendChild(poi);
                return;
            }

            let sensorAuto = '';
            if (pisoActual === 1 && contadorSensorMaqueta <= 6) {
                sensorAuto = `cajon_${contadorSensorMaqueta}`;
                contadorSensorMaqueta++;
            }

            const sensorVinculado = celda.sensorFisico || PARKIL_CONFIG.SENSORES_MAQUETA[celda.codigo] || sensorAuto;
            const numero = celda.codigo;
            const estadoSensor = obtenerEstadoSensor(celda, sensorVinculado);
            const estadoTicket = infoTickets[numero];
            const esDisc = celda.tipo === 'discapacitado';

            const divCajon = document.createElement('div');
            divCajon.className = 'cajon';
            divCajon.style.fontSize = datosPiso.columnas >= 5 ? '1rem' : '1.3rem';

            if (estadoSensor === 'ocupado') {
                divCajon.classList.add('ocupado');
                if (cajonSeleccionado === numero) resetearSeleccion();
            } else if (estadoTicket === 'en_uso' || estadoTicket === 'multado' || estadoTicket === 'pagado') {
                divCajon.classList.add('en-camino');
                if (cajonSeleccionado === numero) resetearSeleccion();
            } else if (estadoTicket === 'reservado') {
                divCajon.classList.add('reservado');
                if (cajonSeleccionado === numero) resetearSeleccion();
            } else {
                divCajon.classList.add('disponible');
                if (esDisc) divCajon.classList.add('discapacitado-libre');
                if (cajonSeleccionado === numero) divCajon.classList.add('seleccionado');
            }

            divCajon.innerHTML = `<span class="numero-cajon">${esDisc ? '♿ ' : ''}${numero}</span>`;

            divCajon.addEventListener('click', () => {
                if (divCajon.classList.contains('ocupado') ||
                    divCajon.classList.contains('reservado') ||
                    divCajon.classList.contains('en-camino')) {
                    return;
                }
                cajonSeleccionado = numero;
                sensorFisicoSeleccionado = sensorVinculado;
                dibujarPlano();

                infoCajon.innerHTML = `
                    <p class="etiqueta-info">${esDisc ? '♿ Cajón Preferente Seleccionado:' : '🚗 Cajón Seleccionado:'}</p>
                    <p class="valor-info cyan-glow">${numero}</p>
                    <small style="color: var(--text-muted); display:block; margin-top:4px;">Nivel ${pisoActual} • Tarifa: $${sedeActual.tarifaHora || 25}/hr</small>
                `;
                btnIrCarrito.disabled = false;
            });

            contenedorCajones.appendChild(divCajon);
        });
    }
    function resetearSeleccion() {
        cajonSeleccionado = null;
        sensorFisicoSeleccionado = "";
        infoCajon.innerHTML = `<p class="etiqueta-info">Estado actual:</p><p class="valor-info" style="font-size: 1.15rem; color: var(--text-muted);">Toca un cajón disponible...</p>`;
        btnIrCarrito.disabled = true;
    }

    renderizarBotonesPisos();
    dibujarPlano();

    // Escuchar Hardware real ESP32


    // Escuchar Sensores Virtuales


    // Escuchar planos actualizados por el Admin
    onValue(ref(db, `estacionamientos_red/${sedeId}`), (snapshot) => {
        if (snapshot.exists()) {
            sedeActual = snapshot.val();
            document.getElementById('nombre-sede-header').textContent = sedeActual.nombre;
            renderizarBotonesPisos();
            dibujarPlano();
        }
    });

    // Escuchar tickets activos
    onValue(ref(db, 'tickets_activos'), (snapshot) => {
        const tickets = snapshot.val() || {};
        infoTickets = {};
        for (let id in tickets) {
            const t = tickets[id];
            if (!t.estacionamientoId || t.estacionamientoId === sedeActual.id) {
                infoTickets[t.cajon] = t.estado;
            }
        }
        dibujarPlano();
    });

    btnIrCarrito?.addEventListener('click', () => {
        if (cajonSeleccionado) {
            localStorage.setItem('cajonTemporal', cajonSeleccionado);
            localStorage.setItem('sensorFisicoTemporal', sensorFisicoSeleccionado);
            localStorage.setItem('pisoTemporal', String(pisoActual));
            localStorage.setItem('estacionamientoSeleccionadoId', sedeActual.id);
            localStorage.setItem('estacionamientoSeleccionadoNombre', sedeActual.nombre);
            localStorage.setItem('tarifaHoraSeleccionada', String(sedeActual.tarifaHora || 25));
            window.location.href = 'carrito.html';
        }
    });
});