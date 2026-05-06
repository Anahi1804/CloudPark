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
                const ticket = doc.data();
                totalTickets++;
                totalDinero += Number(ticket.totalLiquidado) || 0; // Sumamos el dinero

                htmlTabla += `
                    <tr>
                        <td style="font-family: monospace; color: var(--spot-selected);">${doc.id}</td>
                        <td><strong>${ticket.cajon}</strong></td>
                        <td style="font-size: 0.85rem; color: var(--text-muted);">${ticket.fechaSalidaFisica || 'N/A'}</td>
                        <td style="color: var(--success-neon); font-weight: bold;">$${Number(ticket.totalLiquidado || 0).toFixed(2)}</td>
                        <td><span class="badge-pagado">Completado</span></td>
                    </tr>
                `;
            });

            if (totalTickets === 0) {
                htmlTabla = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No hay tickets liquidados aún.</td></tr>`;
            }

            tablaBody.innerHTML = htmlTabla;
            statTickets.textContent = totalTickets;
            statIngresos.textContent = `$${totalDinero.toFixed(2)}`;

        } catch (error) {
            console.error("Error al cargar historial:", error);
            tablaBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger-neon);">Error al cargar los datos.</td></tr>`;
        }
    }

    cargarHistorial();

    // --- 3. REALTIME DB: Monitor de Cajones en Vivo ---
    const ticketsRef = ref(db, 'tickets_activos');
    
    onValue(ticketsRef, (snapshot) => {
        const ticketsActivos = snapshot.val() || {};
        
        // Armamos un mini mapa de 6 lugares
        let htmlMapa = `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">`;
        const todosLosCajones = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];
        
        // Mapeamos qué cajón está ocupado por quién
        const cajonesOcupados = {};
        for (let id in ticketsActivos) {
            cajonesOcupados[ticketsActivos[id].cajon] = { id: id, ...ticketsActivos[id] };
        }

        todosLosCajones.forEach(cajon => {
            const info = cajonesOcupados[cajon];
            
            if (info) {
                // Colores: Naranja (Reservado), Rojo (En uso), Verde (Pagado)
                let colorBorder = info.estado === 'en_uso' ? 'var(--danger-neon)' : 
                                  info.estado === 'pagado' ? 'var(--success-neon)' : '#FFA500';
                
                htmlMapa += `
                    <div class="cajon-admin" data-cajon="${cajon}" style="background: rgba(255,255,255,0.05); border: 2px solid ${colorBorder}; border-radius: 8px; padding: 1rem; text-align: center; cursor: pointer;">
                        <strong style="color: #fff; font-size: 1.2rem;">${cajon}</strong><br>
                        <span style="font-size: 0.7rem; color: ${colorBorder}; text-transform: uppercase;">${info.estado}</span>
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

        // 4. Agregar la función de "Espiar" al hacer clic
        document.querySelectorAll('.cajon-admin').forEach(btn => {
            btn.addEventListener('click', () => {
                const cajonSeleccionado = btn.getAttribute('data-cajon');
                const datos = cajonesOcupados[cajonSeleccionado];
                
                if (datos) {
                    infoVehiculo.innerHTML = `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px dashed var(--border-dark); padding-bottom: 10px;">
                            <span style="color: var(--text-muted);">Estado Actual:</span>
                            <strong style="color: var(--spot-selected); text-transform: uppercase;">${datos.estado}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span style="color: var(--text-muted);">Cajón Ocupado:</span>
                            <strong style="color: #fff;">${datos.cajon}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span style="color: var(--text-muted);">Código de Ticket:</span>
                            <strong style="font-family: monospace; color: #fff;">${datos.id}</strong>
                        </div>
                    `;
                }
            });
        });
    });
});