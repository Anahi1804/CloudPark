// js/admin.js - Suite Administrativa, Mapa Libre de API Key y Constructor 2D con Carga Instantánea
import {
    auth, firestoreDB, db, PARKIL_CONFIG, obtenerLogoParkilSVG,
    onAuthStateChanged, signOut, collection, getDocs,
    ref, onValue, set, doc, setDoc, update
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Insertar el nuevo logo en el header
    const logoContainer = document.getElementById('logo-header-admin');
    if (logoContainer) logoContainer.innerHTML = obtenerLogoParkilSVG(48);

    onAuthStateChanged(auth, (user) => {
        if (!user) window.location.href = '../index.html';
    });

    const btnCerrarSesion = document.getElementById('btn-cerrar-sesion-admin');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = '../index.html');
        });
    }

    // --- NOTIFICACIONES TOAST ---
    function showToast(mensaje, tipo = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        const iconos = { success: '✅', error: '⚠️', info: '📡' };
        const toast = document.createElement('div');
        toast.className = `toast ${tipo}`;
        toast.innerHTML = `<span>${iconos[tipo] || 'ℹ️'}</span> <span>${mensaje}</span>`;
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3800);
    }

    // --- PLANTILLAS INICIALES (Maqueta 2 Pisos + Sucursal Galerías) ---
    function crearEstacionamientoPorDefecto() {
        return {
            id: PARKIL_CONFIG.ESTACIONAMIENTO_DEFAULT_ID,
            nombre: "Parkil Matriz Centro Histórico (Maqueta IoT)",
            direccion: "Calle 10 #245, Centro Histórico, San Francisco de Campeche",
            tarifaHora: 25,
            niveles: 2,
            lat: 19.845400,
            lng: -90.535800,
            pisos: {
                "1": {
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
                },
                "2": {
                    columnas: 5,
                    filas: 4,
                    celdas: [
                        { tipo: "calle", etiqueta: "RAMPA ↑" },
                        { tipo: "calle", etiqueta: "→" },
                        { tipo: "calle", etiqueta: "→" },
                        { tipo: "elevador", etiqueta: "ELEVADOR" },
                        { tipo: "escalera", etiqueta: "ESCALERA" },

                        { tipo: "cajon", codigo: "C1", sensorFisico: "" },
                        { tipo: "cajon", codigo: "C2", sensorFisico: "" },
                        { tipo: "cajon", codigo: "C3", sensorFisico: "" },
                        { tipo: "discapacitado", codigo: "C4", sensorFisico: "" },
                        { tipo: "calle", etiqueta: "↓" },

                        { tipo: "cajon", codigo: "D1", sensorFisico: "" },
                        { tipo: "cajon", codigo: "D2", sensorFisico: "" },
                        { tipo: "cajon", codigo: "D3", sensorFisico: "" },
                        { tipo: "cajon", codigo: "D4", sensorFisico: "" },
                        { tipo: "calle", etiqueta: "↓" },

                        { tipo: "calle", etiqueta: "←" },
                        { tipo: "calle", etiqueta: "←" },
                        { tipo: "calle", etiqueta: "←" },
                        { tipo: "calle", etiqueta: "←" },
                        { tipo: "calle", etiqueta: "RAMPA ↓" }
                    ]
                }
            }
        };
    }

    function obtenerCatalogoInicial() {
        try {
            const guardado = localStorage.getItem('parkil_catalogo_sedes');
            if (guardado) {
                const parsed = JSON.parse(guardado);
                if (parsed && Object.keys(parsed).length > 0) return parsed;
            }
        } catch (e) {
            console.warn("Cargando catálogo por defecto...");
        }

        const sede1 = crearEstacionamientoPorDefecto();
        const sede2 = {
            id: "parkil_galerias_campeche",
            nombre: "Parkil Plaza Galerías Ah-Kim-Pech",
            direccion: "Av. Pedro Sainz de Baranda, Ah-Kim-Pech, Campeche",
            tarifaHora: 30,
            niveles: 2,
            lat: 19.852800,
            lng: -90.529500,
            pisos: JSON.parse(JSON.stringify(sede1.pisos))
        };
        Object.values(sede2.pisos).forEach(p => p.celdas.forEach(c => c.sensorFisico = ""));

        const inicial = {
            [sede1.id]: sede1,
            [sede2.id]: sede2
        };
        localStorage.setItem('parkil_catalogo_sedes', JSON.stringify(inicial));
        return inicial;
    }

    // --- ESTADO GLOBAL INICIALIZADO AL INSTANTE ---
    let catalogoEstacionamientos = obtenerCatalogoInicial();
    let estacionamientoActivoId = localStorage.getItem('adminEstacionamientoId') || PARKIL_CONFIG.ESTACIONAMIENTO_DEFAULT_ID;
    if (!catalogoEstacionamientos[estacionamientoActivoId]) {
        estacionamientoActivoId = Object.keys(catalogoEstacionamientos)[0];
    }

    let pisoMonitorActual = 1;
    let pisoBuilderActual = 1;
    let herramientaActual = 'cajon';
    let celdaEditandoIndex = null;

    let adminTicketsActivos = {};
    let adminEstadoFisico = {};
    let adminSensoresVirtuales = JSON.parse(localStorage.getItem('parkil_sensores_virtuales') || '{}');
    let historialGlobal = [];
    let chartInstancia = null;
    let mapaLeaflet = null;
    let marcadorLeaflet = null;

    function guardarCatalogoEnNubeYLocal() {
        localStorage.setItem('parkil_catalogo_sedes', JSON.stringify(catalogoEstacionamientos));
        set(ref(db, 'estacionamientos_red'), catalogoEstacionamientos).catch(() => {
            console.log("Guardado localmente (modo sin permisos de escritura en rama nueva de RTDB).");
        });
    }

    // --- NAVEGACIÓN DE PESTAÑAS (TABS) ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('oculto'));

            btn.classList.add('activo');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.remove('oculto');

            if (targetId === 'tab-alta-mapa') {
                setTimeout(() => inicializarMapaLeaflet(), 150);
            }
            if (targetId === 'tab-constructor') {
                renderizarConstructor();
            }
        });
    });

    // --- SELECTOR DE SEDES ---
    const selectorSede = document.getElementById('selector-estacionamiento-activo');
    function actualizarSelectorSedes() {
        if (!selectorSede) return;
        selectorSede.innerHTML = '';
        Object.values(catalogoEstacionamientos).forEach(est => {
            const opt = document.createElement('option');
            opt.value = est.id;
            opt.textContent = `🏢 ${est.nombre}`;
            if (est.id === estacionamientoActivoId) opt.selected = true;
            selectorSede.appendChild(opt);
        });
        const actual = catalogoEstacionamientos[estacionamientoActivoId];
        if (actual) {
            document.getElementById('subtitulo-sede').textContent =
                `${actual.nombre} • $${actual.tarifaHora}/hr • ${actual.niveles} Nivel(es)`;
        }
    }

    selectorSede.addEventListener('change', () => {
        estacionamientoActivoId = selectorSede.value;
        localStorage.setItem('adminEstacionamientoId', estacionamientoActivoId);
        pisoMonitorActual = 1;
        pisoBuilderActual = 1;
        actualizarSelectorSedes();
        cargarFormularioSedeActiva();
        renderizarPillsMonitor();
        dibujarMapaAdmin();
        renderizarConstructor();
        if (mapaLeaflet) inicializarMapaLeaflet();
        showToast("Cambiaste de estacionamiento activo", "info");
    });

    // --- PESTAÑA 1: MONITOR EN TIEMPO REAL ---
    function renderizarPillsMonitor() {
        const contenedor = document.getElementById('pisos-monitor-tabs');
        const sede = catalogoEstacionamientos[estacionamientoActivoId];
        if (!contenedor || !sede) return;

        contenedor.innerHTML = '';
        const totalNiveles = Number(sede.niveles) || 1;
        for (let p = 1; p <= totalNiveles; p++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `piso-pill ${p === pisoMonitorActual ? 'activo' : ''}`;
            btn.textContent = `Piso ${p}`;
            btn.addEventListener('click', () => {
                pisoMonitorActual = p;
                renderizarPillsMonitor();
                dibujarMapaAdmin();
            });
            contenedor.appendChild(btn);
        }
    }

    function obtenerEstadoSensorCajon(celda) {
        if (celda.sensorFisico) {
            return String(adminEstadoFisico[celda.sensorFisico] || 'libre').trim().toLowerCase();
        }
        const virtSede = adminSensoresVirtuales[estacionamientoActivoId] || {};
        return String(virtSede[celda.codigo] || 'libre').trim().toLowerCase();
    }

    function dibujarMapaAdmin() {
        const mapaContainer = document.getElementById('admin-mapa-container');
        const sede = catalogoEstacionamientos[estacionamientoActivoId];
        if (!mapaContainer || !sede || !sede.pisos) return;

        const datosPiso = sede.pisos[String(pisoMonitorActual)] || sede.pisos["1"];
        if (!datosPiso) return;

        const infoPorCajon = {};
        for (let id in adminTicketsActivos) {
            const t = adminTicketsActivos[id];
            const coincideSede = !t.estacionamientoId || t.estacionamientoId === estacionamientoActivoId;
            if (coincideSede) {
                infoPorCajon[t.cajon] = { id, ...t };
            }
        }

        let html = `<div style="display: grid; grid-template-columns: repeat(${datosPiso.columnas}, minmax(72px, 1fr)); gap: 10px;">`;

        datosPiso.celdas.forEach((celda) => {
            if (celda.tipo === 'vacio') {
                html += `<div style="min-height: 68px; border-radius: 8px; background: transparent;"></div>`;
                return;
            }
            if (celda.tipo === 'calle') {
                html += `<div style="min-height: 68px; border-radius: 8px; background: #0d0d10; border: 1px dashed rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; color:#71717a; font-size:0.8rem;">🛣️ ${celda.etiqueta || ''}</div>`;
                return;
            }
            if (celda.tipo === 'elevador' || celda.tipo === 'escalera' || celda.tipo === 'entrada' || celda.tipo === 'salida') {
                const iconos = { elevador: '🛗 ELEVADOR', escalera: '🪜 ESCALERA', entrada: '🚧 ENTRADA', salida: '🏁 SALIDA' };
                html += `<div style="min-height: 68px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:800; color:#e4e4e7; padding:4px;">${iconos[celda.tipo]}</div>`;
                return;
            }

            const codigo = celda.codigo;
            const estadoSensor = obtenerEstadoSensorCajon(celda);
            const ticketInfo = infoPorCajon[codigo];
            const esDisc = celda.tipo === 'discapacitado';

            let colorFondo = esDisc ? 'rgba(10, 132, 255, 0.1)' : 'rgba(50, 215, 75, 0.08)';
            let colorBorde = esDisc ? '#0A84FF' : 'rgba(50, 215, 75, 0.45)';
            let colorTexto = esDisc ? '#60a5fa' : '#32D74B';
            let etiqueta = esDisc ? '♿ LIBRE' : 'LIBRE';

            if (estadoSensor === 'ocupado') {
                if (ticketInfo && ticketInfo.estado === 'multado') {
                    colorFondo = 'rgba(255, 0, 255, 0.14)'; colorBorde = '#FF00FF'; colorTexto = '#FF00FF'; etiqueta = 'MULTADO';
                } else if (!ticketInfo || ticketInfo.estado === 'reservado') {
                    colorFondo = 'rgba(255, 149, 0, 0.18)'; colorBorde = '#FF9500'; colorTexto = '#FF9500'; etiqueta = 'OBSTRUIDO';
                } else {
                    colorFondo = 'rgba(255, 69, 58, 0.18)'; colorBorde = '#FF453A'; colorTexto = '#FF453A'; etiqueta = 'OCUPADO';
                }
            } else if (ticketInfo) {
                if (ticketInfo.estado === 'multado') {
                    colorFondo = 'rgba(255, 0, 255, 0.12)'; colorBorde = '#FF00FF'; colorTexto = '#FF00FF'; etiqueta = 'MULTA';
                } else if (ticketInfo.estado === 'en_uso' || ticketInfo.estado === 'pagado') {
                    colorFondo = 'rgba(191, 90, 242, 0.15)'; colorBorde = '#BF5AF2'; colorTexto = '#BF5AF2'; etiqueta = 'EN TRÁNSITO';
                } else if (ticketInfo.estado === 'reservado') {
                    colorFondo = 'rgba(255, 214, 10, 0.14)'; colorBorde = '#FFD60A'; colorTexto = '#FFD60A'; etiqueta = 'RESERVADO';
                }
            }

            const badgeHW = celda.sensorFisico ? `<span class="badge-sensor-hw" title="Conectado a ${celda.sensorFisico}">HW</span>` : '';

            html += `
                <div class="cajon-admin" data-cajon="${codigo}" data-sensor="${celda.sensorFisico || ''}" style="position:relative; min-height: 68px; background: ${colorFondo}; border: 2px solid ${colorBorde}; border-radius: 10px; padding: 0.6rem 0.4rem; text-align: center; cursor: pointer; transition: all 0.2s;">
                    ${badgeHW}
                    <strong style="color: #fff; font-size: 1.05rem;">${esDisc ? '♿ ' : ''}${codigo}</strong><br>
                    <span style="font-size: 0.65rem; color: ${colorTexto}; font-weight: 800;">${etiqueta}</span>
                </div>
            `;
        });

        html += `</div>`;
        mapaContainer.innerHTML = html;

        document.querySelectorAll('.cajon-admin').forEach(btn => {
            btn.addEventListener('click', () => {
                const cod = btn.getAttribute('data-cajon');
                const sensorHw = btn.getAttribute('data-sensor');
                mostrarInspeccionCajon(cod, sensorHw, infoPorCajon[cod]);
            });
        });
    }

    function mostrarInspeccionCajon(codigoCajon, sensorFisico, datosTicket) {
        const infoVehiculo = document.getElementById('info-vehiculo');
        const tipoSensorTexto = sensorFisico
            ? `🔌 Hardware ESP32 (${sensorFisico})`
            : `☁️ Sensor Virtual IoT`;

        const estadoActualSensor = sensorFisico
            ? (adminEstadoFisico[sensorFisico] || 'libre')
            : ((adminSensoresVirtuales[estacionamientoActivoId] || {})[codigoCajon] || 'libre');

        const btnSimularSensor = `<button id="btn-toggle-sensor" style="width:100%; margin-top:10px; padding:10px; border-radius:8px; border:1px solid var(--spot-selected); background:rgba(10,132,255,0.14); color:#fff; font-weight:700; cursor:pointer;">
            📡 Cambiar Sensor a "${estadoActualSensor === 'ocupado' ? 'LIBRE' : 'OCUPADO'}" (Prueba)
        </button>`;

        if (!datosTicket) {
            infoVehiculo.innerHTML = `
                <div style="width: 100%;">
                    <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border-dark); padding-bottom:8px; margin-bottom:12px;">
                        <strong style="font-size:1.2rem; color:#fff;">Cajón ${codigoCajon}</strong>
                        <span style="font-size:0.8rem; color:var(--spot-selected);">${tipoSensorTexto}</span>
                    </div>
                    <p style="color: var(--text-muted); font-size:0.9rem;">Sin reserva activa. Estado del sensor: <strong style="color:#fff; text-transform:uppercase;">${estadoActualSensor}</strong></p>
                    ${btnSimularSensor}
                </div>
            `;
        } else {
            let tiempoVivo = '<span style="color: var(--text-muted);">Aún en tránsito</span>';
            if (datosTicket.timestampIngresoFisico) {
                const divisor = PARKIL_CONFIG.MODO_DEMO ? 1000 : 60000;
                const min = Math.floor((Date.now() - datosTicket.timestampIngresoFisico) / divisor);
                tiempoVivo = `<strong style="color:#fff; font-size:1.3rem;">${min} min</strong>`;
            }

            const btnAccion = datosTicket.estado === 'reservado'
                ? `<button id="btn-cancelar-reserva" style="width:100%; padding:10px; background:rgba(255,69,58,0.2); border:1px solid var(--danger-neon); color:var(--danger-neon); border-radius:8px; cursor:pointer; font-weight:bold;">❌ Cancelar Reserva</button>`
                : `<button id="btn-forzar-salida" style="width:100%; padding:10px; background:rgba(255,149,0,0.2); border:1px solid #FF9500; color:#FF9500; border-radius:8px; cursor:pointer; font-weight:bold;">⚠️ Forzar Finalización</button>`;

            infoVehiculo.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:0.8rem; width:100%;">
                    <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border-dark); padding-bottom:6px;">
                        <div>
                            <small style="color:var(--text-muted);">ESTADO TICKET</small><br>
                            <strong style="color:var(--spot-selected); font-size:1.15rem; text-transform:uppercase;">${datosTicket.estado}</strong>
                        </div>
                        <div style="text-align:right;">
                            <small style="color:var(--text-muted);">CAJÓN</small><br>
                            <strong style="color:#fff; font-size:1.2rem;">${datosTicket.cajon}</strong>
                        </div>
                    </div>
                    <div>
                        <small style="color:var(--text-muted);">CLIENTE / CÓDIGO</small><br>
                        <strong style="color:#fff;">${datosTicket.nombre} (${datosTicket.placa})</strong> — <span style="font-family:monospace; color:var(--spot-selected);">${datosTicket.id}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>Tiempo en cajón: ${tiempoVivo}</span>
                        <small style="color:var(--text-muted);">${tipoSensorTexto}</small>
                    </div>
                    ${btnAccion}
                    ${btnSimularSensor}
                </div>
            `;

            document.getElementById('btn-cancelar-reserva')?.addEventListener('click', () => {
                set(ref(db, `tickets_activos/${datosTicket.id}`), null);
                set(ref(db, `cajones_bloqueados/${codigoCajon}`), null);
                showToast("Reserva cancelada y cajón liberado", "success");
            });

            document.getElementById('btn-forzar-salida')?.addEventListener('click', async () => {
                datosTicket.estadoFinal = "completado_forzoso";
                datosTicket.timestampSalida = Date.now();
                await setDoc(doc(firestoreDB, "historial_tickets", datosTicket.id), datosTicket);
                await set(ref(db, `tickets_activos/${datosTicket.id}`), null);
                await set(ref(db, `cajones_bloqueados/${codigoCajon}`), null);
                showToast("Ticket archivado y cajón liberado", "success");
                cargarHistorial();
            });
        }

        document.getElementById('btn-toggle-sensor')?.addEventListener('click', async () => {
            const nuevoEstado = estadoActualSensor === 'ocupado' ? 'libre' : 'ocupado';
            if (sensorFisico) {
                await set(ref(db, `estacionamiento_actual/${sensorFisico}`), nuevoEstado);
            } else {
                if (!adminSensoresVirtuales[estacionamientoActivoId]) {
                    adminSensoresVirtuales[estacionamientoActivoId] = {};
                }
                adminSensoresVirtuales[estacionamientoActivoId][codigoCajon] = nuevoEstado;
                localStorage.setItem('parkil_sensores_virtuales', JSON.stringify(adminSensoresVirtuales));
                set(ref(db, `sensores_virtuales/${estacionamientoActivoId}/${codigoCajon}`), nuevoEstado).catch(() => {});
                dibujarMapaAdmin();
            }
            showToast(`Sensor de ${codigoCajon} cambiado a ${nuevoEstado.toUpperCase()}`, "info");
            mostrarInspeccionCajon(codigoCajon, sensorFisico, datosTicket);
        });
    }

    // --- PESTAÑA 2: MAPA SIN API KEY (OPENSTREETMAP OFICIAL) ---
    function inicializarMapaLeaflet() {
        const sede = catalogoEstacionamientos[estacionamientoActivoId] || crearEstacionamientoPorDefecto();
        const lat = Number(sede.lat) || 19.8454;
        const lng = Number(sede.lng) || -90.5358;

        if (!mapaLeaflet) {
            mapaLeaflet = L.map('mapa-admin-leaflet').setView([lat, lng], 15);
            // Servidor público oficial de OpenStreetMap (NO requiere API Key jamás)
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap'
            }).addTo(mapaLeaflet);

            marcadorLeaflet = L.marker([lat, lng], { draggable: true }).addTo(mapaLeaflet);

            mapaLeaflet.on('click', (e) => {
                const { lat, lng } = e.latlng;
                marcadorLeaflet.setLatLng([lat, lng]);
                document.getElementById('est-lat').value = lat.toFixed(6);
                document.getElementById('est-lng').value = lng.toFixed(6);
            });

            marcadorLeaflet.on('dragend', () => {
                const pos = marcadorLeaflet.getLatLng();
                document.getElementById('est-lat').value = pos.lat.toFixed(6);
                document.getElementById('est-lng').value = pos.lng.toFixed(6);
            });
        } else {
            mapaLeaflet.invalidateSize();
            mapaLeaflet.setView([lat, lng], 15);
            marcadorLeaflet.setLatLng([lat, lng]);
        }
    }

    function cargarFormularioSedeActiva() {
        const sede = catalogoEstacionamientos[estacionamientoActivoId];
        if (!sede) return;
        document.getElementById('est-nombre').value = sede.nombre || '';
        document.getElementById('est-direccion').value = sede.direccion || '';
        document.getElementById('est-tarifa').value = sede.tarifaHora || 25;
        document.getElementById('est-niveles').value = String(sede.niveles || 2);
        document.getElementById('est-lat').value = sede.lat || 19.845400;
        document.getElementById('est-lng').value = sede.lng || -90.535800;
    }

    document.getElementById('btn-nuevo-estacionamiento').addEventListener('click', () => {
        const nuevoId = 'parkil_sede_' + Date.now().toString().slice(-5);
        const nuevaSede = crearEstacionamientoPorDefecto();
        nuevaSede.id = nuevoId;
        nuevaSede.nombre = "Nueva Sucursal Parkil";
        nuevaSede.direccion = "San Francisco de Campeche";
        nuevaSede.lat = 19.848500;
        nuevaSede.lng = -90.532000;
        Object.values(nuevaSede.pisos).forEach(p => p.celdas.forEach(c => c.sensorFisico = ""));

        catalogoEstacionamientos[nuevoId] = nuevaSede;
        estacionamientoActivoId = nuevoId;
        localStorage.setItem('adminEstacionamientoId', nuevoId);
        guardarCatalogoEnNubeYLocal();

        actualizarSelectorSedes();
        cargarFormularioSedeActiva();
        renderizarPillsMonitor();
        dibujarMapaAdmin();
        renderizarConstructor();
        if (mapaLeaflet) inicializarMapaLeaflet();
        showToast("Nueva sucursal creada. Edita sus datos y ubicación.", "info");
    });

    document.getElementById('form-alta-estacionamiento').addEventListener('submit', (e) => {
        e.preventDefault();
        const sede = catalogoEstacionamientos[estacionamientoActivoId];
        if (!sede) return;

        sede.nombre = document.getElementById('est-nombre').value.trim();
        sede.direccion = document.getElementById('est-direccion').value.trim();
        sede.tarifaHora = Number(document.getElementById('est-tarifa').value) || 25;
        sede.niveles = Number(document.getElementById('est-niveles').value) || 1;
        sede.lat = Number(document.getElementById('est-lat').value) || 19.8454;
        sede.lng = Number(document.getElementById('est-lng').value) || -90.5358;

        if (!sede.pisos) sede.pisos = {};
        for (let i = 1; i <= sede.niveles; i++) {
            if (!sede.pisos[String(i)]) {
                sede.pisos[String(i)] = {
                    columnas: 5,
                    filas: 4,
                    celdas: Array.from({ length: 20 }, (_, idx) => ({
                        tipo: idx < 10 ? 'cajon' : 'calle',
                        codigo: `P${i}-${idx + 1}`,
                        sensorFisico: ''
                    }))
                };
            }
        }

        guardarCatalogoEnNubeYLocal();
        actualizarSelectorSedes();
        renderizarPillsMonitor();
        dibujarMapaAdmin();
        renderizarConstructor();
        showToast("¡Datos y ubicación guardados exitosamente!", "success");
    });

    // --- PESTAÑA 3: CONSTRUCTOR DE ESTACIONAMIENTO (MODO JUEGO) ---
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');
            herramientaActual = btn.getAttribute('data-tool');
        });
    });

    function renderizarConstructor() {
        const sede = catalogoEstacionamientos[estacionamientoActivoId];
        const gridContainer = document.getElementById('grid-builder-container');
        const pisosTabs = document.getElementById('builder-pisos-tabs');
        if (!sede || !gridContainer || !pisosTabs) return;

        pisosTabs.innerHTML = '';
        for (let p = 1; p <= (Number(sede.niveles) || 1); p++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `piso-pill ${p === pisoBuilderActual ? 'activo' : ''}`;
            btn.textContent = `Nivel ${p}`;
            btn.addEventListener('click', () => {
                pisoBuilderActual = p;
                celdaEditandoIndex = null;
                document.getElementById('inspector-celda-builder').classList.add('oculto');
                renderizarConstructor();
            });
            pisosTabs.appendChild(btn);
        }

        const pisoObj = sede.pisos[String(pisoBuilderActual)] || sede.pisos["1"];
        gridContainer.style.gridTemplateColumns = `repeat(${pisoObj.columnas}, minmax(95px, 1fr))`;
        gridContainer.innerHTML = '';

        let totalCajones = 0;
        let totalFisicos = 0;
        let totalDisc = 0;

        pisoObj.celdas.forEach((celda, idx) => {
            if (celda.tipo === 'cajon' || celda.tipo === 'discapacitado') totalCajones++;
            if (celda.sensorFisico) totalFisicos++;
            if (celda.tipo === 'discapacitado') totalDisc++;

            const div = document.createElement('div');
            div.className = `celda-plano tipo-${celda.tipo} ${celdaEditandoIndex === idx ? 'editando' : ''}`;

            let contenido = '';
            if (celda.tipo === 'cajon') {
                contenido = `<strong>🚗 ${celda.codigo || 'C' + (idx + 1)}</strong><small style="font-size:0.68rem;">${celda.sensorFisico ? '🔌 ' + celda.sensorFisico : '☁️ Virtual'}</small>`;
            } else if (celda.tipo === 'discapacitado') {
                contenido = `<strong>♿ ${celda.codigo || 'E' + (idx + 1)}</strong><small style="font-size:0.68rem;">Preferente</small>`;
            } else if (celda.tipo === 'elevador') {
                contenido = `<span style="font-size:1.3rem;">🛗</span><small style="font-weight:700;">ELEVADOR</small>`;
            } else if (celda.tipo === 'escalera') {
                contenido = `<span style="font-size:1.3rem;">🪜</span><small style="font-weight:700;">ESCALERA</small>`;
            } else if (celda.tipo === 'entrada') {
                contenido = `<span style="font-size:1.3rem;">🚧</span><small style="font-weight:700;">ENTRADA</small>`;
            } else if (celda.tipo === 'salida') {
                contenido = `<span style="font-size:1.3rem;">🏁</span><small style="font-weight:700;">SALIDA</small>`;
            } else if (celda.tipo === 'calle') {
                contenido = `<span>🛣️ Carril</span>`;
            } else {
                contenido = `<span style="color:#52525b; font-size:0.75rem;">Vacío</span>`;
            }

            div.innerHTML = contenido;
            div.addEventListener('click', () => aplicarHerramientaEnCelda(pisoObj, idx));
            gridContainer.appendChild(div);
        });

        document.getElementById('resumen-builder-stats').textContent =
            `Nivel ${pisoBuilderActual}: ${totalCajones} cajones en este piso | ${totalFisicos} con sensor físico ESP32 | ${totalDisc} para discapacitados`;
    }

    function aplicarHerramientaEnCelda(pisoObj, idx) {
        const celda = pisoObj.celdas[idx];
        const letraFila = String.fromCharCode(65 + Math.floor(idx / pisoObj.columnas));
        const numCol = (idx % pisoObj.columnas) + 1;

        if (herramientaActual === 'cajon' || herramientaActual === 'discapacitado') {
            celda.tipo = herramientaActual;
            if (!celda.codigo) celda.codigo = `${letraFila}${numCol}`;
            celdaEditandoIndex = idx;
            abrirInspectorCelda(celda);
        } else {
            celda.tipo = herramientaActual;
            delete celda.codigo;
            celda.sensorFisico = "";
            celdaEditandoIndex = null;
            document.getElementById('inspector-celda-builder').classList.add('oculto');
        }
        renderizarConstructor();
    }

    function abrirInspectorCelda(celda) {
        const inspector = document.getElementById('inspector-celda-builder');
        const inputCod = document.getElementById('input-codigo-cajon');
        const selectHw = document.getElementById('select-sensor-fisico');

        inspector.classList.remove('oculto');
        document.getElementById('lbl-cajon-edit').textContent = celda.codigo;
        inputCod.value = celda.codigo || '';
        selectHw.value = celda.sensorFisico || '';

        inputCod.oninput = () => {
            celda.codigo = inputCod.value.trim().toUpperCase() || 'A1';
            document.getElementById('lbl-cajon-edit').textContent = celda.codigo;
            renderizarConstructor();
        };

        selectHw.onchange = () => {
            celda.sensorFisico = selectHw.value;
            renderizarConstructor();
        };
    }

    document.getElementById('select-grid-size').addEventListener('change', (e) => {
        const [cols, rows] = e.target.value.split('x').map(Number);
        const sede = catalogoEstacionamientos[estacionamientoActivoId];
        if (!sede) return;
        const nuevoTotal = cols * rows;
        const celdasNuevas = Array.from({ length: nuevoTotal }, (_, i) => {
            const letra = String.fromCharCode(65 + Math.floor(i / cols));
            const num = (i % cols) + 1;
            return { tipo: 'cajon', codigo: `${letra}${num}`, sensorFisico: '' };
        });
        sede.pisos[String(pisoBuilderActual)] = { columnas: cols, filas: rows, celdas: celdasNuevas };
        renderizarConstructor();
    });

    document.getElementById('btn-plantilla-maqueta').addEventListener('click', () => {
        const sede = catalogoEstacionamientos[estacionamientoActivoId];
        if (!sede) return;
        sede.pisos["1"] = crearEstacionamientoPorDefecto().pisos["1"];
        pisoBuilderActual = 1;
        renderizarConstructor();
        dibujarMapaAdmin();
        showToast("Plantilla con los 6 sensores de la maqueta cargada", "info");
    });

    document.getElementById('btn-guardar-plano').addEventListener('click', () => {
        guardarCatalogoEnNubeYLocal();
        dibujarMapaAdmin();
        showToast("¡Plano del estacionamiento guardado y publicado en vivo!", "success");
    });

    // --- RENDERIZADO INMEDIATO AL ABRIR LA PÁGINA ---
    actualizarSelectorSedes();
    cargarFormularioSedeActiva();
    renderizarPillsMonitor();
    dibujarMapaAdmin();
    renderizarConstructor();

    // --- ESCUCHA EN VIVO DE SENSORES Y TICKETS EN FIREBASE ---
    onValue(ref(db, 'estacionamientos_red'), (snapshot) => {
        const nube = snapshot.val();
        if (nube && Object.keys(nube).length > 0) {
            catalogoEstacionamientos = nube;
            localStorage.setItem('parkil_catalogo_sedes', JSON.stringify(nube));
            actualizarSelectorSedes();
            cargarFormularioSedeActiva();
            renderizarPillsMonitor();
            dibujarMapaAdmin();
            renderizarConstructor();
        }
    });

    onValue(ref(db, 'tickets_activos'), (snapshot) => {
        adminTicketsActivos = snapshot.val() || {};
        dibujarMapaAdmin();
    });

    onValue(ref(db, 'estacionamiento_actual'), (snapshot) => {
        adminEstadoFisico = snapshot.val() || {};
        for (let idTicket in adminTicketsActivos) {
            const t = adminTicketsActivos[idTicket];
            if (t.estado === 'en_uso' && !t.timestampIngresoFisico) {
                const sensorId = t.sensorFisico || PARKIL_CONFIG.SENSORES_MAQUETA[t.cajon];
                if (sensorId && String(adminEstadoFisico[sensorId] || '').trim().toLowerCase() === 'ocupado') {
                    update(ref(db, `tickets_activos/${idTicket}`), { timestampIngresoFisico: Date.now() });
                }
            }
        }
        dibujarMapaAdmin();
    });

    // Recolector automático de reservas expiradas
    setInterval(() => {
        const ahora = Date.now();
        for (let id in adminTicketsActivos) {
            const t = adminTicketsActivos[id];
            if (t.estado === 'reservado' && t.timestampExpiracion && ahora > (t.timestampExpiracion + 60000)) {
                set(ref(db, `tickets_activos/${id}`), null);
                if (t.cajon) set(ref(db, `cajones_bloqueados/${t.cajon}`), null);
                showToast(`Cajón ${t.cajon} liberado (Reserva expirada)`, 'error');
                delete adminTicketsActivos[id];
            }
        }
    }, 4000);

    // --- BOTONES DE PLUMA, RESOLUCIONES E HISTORIAL ---
    document.getElementById('btn-emergencia-entrada').addEventListener('click', () => {
        set(ref(db, 'control_plumas/entrada'), 'abrir');
        showToast("Señal enviada: Abriendo pluma de Entrada", "info");
    });

    document.getElementById('btn-emergencia-salida').addEventListener('click', () => {
        set(ref(db, 'control_plumas/salida'), 'abrir');
        showToast("Señal enviada: Abriendo pluma de Salida", "info");
    });

    const inputBusqueda = document.getElementById('input-busqueda-admin');
    const btnBuscar = document.getElementById('btn-buscar-admin');
    const divResultado = document.getElementById('resultado-busqueda');

    btnBuscar.addEventListener('click', () => {
        const query = inputBusqueda.value.trim().toUpperCase();
        if (!query) { showToast("Ingresa una placa o código PARK-XXXX", "error"); return; }

        let encontrado = null;
        let idEncontrado = null;
        for (let id in adminTicketsActivos) {
            const t = adminTicketsActivos[id];
            if (id.toUpperCase() === query || (t.placa || '').toUpperCase() === query) {
                encontrado = t;
                idEncontrado = id;
                break;
            }
        }

        divResultado.classList.remove('oculto');
        if (!encontrado) {
            divResultado.innerHTML = `<p style="color: var(--danger-neon); text-align:center; font-weight:bold; margin:0;">❌ Vehículo o ticket activo no encontrado</p>`;
            return;
        }

        divResultado.innerHTML = `
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap;">
                <div>
                    <strong>${encontrado.nombre}</strong> (${encontrado.placa})<br>
                    <span style="color:var(--spot-selected); font-family:monospace;">${idEncontrado}</span>
                </div>
                <div style="text-align:right;">
                    Estado: <strong style="color:#FFD60A; text-transform:uppercase;">${encontrado.estado}</strong><br>
                    Cajón: <strong>${encontrado.cajon}</strong>
                </div>
            </div>
            <button class="btn-primario-azul" id="btn-abrir-res" style="width:100%; margin-top:10px;">🚧 Autorizar Pago en Efectivo y Abrir Pluma Salida</button>
        `;

        document.getElementById('btn-abrir-res').addEventListener('click', async () => {
            await update(ref(db, `tickets_activos/${idEncontrado}`), {
                estado: 'pagado',
                timestampPagado: Date.now()
            });
            await set(ref(db, 'control_plumas/salida'), 'abrir');
            showToast("Ticket marcado como pagado y abriendo pluma de salida", "success");
        });
    });

    async function cargarHistorial() {
        try {
            const querySnapshot = await getDocs(collection(firestoreDB, "historial_tickets"));
            let totalDinero = 0;
            let totalTickets = 0;
            historialGlobal = [];
            let paquetesCount = { 'Express': 0, 'Estándar': 0, 'Reunión': 0, 'Máximo': 0 };

            querySnapshot.forEach((documento) => {
                const ticket = documento.data();
                ticket.idReal = documento.id;
                historialGlobal.push(ticket);

                const reserva = Number(ticket.pagoReserva) || 0;
                const tiempo = Number(ticket.pagoEstacionamiento) || 0;
                const multa = Number(ticket.pagoMulta) || 0;
                const sumaTotal = Number(ticket.granTotal) || (reserva + tiempo + multa);

                const paq = ticket.paquete || "";
                if (paq.includes('Express')) paquetesCount['Express']++;
                else if (paq.includes('Est')) paquetesCount['Estándar']++;
                else if (paq.includes('Reuni')) paquetesCount['Reunión']++;
                else if (paq.includes('x')) paquetesCount['Máximo']++;

                totalTickets++;
                totalDinero += sumaTotal;
            });

            document.getElementById('stat-tickets').textContent = totalTickets;
            document.getElementById('stat-ingresos').textContent = `$${totalDinero.toFixed(2)}`;
            renderizarTablaHistorial(historialGlobal);
            if (totalTickets > 0) dibujarGrafica(paquetesCount);
        } catch (err) {
            console.error("Error al cargar historial:", err);
        }
    }

    function dibujarGrafica(conteo) {
        const ctx = document.getElementById('graficaPaquetes');
        if (!ctx) return;
        if (chartInstancia) chartInstancia.destroy();
        chartInstancia = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Express', 'Estándar', 'Reunión', 'Máximo'],
                datasets: [{
                    data: [conteo['Express'], conteo['Estándar'], conteo['Reunión'], conteo['Máximo']],
                    backgroundColor: ['#0A84FF', '#32D74B', '#FFE600', '#BF5AF2'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: '#a1a1aa' } } }
            }
        });
    }

    function renderizarTablaHistorial(datos) {
        const tablaBody = document.getElementById('tabla-body-historial');
        if (datos.length === 0) {
            tablaBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No hay tickets registrados.</td></tr>`;
            return;
        }
        tablaBody.innerHTML = datos.map(t => {
            const reserva = Number(t.pagoReserva) || 0;
            const tiempo = Number(t.pagoEstacionamiento) || 0;
            const multa = Number(t.pagoMulta) || 0;
            const sumaTotal = Number(t.granTotal) || (reserva + tiempo + multa);
            const sedeNombre = t.estacionamientoNombre || "Parkil Campeche";
            return `
                <tr>
                    <td style="font-family:monospace; color:var(--spot-selected);">${t.idReal}</td>
                    <td><strong>${t.nombre || 'Cliente'}</strong><br><small style="color:var(--text-muted);">${t.placa || 'N/A'}</small></td>
                    <td><strong>${t.cajon}</strong><br><small style="color:var(--text-muted);">${sedeNombre}</small></td>
                    <td>${t.paquete || 'Estándar'}</td>
                    <td><strong style="color:var(--success-neon);">$${sumaTotal.toFixed(2)}</strong></td>
                    <td><span class="badge-pagado">Completado</span></td>
                </tr>
            `;
        }).join('');
    }

    document.getElementById('filtro-historial').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        renderizarTablaHistorial(historialGlobal.filter(t =>
            (t.placa && t.placa.toLowerCase().includes(q)) ||
            (t.nombre && t.nombre.toLowerCase().includes(q))
        ));
    });

    document.getElementById('btn-exportar-csv').addEventListener('click', () => {
        let csv = "ID_Ticket,Cliente,Placa,Estacionamiento,Cajon,Total\n";
        historialGlobal.forEach(t => {
            const total = Number(t.granTotal) || 0;
            csv += `${t.idReal},${t.nombre},${t.placa},${t.estacionamientoNombre || 'Matriz'},${t.cajon},$${total}\n`;
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        link.download = "Reporte_Parkil.csv";
        link.click();
        showToast("Reporte CSV descargado", "success");
    });

    cargarHistorial();
});
