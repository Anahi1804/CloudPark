// js/admin.js
import { auth, firestoreDB, db, onAuthStateChanged, collection, getDocs, ref, onValue } from './firebase-config.js';

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
// Extraemos los pagos desglosados
                const pagoBase = Number(ticket.totalLiquidado) || 0;
                const pagoMulta = Number(ticket.recargoMulta) || 0;
                const granTotal = Number(ticket.granTotal) || (pagoBase + pagoMulta);

                totalTickets++;
                totalDinero += granTotal; // Sumamos el Gran Total a las ganancias de hoy

                const nombreCliente = ticket.nombre || "Cliente Web";
                const placaCliente = ticket.placa || "N/A";
                
                let tiempoTexto = "-- min";
                if (ticket.timestampIngresoFisico && ticket.timestampSalida) {
                    const min = Math.ceil((ticket.timestampSalida - ticket.timestampIngresoFisico) / 60000);
                    tiempoTexto = `${min} min`;
                }

                // Armamos el texto visual del dinero
                let uiDinero = `<span style="color: var(--success-neon);">$${pagoBase.toFixed(2)}</span>`;
                if (pagoMulta > 0) {
                    uiDinero += `<br><span style="font-size: 0.8rem; color: var(--danger-neon);">+ $${pagoMulta.toFixed(2)} multa</span>`;
                }

                htmlTabla += `
                    <tr>
                        <td style="font-family: monospace; color: var(--spot-selected);">${doc.id.substring(0,8)}...</td>
                        <td><strong>${nombreCliente}</strong><br><span style="font-size: 0.8rem; color: var(--text-muted);">${placaCliente}</span></td>
                        <td><strong>${ticket.cajon}</strong></td>
                        <td>${tiempoTexto}</td>
                        <td style="font-weight: bold;">${uiDinero}</td>
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

    // --- 3. REALTIME DB: Monitor de Cajones en Vivo ---
// --- 3. REALTIME DB: Monitor de Cajones en Vivo ---
    const ticketsRef = ref(db, 'tickets_activos');
    
    onValue(ticketsRef, (snapshot) => {
        const ticketsActivos = snapshot.val() || {};
        
        let htmlMapa = `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">`;
        const todosLosCajones = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];
        
        const cajonesOcupados = {};
        for (let id in ticketsActivos) {
            cajonesOcupados[ticketsActivos[id].cajon] = { id: id, ...ticketsActivos[id] };
        }

        todosLosCajones.forEach(cajon => {
            const info = cajonesOcupados[cajon];
            
            if (info) {
                // NUEVOS COLORES: Naranja(Reserva), Azul(En Uso), Verde(Pagado), Magenta(Multado)
                let colorBorder = '#FFA500'; 
                if (info.estado === 'en_uso') colorBorder = 'var(--spot-selected)';
                if (info.estado === 'pagado') colorBorder = 'var(--success-neon)';
                if (info.estado === 'multado') colorBorder = '#FF00FF'; // ¡Magenta Neón!
                
                htmlMapa += `
                    <div class="cajon-admin" data-cajon="${cajon}" style="background: rgba(255,255,255,0.05); border: 2px solid ${colorBorder}; border-radius: 8px; padding: 1rem; text-align: center; cursor: pointer;">
                        <strong style="color: #fff; font-size: 1.2rem;">${cajon}</strong><br>
                        <span style="font-size: 0.7rem; color: ${colorBorder}; text-transform: uppercase; font-weight: bold;">${info.estado}</span>
                    </div>
                `;
            } else {
                htmlMapa += `
                    <div style="background: rgba(255,255,255,0.02); border: 1px dashed var(--border-dark); border-radius: 8px; padding: 1rem; text-align: center; opacity: 0.5;">
                        <strong style="color: var(--text-muted); font-size: 1.2rem;">${cajon}</strong><br>
                        <span style="font-size: 0.7rem; color: var(--text-muted);">LIBRE</span>
                    </div>
                `;
            }
        });
        htmlMapa += `</div>`;
        mapaContainer.innerHTML = htmlMapa;

        // 4. Agregar la función de "Espiar" al hacer clic (¡Con UI arreglada!)
        document.querySelectorAll('.cajon-admin').forEach(btn => {
            btn.addEventListener('click', () => {
                const cajonSeleccionado = btn.getAttribute('data-cajon');
                const datos = cajonesOcupados[cajonSeleccionado];
                
                if (datos) {
                    let tiempoVivo = '<span style="color: var(--text-muted); font-size: 1.1rem;">Aún en tránsito</span>';
                    if (datos.timestampIngresoFisico) {
                        const minutos = Math.floor((new Date().getTime() - datos.timestampIngresoFisico) / 60000);
                        tiempoVivo = `<span style="color: #FFFFFF; font-weight: bold; font-size: 1.4rem;">${minutos} <small style="font-size: 0.9rem; color: var(--text-muted);">min</small></span>`;
                    }

                    // Reconstruimos la tarjeta en bloques hacia abajo para que no se aplaste
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
                            <div style="border-bottom: 1px dashed var(--border-dark); padding-bottom: 0.5rem;">
                                <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Cliente / Placa</span><br>
                                <strong style="color: #fff; font-size: 1.1rem;">${datos.usuario || 'Desconocido'} <span style="color: var(--spot-selected); font-family: monospace;">[${datos.placa || 'S/N'}]</span></strong>
                            </div>
                            <div>
                                <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Tiempo Estacionado</span><br>
                                ${tiempoVivo}
                            </div>
                        </div>
                    `;
                }
            });
        });
    });

    // --- 5. PARCHE DE SERVIDOR: El Admin vigila los sensores físicos ---
    // Esto resuelve el problema de depender del celular del usuario (Fase 3)
    const hardwareRef = ref(db, 'estacionamiento_actual');
    onValue(hardwareRef, async (sensorSnap) => {
        const sensores = sensorSnap.val() || {};
        const equivalencias = { 'cajon_1': 'A1', 'cajon_2': 'A2', 'cajon_3': 'A3', 'cajon_4': 'B1', 'cajon_5': 'B2', 'cajon_6': 'B3' };
        
        // Obtenemos los tickets actuales una vez cada que un sensor se mueve
        import('./firebase-config.js').then(module => {
            module.get(ref(db, 'tickets_activos')).then(snapTickets => {
                const tickets = snapTickets.val() || {};
                
                for (let codigo in tickets) {
                    const ticket = tickets[codigo];
                    // Si ya pasó la pluma pero no ha iniciado su reloj...
                    if (ticket.estado === "en_uso" && !ticket.timestampIngresoFisico) {
                        const idSensorFisico = Object.keys(equivalencias).find(key => equivalencias[key] === ticket.cajon);
                        
                        // Si el sensor que le toca dice "ocupado", el Admin inicia el reloj por él
                        if (idSensorFisico && sensores[idSensorFisico] === "ocupado") {
                            console.log(`[Admin Automático] Vehículo detectado en ${ticket.cajon}. Iniciando reloj.`);
                            module.update(ref(db, `tickets_activos/${codigo}`), { 
                                timestampIngresoFisico: new Date().getTime() 
                            });
                        }
                    }
                }
            });
        });
    });
});