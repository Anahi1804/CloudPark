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

    // --- 3. REALTIME DB: Monitor de Cajones en Vivo ---
// --- 3. REALTIME DB: Monitor de Cajones en Vivo ---
// --- 3. REALTIME DB: Dibujar el Mapa (Cajones Base) ---
    const ticketsRef = ref(db, 'tickets_activos');
    let cajonesOcupados = {}; // Variable global para guardar info
    
    onValue(ticketsRef, (snapshot) => {
        const ticketsActivos = snapshot.val() || {};
        cajonesOcupados = {}; // Limpiamos
        
        let htmlMapa = `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">`;
        const todosLosCajones = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];
        
        for (let id in ticketsActivos) cajonesOcupados[ticketsActivos[id].cajon] = { id: id, ...ticketsActivos[id] };

        todosLosCajones.forEach(cajon => {
            const info = cajonesOcupados[cajon];
            if (info) {
                let colorBorder = '#FFA500'; 
                if (info.estado === 'en_uso') colorBorder = 'var(--spot-selected)';
                if (info.estado === 'pagado') colorBorder = 'var(--success-neon)';
                if (info.estado === 'multado') colorBorder = '#FF00FF'; 
                
                // ¡CORRECCIÓN! Agregamos id="cajon-A1" para que los sensores lo encuentren
                htmlMapa += `
                    <div id="cajon-${cajon}" class="cajon-admin" data-cajon="${cajon}" style="background: rgba(255,255,255,0.05); border: 2px solid ${colorBorder}; border-radius: 8px; padding: 1rem; text-align: center; cursor: pointer; transition: all 0.3s;">
                        <strong style="color: #fff; font-size: 1.2rem;">${cajon}</strong><br>
                        <span style="font-size: 0.7rem; color: ${colorBorder}; text-transform: uppercase; font-weight: bold;">${info.estado}</span>
                    </div>
                `;
            } else {
                htmlMapa += `
                    <div id="cajon-${cajon}" style="background: rgba(255,255,255,0.02); border: 1px dashed var(--border-dark); border-radius: 8px; padding: 1rem; text-align: center; opacity: 0.5; transition: all 0.3s;">
                        <strong style="color: var(--text-muted); font-size: 1.2rem;">${cajon}</strong><br>
                        <span style="font-size: 0.7rem; color: var(--text-muted);">LIBRE</span>
                    </div>
                `;
            }
        });
        htmlMapa += `</div>`;
        mapaContainer.innerHTML = htmlMapa;

        // Configurar clics de "Espiar"
        document.querySelectorAll('.cajon-admin').forEach(btn => {
            btn.addEventListener('click', () => {
                const cajonSeleccionado = btn.getAttribute('data-cajon');
                const datos = cajonesOcupados[cajonSeleccionado];
                if (datos) mostrarInfo(datos);
            });
        });
    });

    // --- 4. MAPA EN TIEMPO REAL (Sensores Físicos encendiendo los fondos) ---
    const sensoresRef = ref(db, 'estacionamiento_actual');
    const equivalenciasSensores = {
        'cajon_1': 'A1', 'cajon_2': 'A2', 'cajon_3': 'A3', 'cajon_4': 'B1', 'cajon_5': 'B2', 'cajon_6': 'B3'
    };
    
    onValue(sensoresRef, (snapshot) => {
        const sensores = snapshot.val();
        if (!sensores) return;

        for (const [idSensor, estado] of Object.entries(sensores)) {
            const nombreCajon = equivalenciasSensores[idSensor];
            const cajonUI = document.getElementById(`cajon-${nombreCajon}`);
            
            if (cajonUI) {
                if (estado === "ocupado") {
                    cajonUI.style.backgroundColor = "rgba(255, 69, 58, 0.2)"; // Fondo rojo suave
                    cajonUI.style.boxShadow = "inset 0 0 15px rgba(255, 69, 58, 0.5)"; // Resplandor interno rojo
                } else {
                    cajonUI.style.backgroundColor = "rgba(255, 255, 255, 0.05)"; // Regresa a la normalidad
                    cajonUI.style.boxShadow = "none";
                }
            }
        }
    });

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
                    alert("✅ RESPUESTA DEL SERVIDOR RMI (PYRO4):\n\n" + datos.data);
                } else {
                    alert("❌ Error en RMI:\n" + datos.data);
                }
            } catch (e) {
                alert("⚠️ No se pudo conectar. ¿Tienes encendido el puente_rmi.py en tu computadora?");
            }
            btnRMI.textContent = "Auditoría Remota (RMI)";
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
});