// js/admin.js
import { auth, firestoreDB, db, onAuthStateChanged, collection, getDocs, ref, onValue,set } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Validar que nadie entre sin iniciar sesión
    onAuthStateChanged(auth, (user) => {
        if (!user) window.location.href = '../index.html';
    });

    const tablaBody = document.getElementById('tabla-body-historial');
    const statIngresos = document.getElementById('stat-ingresos');
    const statTickets = document.getElementById('stat-tickets');
    const mapaContainer = document.getElementById('admin-mapa-container');
    const infoVehiculo = document.getElementById('info-vehiculo');

    // --- 2. FIRESTORE: Cargar Historial y Contabilidad ---

    async function cargarHistorial() {
        try {
            // Buscamos la carpeta entera de historial_tickets
            const querySnapshot = await getDocs(collection(firestoreDB, "historial_tickets"));
            let totalDinero = 0;
            let totalTickets = 0;
            let htmlTabla = '';

            querySnapshot.forEach((doc) => {
                const ticket = doc.data(); // AQUÍ nace la variable ticket
                totalTickets++;
// Extraemos las cajas separadas sin duplicar variables
                const reserva = Number(ticket.pagoReserva) || 0;
                const tiempo = Number(ticket.pagoEstacionamiento) || 0;
                const multa = Number(ticket.pagoMulta) || 0;
                const sumaTotal = Number(ticket.granTotal) || (reserva + tiempo + multa);

                totalTickets++;
                totalDinero += sumaTotal; // Sumamos a las ganancias de hoy


                const nombreCliente = ticket.nombre || "Cliente Web";
                const placaCliente = ticket.placa || "N/A";
                
                let tiempoTexto = "-- hrs";
                if (ticket.timestampIngresoFisico && ticket.timestampSalida) {
                    const min = Math.ceil((ticket.timestampSalida - ticket.timestampIngresoFisico) / 60000);
                    tiempoTexto = `${min} hrs`;
                }

// Armamos el texto visual del dinero (El recibo desglosado)
                let uiDinero = `<strong style="color: var(--success-neon); font-size: 1.1rem;">$${sumaTotal.toFixed(2)}</strong><br>`;
                uiDinero += `<span style="font-size: 0.75rem; color: var(--text-muted);">Reserva: $${reserva.toFixed(2)}</span><br>`;
                
                if (tiempo > 0) {
                    uiDinero += `<span style="font-size: 0.75rem; color: var(--text-muted);">Tiempo: $${tiempo.toFixed(2)}</span><br>`;
                }
                if (multa > 0) {
                    uiDinero += `<span style="font-size: 0.75rem; color: var(--danger-neon);">Multa: +$${multa.toFixed(2)}</span>`;
                }

                htmlTabla += `
                    <tr>
                        <td style="font-family: monospace; color: var(--spot-selected);">${doc.id.substring(0,8)}...</td>
                        <td><strong>${nombreCliente}</strong><br><span style="font-size: 0.8rem; color: var(--text-muted);">${placaCliente}</span></td>
                        <td><strong>${ticket.cajon}</strong></td>
                        <td>${tiempoTexto}</td>
                        <td>${uiDinero}</td>
                        <td><span class="badge-pagado">Completado</span></td>
                    </tr>
                `;
            });

            if (totalTickets === 0) {
                htmlTabla = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No hay tickets liquidados aún.</td></tr>`;
            }

            tablaBody.innerHTML = htmlTabla;
            statTickets.textContent = totalTickets;
            statIngresos.textContent = `$${totalDinero.toFixed(2)}`;

        } catch (error) {
            console.error("Error al cargar historial:", error);
            tablaBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger-neon);">Error al cargar los datos.</td></tr>`;
        }
    }

    cargarHistorial();

    cargarHistorial();

// --- 3 y 4. MATRIZ DE ESTADOS EN TIEMPO REAL (Unificada) ---
    let adminEstadoFisico = {};
    let adminTicketsActivos = {};

    const ticketsActivosRef = ref(db, 'tickets_activos');
    const sensoresFisicosRef = ref(db, 'estacionamiento_actual');

    // Escuchamos ambos canales
    onValue(ticketsActivosRef, (snapshot) => {
        adminTicketsActivos = snapshot.val() || {};
        dibujarMapaAdmin();
    });

    onValue(sensoresFisicosRef, (snapshot) => {
        adminEstadoFisico = snapshot.val() || {};
        dibujarMapaAdmin();
    });

    function dibujarMapaAdmin() {
        const equivalencias = {
            'A1': 'cajon_1', 'A2': 'cajon_2', 'A3': 'cajon_3',
            'B1': 'cajon_4', 'B2': 'cajon_5', 'B3': 'cajon_6'
        };

        // Indexamos los tickets por cajón para búsqueda rápida
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

            //  MATRIZ DE CLASIFICACIÓN CORREGIDA
            if (estadoSensor === 'ocupado') {
                if (ticketInfo && ticketInfo.estado === 'multado') {
                    //  MULTADO (Detectado físicamente)
                    colorFondo = 'rgba(255, 0, 255, 0.1)';
                    colorBorde = '#FF00FF'; 
                    colorTexto = '#FF00FF';
                    etiqueta = 'MULTADO';
                    brillo = '0 0 15px rgba(255, 0, 255, 0.4)';
                } else if (!ticketInfo || ticketInfo.estado === 'reservado') {
                    //  OBSTRUIDO
                    colorFondo = 'rgba(255, 149, 0, 0.15)'; 
                    colorBorde = '#FF9500';
                    colorTexto = '#FF9500';
                    etiqueta = 'OBSTRUIDO';
                } else {
                    //  OCUPADO NORMAL
                    colorFondo = 'rgba(255, 69, 58, 0.15)'; 
                    colorBorde = 'var(--danger-neon)';
                    colorTexto = 'var(--danger-neon)';
                    etiqueta = 'OCUPADO';
                }
            } else {
                // Sensor libre, pero veamos el estado digital
                if (ticketInfo) {
                    if (ticketInfo.estado === 'multado') {
                        //  MULTADO (Ya no está en el cajón, pero sigue en el sistema)
                        colorFondo = 'rgba(191, 90, 242, 0.1)';
                        colorBorde = '#FF00FF'; 
                        colorTexto = '#FF00FF';
                        etiqueta = 'MULTA PENDIENTE';
                    } 
                    else if (ticketInfo.estado === 'en_uso' || ticketInfo.estado === 'pagado') {
                        //  EN CAMINO / SALIENDO
                        colorFondo = 'rgba(191, 90, 242, 0.1)';
                        colorBorde = '#BF5AF2'; 
                        colorTexto = '#BF5AF2';
                        etiqueta = 'EN TRÁNSITO';
                        brillo = 'inset 0 0 10px rgba(191, 90, 242, 0.3)';
                    } 
                    else if (ticketInfo.estado === 'reservado') {
                        //  RESERVADO
                        colorFondo = 'rgba(255, 214, 10, 0.1)';
                        colorBorde = '#FFD60A'; 
                        etiqueta = 'RESERVADO';
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

        // Clics para Inspección
        document.querySelectorAll('.cajon-admin').forEach(btn => {
            btn.addEventListener('click', () => {
                const cajonSeleccionado = btn.getAttribute('data-cajon');
                const datos = infoPorCajon[cajonSeleccionado];
                if (datos) {
                    mostrarInfo(datos);
                } else {
                    const idSensor = equivalencias[cajonSeleccionado];
                    if (adminEstadoFisico[idSensor] === 'ocupado') {
                        infoVehiculo.innerHTML = `<div style="text-align:center; padding:1.5rem; color:#FF9500;"><h3>⚠️ Vehículo Obstructor</h3><p>Hay un auto físicamente en el cajón, pero no existe un ticket activo. Revise las cámaras y aplique el protocolo de seguridad.</p></div>`;
                    } else {
                        infoVehiculo.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted);"><p>Cajón vacío y sin reservas.</p></div>`;
                    }
                }
            });
        });
    }

    // --- 5. PUENTE RMI: Conexión con Pyro4 mediante Python Local ---
    const btnRMI = document.getElementById('btn-auditoria-rmi');
    if(btnRMI) {
        btnRMI.addEventListener('click', async () => {
            btnRMI.textContent = "Consultando Servidor RMI...";
            try {
                // Hacemos una petición al programita invisible en tu computadora
                const respuesta = await fetch('http://localhost:8000/rmi');
                const datos = await respuesta.json();
                
                if (datos.status === "success") {
                    alert("RESPUESTA DEL SERVIDOR:\n\n" + datos.data);
                } else {
                    alert("Error en RMI:\n" + datos.data);
                }
            } catch (e) {
                alert("⚠️ No se pudo conectar.");
            }
            btnRMI.textContent = "Auditoría Remota";
        });
    }

    function mostrarInfo(datos) {
        let tiempoVivo = '<span style="color: var(--text-muted); font-size: 1.1rem;">Aún en tránsito</span>';
        if (datos.timestampIngresoFisico) {
            const minutos = Math.floor((new Date().getTime() - datos.timestampIngresoFisico) / 60000);
            tiempoVivo = `<span style="color: #FFFFFF; font-weight: bold; font-size: 1.4rem;">${minutos} <small style="font-size: 0.9rem; color: var(--text-muted);">min</small></span>`;
        }

        infoVehiculo.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1.2rem; width: 100%;">
                <div style="border-bottom: 1px dashed var(--border-dark); padding-bottom: 0.5rem;">
                    <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Estado del Ticket</span><br>
                    <strong style="color: ${datos.estado === 'multado' ? '#FF00FF' : 'var(--spot-selected)'}; font-size: 1.3rem; text-transform: uppercase;">${datos.estado}</strong>
                </div>
                <div style="border-bottom: 1px dashed var(--border-dark); padding-bottom: 0.5rem;">
                    <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Cajón / Código</span><br>
                    <strong style="color: #fff; font-size: 1.2rem;">${datos.cajon} <span style="color: var(--text-muted); font-size: 1rem;">(${datos.id})</span></strong>
                </div>
                <div>
                    <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Tiempo Estacionado</span><br>
                    ${tiempoVivo}
                </div>
            </div>
        `;
    }

    // --- 6. BOTONES DE EMERGENCIA (HARDWARE) ---
    const btnEmergenciaEntrada = document.getElementById('btn-emergencia-entrada');
    const btnEmergenciaSalida = document.getElementById('btn-emergencia-salida');

    if(btnEmergenciaEntrada) {
        btnEmergenciaEntrada.addEventListener('click', () => {
            if(confirm("🚨 ¿Estás seguro de forzar la apertura de la pluma de ENTRADA?")) {
                set(ref(db, 'control_plumas/entrada'), 'abrir');
            }
        });
    }

    if(btnEmergenciaSalida) {
        btnEmergenciaSalida.addEventListener('click', () => {
            if(confirm("🚨 ¿Estás seguro de forzar la apertura de la pluma de SALIDA?")) {
                set(ref(db, 'control_plumas/salida'), 'abrir');
            }
        });
    }

    // --- 7. FASE 5: BUSCADOR INTELIGENTE Y PLAN B (Celular Apagado) ---
    const inputBusqueda = document.getElementById('input-busqueda-admin');
    const btnBuscar = document.getElementById('btn-buscar-admin');
    const divResultado = document.getElementById('resultado-busqueda');

    if (btnBuscar && inputBusqueda) {
        btnBuscar.addEventListener('click', () => {
            const query = inputBusqueda.value.trim().toUpperCase();
            
            if (!query) {
                alert("Por favor ingresa una placa o código.");
                return;
            }

            btnBuscar.textContent = "Buscando...";
            divResultado.classList.add('oculto');
            
            // Buscamos en nuestra variable local de tickets activos (adminTicketsActivos)
            let ticketEncontrado = null;
            let idTicketEncontrado = null;

            for (let id in adminTicketsActivos) {
                const t = adminTicketsActivos[id];
                if (id === query || (t.placa && t.placa === query)) {
                    ticketEncontrado = t;
                    idTicketEncontrado = id;
                    break;
                }
            }

            setTimeout(() => {
                btnBuscar.textContent = "Buscar Cliente";
                divResultado.classList.remove('oculto');

                if (!ticketEncontrado) {
                    divResultado.innerHTML = `<p style="color: var(--danger-neon); text-align: center; margin: 0; font-weight: bold;">❌ No se encontró ningún vehículo activo con esa placa o código.</p>`;
                    return;
                }

                // Si lo encontramos, evaluamos su estado financiero
                let colorEstado = "#32D74B"; // Verde por defecto
                let accionHTML = "";
                let mensajeDeuda = "Todo pagado";

                if (ticketEncontrado.estado === 'multado') {
                    colorEstado = "#FF00FF"; // Magenta
                    mensajeDeuda = `DEBE MULTA: $${ticketEncontrado.pagoMulta} MXN`;
                    accionHTML = `
                        <button class="btn-resolver-plan-b" data-id="${idTicketEncontrado}" style="background: #FF00FF; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 10px; width: 100%;">
                            💵 Cobrar Multa en Efectivo y Abrir Salida
                        </button>`;
                } else if (ticketEncontrado.estado === 'en_uso' || ticketEncontrado.estado === 'reservado') {
                    colorEstado = "#FFD60A"; // Amarillo
                    mensajeDeuda = "Ticket en curso (Aún no cobra salida)";
                    accionHTML = `
                        <button class="btn-abrir-plan-b" data-id="${idTicketEncontrado}" style="background: transparent; border: 1px solid var(--spot-selected); color: var(--spot-selected); padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 10px; width: 100%;">
                            🚨 Forzar Apertura de Salida
                        </button>`;
                } else if (ticketEncontrado.estado === 'pagado') {
                    accionHTML = `
                        <button class="btn-abrir-plan-b" data-id="${idTicketEncontrado}" style="background: var(--success-neon); color: black; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 10px; width: 100%;">
                            ✅ Ya pagó. Abrir Pluma de Salida
                        </button>`;
                }

                divResultado.innerHTML = `
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <p style="margin: 0; color: var(--text-muted); font-size: 0.8rem;">CLIENTE ENCONTRADO</p>
                            <strong style="color: white; font-size: 1.1rem;">${ticketEncontrado.nombre}</strong><br>
                            <span style="color: var(--spot-selected); font-family: monospace;">${idTicketEncontrado}</span> | Placa: <strong>${ticketEncontrado.placa}</strong>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; color: var(--text-muted); font-size: 0.8rem;">ESTADO FINANCIERO</p>
                            <strong style="color: ${colorEstado};">${mensajeDeuda}</strong><br>
                            <span style="color: white; font-size: 0.85rem;">Cajón: ${ticketEncontrado.cajon}</span>
                        </div>
                    </div>
                    ${accionHTML}
                `;

                // Agregamos eventos a los botones generados
                const btnResolver = divResultado.querySelector('.btn-resolver-plan-b');
                if (btnResolver) {
                    btnResolver.addEventListener('click', () => {
                        if(confirm("¿Confirmas que recibiste el pago en efectivo y deseas abrir la pluma de SALIDA?")) {
                            set(ref(db, `tickets_activos/${idTicketEncontrado}/estado`), 'pagado');
                            set(ref(db, 'control_plumas/salida'), 'abrir');
                            alert("✅ Pago registrado. Abriendo pluma...");
                            divResultado.innerHTML = `<p style="color: var(--success-neon); text-align: center;">Pluma abierta y pago resuelto.</p>`;
                        }
                    });
                }

                const btnAbrir = divResultado.querySelector('.btn-abrir-plan-b');
                if (btnAbrir) {
                    btnAbrir.addEventListener('click', () => {
                        if(confirm("¿Confirmas abrir la pluma de SALIDA manualmente para este vehículo?")) {
                            set(ref(db, 'control_plumas/salida'), 'abrir');
                            alert("✅ Abriendo pluma de salida...");
                        }
                    });
                }

            }, 800); // Pequeño efecto de búsqueda
        });
    }

});