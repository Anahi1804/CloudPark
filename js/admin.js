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

            // 🚨 LÓGICA CLASIFICADORA DEL ADMIN
            if (estadoSensor === 'ocupado') {
                if (!ticketInfo || ticketInfo.estado === 'reservado') {
                    // 🟠 OBSTRUIDO: Hay auto físico, pero el sistema no reconoce un ticket válido cruzando la caseta
                    colorFondo = 'rgba(255, 149, 0, 0.15)'; 
                    colorBorde = '#FF9500';
                    colorTexto = '#FF9500';
                    etiqueta = 'OBSTRUIDO';
                    brillo = 'inset 0 0 15px rgba(255, 149, 0, 0.5)';
                } else {
                    // 🔴 OCUPADO NORMAL
                    colorFondo = 'rgba(255, 69, 58, 0.15)'; 
                    colorBorde = 'var(--danger-neon)';
                    colorTexto = 'var(--danger-neon)';
                    etiqueta = ticketInfo.estado === 'multado' ? 'MULTADO' : 'OCUPADO';
                    if(ticketInfo.estado === 'multado') colorBorde = '#FF00FF'; // Magenta multado
                }
            } else {
                if (ticketInfo) {
                    if (ticketInfo.estado === 'en_uso') {
                        // 🟣 EN CAMINO 
                        colorFondo = 'rgba(191, 90, 242, 0.1)';
                        colorBorde = '#BF5AF2'; 
                        colorTexto = '#BF5AF2';
                        etiqueta = 'EN TRÁNSITO';
                        brillo = 'inset 0 0 10px rgba(191, 90, 242, 0.3)';
                    } else if (ticketInfo.estado === 'reservado') {
                        // 🟡 RESERVADO 
                        colorFondo = 'rgba(255, 214, 10, 0.1)';
                        colorBorde = '#FFD60A'; 
                        colorTexto = '#FFD60A';
                        etiqueta = 'RESERVADO';
                    } else if (ticketInfo.estado === 'pagado') {
                        // 🟢 SALIENDO
                        colorFondo = 'rgba(50, 215, 75, 0.1)';
                        colorBorde = 'var(--success-neon)';
                        colorTexto = 'var(--success-neon)';
                        etiqueta = 'SALIENDO';
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

});