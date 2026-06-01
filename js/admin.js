// js/admin.js
import { auth, firestoreDB, db, onAuthStateChanged, collection, getDocs, ref, onValue, set, update, doc, setDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Validar Sesión
    onAuthStateChanged(auth, (user) => {
        if (!user) window.location.href = '../index.html';
    });

    const tablaBody = document.getElementById('tabla-body-historial');
    const statIngresos = document.getElementById('stat-ingresos');
    const statTickets = document.getElementById('stat-tickets');
    const mapaContainer = document.getElementById('admin-mapa-container');
    const infoVehiculo = document.getElementById('info-vehiculo');
    const filtroHistorial = document.getElementById('filtro-historial');

    // --- 2. FIRESTORE: Cargar Historial ---
    let historialGlobal = []; // Para el buscador

    async function cargarHistorial() {
        try {
            const querySnapshot = await getDocs(collection(firestoreDB, "historial_tickets"));
            let totalDinero = 0;
            let totalTickets = 0;
            historialGlobal = [];

            querySnapshot.forEach((documento) => {
                const ticket = documento.data(); 
                ticket.idReal = documento.id; // Guardamos el ID
                historialGlobal.push(ticket);

                const reserva = Number(ticket.pagoReserva) || 0;
                const tiempo = Number(ticket.pagoEstacionamiento) || 0;
                const multa = Number(ticket.pagoMulta) || 0;
                const sumaTotal = Number(ticket.granTotal) || (reserva + tiempo + multa);

                totalTickets++;
                totalDinero += sumaTotal; 
            });

            statTickets.textContent = totalTickets;
            statIngresos.textContent = `$${totalDinero.toFixed(2)}`;
            renderizarTablaHistorial(historialGlobal);

        } catch (error) {
            console.error("Error al cargar historial:", error);
            tablaBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger-neon);">Error al cargar los datos.</td></tr>`;
        }
    }

    function renderizarTablaHistorial(datos) {
        let htmlTabla = '';
        if (datos.length === 0) {
            tablaBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No hay tickets encontrados.</td></tr>`;
            return;
        }

        datos.forEach(ticket => {
            const reserva = Number(ticket.pagoReserva) || 0;
            const tiempo = Number(ticket.pagoEstacionamiento) || 0;
            const multa = Number(ticket.pagoMulta) || 0;
            const sumaTotal = Number(ticket.granTotal) || (reserva + tiempo + multa);

            const nombreCliente = ticket.nombre || "Cliente Web";
            const placaCliente = ticket.placa || "N/A";
            
            let tiempoTexto = "--";
            if (ticket.timestampIngresoFisico && ticket.timestampSalida) {
                const min = Math.ceil((ticket.timestampSalida - ticket.timestampIngresoFisico) / 60000);
                tiempoTexto = `${min} min`;
            }

            let uiDinero = `<strong style="color: var(--success-neon); font-size: 1.1rem;">$${sumaTotal.toFixed(2)}</strong><br>`;
            uiDinero += `<span style="font-size: 0.75rem; color: var(--text-muted);">Reserva: $${reserva.toFixed(2)}</span><br>`;
            if (tiempo > 0) uiDinero += `<span style="font-size: 0.75rem; color: var(--text-muted);">Tiempo: $${tiempo.toFixed(2)}</span><br>`;
            if (multa > 0) uiDinero += `<span style="font-size: 0.75rem; color: var(--danger-neon);">Multa: +$${multa.toFixed(2)}</span>`;

            htmlTabla += `
                <tr>
                    <td style="font-family: monospace; color: var(--spot-selected);">${ticket.idReal.substring(0,8)}...</td>
                    <td><strong>${nombreCliente}</strong><br><span style="font-size: 0.8rem; color: var(--text-muted);">${placaCliente}</span></td>
                    <td><strong>${ticket.cajon}</strong></td>
                    <td>${tiempoTexto}</td>
                    <td>${uiDinero}</td>
                    <td><span class="badge-pagado">Completado</span></td>
                </tr>
            `;
        });
        tablaBody.innerHTML = htmlTabla;
    }

    cargarHistorial();

    // Filtro dinámico del historial
    if(filtroHistorial) {
        filtroHistorial.addEventListener('input', (e) => {
            const texto = e.target.value.toLowerCase();
            const filtrados = historialGlobal.filter(t => 
                (t.placa && t.placa.toLowerCase().includes(texto)) || 
                (t.nombre && t.nombre.toLowerCase().includes(texto))
            );
            renderizarTablaHistorial(filtrados);
        });
    }

    // --- 3. MATRIZ DE ESTADOS EN TIEMPO REAL ---
    let adminEstadoFisico = {};
    let adminTicketsActivos = {};

    const ticketsActivosRef = ref(db, 'tickets_activos');
    const sensoresFisicosRef = ref(db, 'estacionamiento_actual');

    onValue(ticketsActivosRef, (snapshot) => {
        adminTicketsActivos = snapshot.val() || {};
        dibujarMapaAdmin();
    });

    onValue(sensoresFisicosRef, (snapshot) => {
        adminEstadoFisico = snapshot.val() || {};
        
        // 🧠 MAGIA DE SERVIDOR: El Admin vigila y arranca relojes
        const equivalenciasInversas = {
            'cajon_1': 'A1', 'cajon_2': 'A2', 'cajon_3': 'A3',
            'cajon_4': 'B1', 'cajon_5': 'B2', 'cajon_6': 'B3'
        };

        for(let keySensor in adminEstadoFisico) {
            let estado = String(adminEstadoFisico[keySensor]).trim().toLowerCase();
            if(estado === 'ocupado') {
                let nombreCajon = equivalenciasInversas[keySensor];
                for(let idTicket in adminTicketsActivos) {
                    let t = adminTicketsActivos[idTicket];
                    if(t.cajon === nombreCajon && t.estado === 'en_uso' && !t.timestampIngresoFisico) {
                        update(ref(db, `tickets_activos/${idTicket}`), {
                            timestampIngresoFisico: new Date().getTime()
                        });
                    }
                }
            }
        }
        dibujarMapaAdmin();
    });

    function dibujarMapaAdmin() {
        const equivalencias = {
            'A1': 'cajon_1', 'A2': 'cajon_2', 'A3': 'cajon_3',
            'B1': 'cajon_4', 'B2': 'cajon_5', 'B3': 'cajon_6'
        };

        let infoPorCajon = {};
        for (let id in adminTicketsActivos) {
            infoPorCajon[adminTicketsActivos[id].cajon] = { id: id, ...adminTicketsActivos[id] };
        }

        let htmlMapa = `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">`;
        const todosLosCajones = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];

        todosLosCajones.forEach(cajon => {
            const idSensor = equivalencias[cajon];
            const estadoSensor = adminEstadoFisico[idSensor]; 
            const ticketInfo = infoPorCajon[cajon];

            let colorFondo = 'rgba(255,255,255,0.02)';
            let colorBorde = 'var(--border-dark)';
            let colorTexto = 'var(--text-muted)';
            let etiqueta = 'LIBRE';
            let brillo = 'none';

            if (estadoSensor === 'ocupado') {
                if (ticketInfo && ticketInfo.estado === 'multado') {
                    colorFondo = 'rgba(255, 0, 255, 0.1)'; colorBorde = '#FF00FF'; colorTexto = '#FF00FF'; etiqueta = 'MULTADO'; brillo = '0 0 15px rgba(255, 0, 255, 0.4)';
                } else if (!ticketInfo || ticketInfo.estado === 'reservado') {
                    colorFondo = 'rgba(255, 149, 0, 0.15)'; colorBorde = '#FF9500'; colorTexto = '#FF9500'; etiqueta = 'OBSTRUIDO';
                } else {
                    colorFondo = 'rgba(255, 69, 58, 0.15)'; colorBorde = 'var(--danger-neon)'; colorTexto = 'var(--danger-neon)'; etiqueta = 'OCUPADO';
                }
            } else {
                if (ticketInfo) {
                    if (ticketInfo.estado === 'multado') {
                        colorFondo = 'rgba(191, 90, 242, 0.1)'; colorBorde = '#FF00FF'; colorTexto = '#FF00FF'; etiqueta = 'MULTA PENDIENTE';
                    } 
                    else if (ticketInfo.estado === 'en_uso' || ticketInfo.estado === 'pagado') {
                        colorFondo = 'rgba(191, 90, 242, 0.1)'; colorBorde = '#BF5AF2'; colorTexto = '#BF5AF2'; etiqueta = 'EN TRÁNSITO'; brillo = 'inset 0 0 10px rgba(191, 90, 242, 0.3)';
                    } 
                    else if (ticketInfo.estado === 'reservado') {
                        colorFondo = 'rgba(255, 214, 10, 0.1)'; colorBorde = '#FFD60A'; etiqueta = 'RESERVADO';
                    }
                }
            }

            htmlMapa += `
                <div class="cajon-admin" data-cajon="${cajon}" style="background: ${colorFondo}; border: 2px solid ${colorBorde}; box-shadow: ${brillo}; border-radius: 8px; padding: 1rem; text-align: center; cursor: pointer; transition: all 0.3s;">
                    <strong style="color: #fff; font-size: 1.2rem;">${cajon}</strong><br>
                    <span style="font-size: 0.7rem; color: ${colorTexto}; text-transform: uppercase; font-weight: bold;">${etiqueta}</span>
                </div>
            `;
        });

        htmlMapa += `</div>`;
        mapaContainer.innerHTML = htmlMapa;

        // Clics para Inspección Avanzada
        document.querySelectorAll('.cajon-admin').forEach(btn => {
            btn.addEventListener('click', () => {
                const cajonSeleccionado = btn.getAttribute('data-cajon');
                const datos = infoPorCajon[cajonSeleccionado];
                if (datos) {
                    mostrarInfo(datos);
                } else {
                    const idSensor = equivalencias[cajonSeleccionado];
                    if (adminEstadoFisico[idSensor] === 'ocupado') {
                        infoVehiculo.innerHTML = `<div style="text-align:center; padding:1.5rem; color:#FF9500;"><h3>⚠️ Vehículo Obstructor</h3><p>Hay un auto físicamente en el cajón, pero no existe un ticket activo. Revise las cámaras.</p></div>`;
                    } else {
                        infoVehiculo.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted);"><p>Cajón vacío y sin reservas.</p></div>`;
                    }
                }
            });
        });
    }

    // --- 4. ACCIONES MAESTRAS (SÚPER ADMIN) ---
    function mostrarInfo(datos) {
        let tiempoVivo = '<span style="color: var(--text-muted); font-size: 1.1rem;">Aún en tránsito</span>';
        if (datos.timestampIngresoFisico) {
            const minutos = Math.floor((new Date().getTime() - datos.timestampIngresoFisico) / 60000);
            tiempoVivo = `<span style="color: #FFFFFF; font-weight: bold; font-size: 1.4rem;">${minutos} <small style="font-size: 0.9rem; color: var(--text-muted);">min</small></span>`;
        }

        // Botones de acción dinámicos
        let botonesAccion = '';
        if (datos.estado === 'reservado') {
            botonesAccion = `<button id="btn-cancelar-reserva" data-id="${datos.id}" data-cajon="${datos.cajon}" style="width: 100%; padding: 10px; background: rgba(255, 69, 58, 0.2); border: 1px solid var(--danger-neon); color: var(--danger-neon); border-radius: 8px; cursor: pointer; font-weight: bold;">🚫 Cancelar Reserva</button>`;
        } else {
            botonesAccion = `<button id="btn-forzar-salida" data-id="${datos.id}" data-cajon="${datos.cajon}" style="width: 100%; padding: 10px; background: rgba(255, 149, 0, 0.2); border: 1px solid #FF9500; color: #FF9500; border-radius: 8px; cursor: pointer; font-weight: bold;">🧹 Forzar Finalización (Sacar del sistema)</button>`;
        }

        infoVehiculo.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1.2rem; width: 100%;">
                <div style="border-bottom: 1px dashed var(--border-dark); padding-bottom: 0.5rem; display: flex; justify-content: space-between;">
                    <div>
                        <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Estado del Ticket</span><br>
                        <strong style="color: ${datos.estado === 'multado' ? '#FF00FF' : 'var(--spot-selected)'}; font-size: 1.3rem; text-transform: uppercase;">${datos.estado}</strong>
                    </div>
                    <div style="text-align: right;">
                        <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Cajón</span><br>
                        <strong style="color: #fff; font-size: 1.3rem;">${datos.cajon}</strong>
                    </div>
                </div>
                <div style="border-bottom: 1px dashed var(--border-dark); padding-bottom: 0.5rem;">
                    <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Cliente / Código</span><br>
                    <strong style="color: #fff; font-size: 1rem;">${datos.nombre} (${datos.placa})</strong><br>
                    <span style="color: var(--spot-selected); font-family: monospace;">${datos.id}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Tiempo Estacionado</span><br>
                        ${tiempoVivo}
                    </div>
                </div>
                <div style="margin-top: 10px;">
                    ${botonesAccion}
                </div>
            </div>
        `;

        // Lógica de los botones maestros
        const btnCancelar = document.getElementById('btn-cancelar-reserva');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', (e) => {
                if(confirm("¿Seguro que deseas cancelar esta reserva? El lugar quedará libre.")) {
                    const idT = e.target.getAttribute('data-id');
                    const caj = e.target.getAttribute('data-cajon');
                    set(ref(db, `tickets_activos/${idT}`), null);
                    set(ref(db, `cajones_bloqueados/${caj}`), null);
                    infoVehiculo.innerHTML = `<p style="color: var(--success-neon); text-align: center;">Reserva cancelada.</p>`;
                }
            });
        }

        const btnForzar = document.getElementById('btn-forzar-salida');
        if (btnForzar) {
            btnForzar.addEventListener('click', async (e) => {
                if(confirm("ATENCIÓN: Esto sacará al auto del sistema como si hubiera salido. ¿Continuar?")) {
                    const idT = e.target.getAttribute('data-id');
                    const caj = e.target.getAttribute('data-cajon');
                    
                    // Copiar al historial de Firestore
                    const ticketAForzar = adminTicketsActivos[idT];
                    ticketAForzar.estadoFinal = "completado_forzoso";
                    ticketAForzar.timestampSalida = new Date().getTime();
                    
                    await setDoc(doc(firestoreDB, "historial_tickets", idT), ticketAForzar);
                    
                    // Borrar de Realtime
                    set(ref(db, `tickets_activos/${idT}`), null);
                    set(ref(db, `cajones_bloqueados/${caj}`), null);
                    
                    infoVehiculo.innerHTML = `<p style="color: var(--success-neon); text-align: center;">Ticket finalizado y cajón liberado.</p>`;
                    cargarHistorial(); // Refrescamos la tabla de abajo
                }
            });
        }
    }

    // --- 5. BOTONES DE EMERGENCIA FÍSICOS ---
    const btnEmergenciaEntrada = document.getElementById('btn-emergencia-entrada');
    const btnEmergenciaSalida = document.getElementById('btn-emergencia-salida');

    if(btnEmergenciaEntrada) {
        btnEmergenciaEntrada.addEventListener('click', () => {
            if(confirm("🚨 ¿Estás seguro de forzar la apertura de la pluma de ENTRADA?")) set(ref(db, 'control_plumas/entrada'), 'abrir');
        });
    }

    if(btnEmergenciaSalida) {
        btnEmergenciaSalida.addEventListener('click', () => {
            if(confirm("🚨 ¿Estás seguro de forzar la apertura de la pluma de SALIDA?")) set(ref(db, 'control_plumas/salida'), 'abrir');
        });
    }

    // --- 6. BUSCADOR INTELIGENTE (Mantenido intacto) ---
    const inputBusqueda = document.getElementById('input-busqueda-admin');
    const btnBuscar = document.getElementById('btn-buscar-admin');
    const divResultado = document.getElementById('resultado-busqueda');

    if (btnBuscar && inputBusqueda) {
        inputBusqueda.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); btnBuscar.click(); }
        });

        btnBuscar.addEventListener('click', () => {
            const query = inputBusqueda.value.trim().toUpperCase();
            if (!query) { alert("Por favor ingresa una placa o código."); return; }

            btnBuscar.textContent = "Buscando...";
            divResultado.classList.add('oculto');
            
            let ticketEncontrado = null;
            let idTicketEncontrado = null;

            for (let id in adminTicketsActivos) {
                const t = adminTicketsActivos[id];
                if (id.trim().toUpperCase() === query || (t.placa || "").trim().toUpperCase() === query) {
                    ticketEncontrado = t;
                    idTicketEncontrado = id;
                    break; 
                }
            }

            setTimeout(() => {
                btnBuscar.textContent = "Buscar Cliente";
                divResultado.classList.remove('oculto');

                if (!ticketEncontrado) {
                    divResultado.innerHTML = `
                        <div style="text-align: center; padding: 10px;">
                            <p style="color: var(--danger-neon); margin: 0; font-weight: bold; font-size: 1.1rem;">❌ Vehículo no encontrado</p>
                            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 5px;">Asegúrate de que la placa (${query}) tenga un boleto activo.</p>
                        </div>`;
                    return;
                }

                let colorEstado = "#32D74B"; 
                let accionHTML = "";
                let mensajeDeuda = "Todo pagado";

                if (ticketEncontrado.estado === 'multado') {
                    colorEstado = "#FF00FF";
                    mensajeDeuda = `DEBE MULTA: $${ticketEncontrado.pagoMulta} MXN`;
                    accionHTML = `
                        <button class="btn-resolver-plan-b" data-id="${idTicketEncontrado}" style="background: #FF00FF; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 15px; width: 100%; font-size: 1rem;">
                            💵 Cobrar Multa en Efectivo y Abrir Salida
                        </button>`;
                } else if (ticketEncontrado.estado === 'en_uso' || ticketEncontrado.estado === 'reservado') {
                    colorEstado = "#FFD60A";
                    mensajeDeuda = "Ticket en curso (Aún no cobra salida)";
                    accionHTML = `
                        <button class="btn-abrir-plan-b" data-id="${idTicketEncontrado}" style="background: transparent; border: 2px solid var(--spot-selected); color: var(--spot-selected); padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 15px; width: 100%; font-size: 1rem;">
                            🚨 Forzar Apertura de Salida
                        </button>`;
                } else if (ticketEncontrado.estado === 'pagado') {
                    accionHTML = `
                        <button class="btn-abrir-plan-b" data-id="${idTicketEncontrado}" style="background: var(--success-neon); color: black; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 15px; width: 100%; font-size: 1rem;">
                            ✅ Ya pagó. Abrir Pluma de Salida
                        </button>`;
                }

                divResultado.innerHTML = `
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-dark); padding-bottom: 10px;">
                        <div>
                            <p style="margin: 0; color: var(--text-muted); font-size: 0.75rem; letter-spacing: 1px;">CLIENTE</p>
                            <strong style="color: white; font-size: 1.2rem;">${ticketEncontrado.nombre}</strong><br>
                            <span style="color: var(--spot-selected); font-family: monospace; font-size: 0.9rem;">${idTicketEncontrado}</span> | Placa: <strong style="color: white;">${ticketEncontrado.placa}</strong>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; color: var(--text-muted); font-size: 0.75rem; letter-spacing: 1px;">ESTADO FINANCIERO</p>
                            <strong style="color: ${colorEstado}; font-size: 1.1rem;">${mensajeDeuda}</strong><br>
                            <span style="color: white; font-size: 0.9rem; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">Cajón: ${ticketEncontrado.cajon}</span>
                        </div>
                    </div>
                    ${accionHTML}
                `;

                const btnResolver = divResultado.querySelector('.btn-resolver-plan-b');
                if (btnResolver) {
                    btnResolver.addEventListener('click', () => {
                        if(confirm("¿Confirmas el pago en efectivo y abrir la pluma?")) {
                            set(ref(db, `tickets_activos/${idTicketEncontrado}/estado`), 'pagado');
                            set(ref(db, 'control_plumas/salida'), 'abrir');
                            alert("✅ Pago registrado. Pluma abriéndose...");
                            divResultado.innerHTML = `<p style="color: var(--success-neon); text-align: center; font-weight: bold; margin-top: 10px;">Pluma abierta y pago resuelto.</p>`;
                        }
                    });
                }

                const btnAbrir = divResultado.querySelector('.btn-abrir-plan-b');
                if (btnAbrir) {
                    btnAbrir.addEventListener('click', () => {
                        if(confirm("¿Confirmas forzar la apertura de la pluma de SALIDA?")) {
                            set(ref(db, 'control_plumas/salida'), 'abrir');
                            alert("✅ Pluma abriéndose...");
                        }
                    });
                }

            }, 600); 
        });
    }
});