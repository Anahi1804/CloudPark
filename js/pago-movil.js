// js/pago-movil.js
import { db, ref, onValue, update } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const ticketGuardado = localStorage.getItem('ticketActual');
    if (!ticketGuardado) {
        alert("No tienes ninguna estancia activa.");
        window.location.href = 'dashboard.html';
        return;
    }

    const ticketLocal = JSON.parse(ticketGuardado);
    const codigoTicket = ticketLocal.codigo;

    const relojUI = document.getElementById('reloj-tiempo');
    const montoUI = document.getElementById('monto-total');
    const formPago = document.getElementById('form-pago-simulado');
    const btnProcesar = document.getElementById('btn-procesar-pago');

    let totalAPagar = 0;
    let intervaloReloj;
    let hardwareListenerActivo = false;

    const ticketRef = ref(db, 'tickets_activos/' + codigoTicket);
    
    onValue(ticketRef, (snapshot) => {
        const ticketFisico = snapshot.val();

        if (!ticketFisico) {
            clearInterval(intervaloReloj);
            relojUI.textContent = "00:00";
            montoUI.innerHTML = `$0.00 <span style="font-size: 1rem; color: var(--text-muted); font-weight: 400;">MXN</span>`;
            return;
        }

        // Caso A: El usuario ya pagó el apartado, pero AÚN NO ENTRA por la pluma
        if (ticketFisico.estado === "reservado") {
            relojUI.textContent = "En camino";
            relojUI.style.fontSize = "2.5rem";
            montoUI.innerHTML = `Esperando ingreso...`;
            btnProcesar.disabled = true;
            return;
        }

        // Caso B: El usuario ya pagó su salida
        if (ticketFisico.estado === "pagado") {
            clearInterval(intervaloReloj);
            relojUI.textContent = "PAGADO";
            relojUI.style.color = "var(--spot-available)";
            montoUI.innerHTML = `¡Tienes 15 min para salir!`;
            montoUI.style.color = "var(--spot-available)";
            formPago.innerHTML = `
                <div style="text-align: center; padding: 2rem 0;">
                    <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="var(--spot-available)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    <h3 style="margin: 0; color: #FFFFFF;">Estancia Liquidada</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 5px;">Escanea tu código en la pluma de salida.</p>
                </div>
            `;
            return;
        }

        // Caso C: Ya cruzó la pluma, pero ¿ya se estacionó?
        if (ticketFisico.estado === "en_uso") {
            
            // Sub-caso C1: Aún no se ha estacionado (No hay timestamp)
            if (!ticketFisico.timestampIngresoFisico) {
                relojUI.textContent = "Manejando";
                relojUI.style.fontSize = "2rem";
                montoUI.innerHTML = `Dirígete al cajón ${ticketFisico.cajon}`;
                btnProcesar.disabled = true;

                // Empezamos a espiar al sensor del ESP32 para ver cuándo se estaciona
                if (!hardwareListenerActivo) {
                    hardwareListenerActivo = true;
                    const equivalencias = {
                        'A1': 'cajon_1', 'A2': 'cajon_2', 'A3': 'cajon_3',
                        'B1': 'cajon_4', 'B2': 'cajon_5', 'B3': 'cajon_6'
                    };
                    const cajonIdHardware = equivalencias[ticketFisico.cajon];
                    const sensorRef = ref(db, `estacionamiento_actual/${cajonIdHardware}`);
                    
                    // Escuchamos solo el sensor del cajón asignado
                    onValue(sensorRef, (sensorSnap) => {
                        const estadoCajon = sensorSnap.val();
                        if (estadoCajon === "ocupado" && !ticketFisico.timestampIngresoFisico) {
                            // ¡El ESP32 detectó el auto! Guardamos la hora de inicio en Firebase
                            console.log("¡Auto detectado en el cajón! Iniciando reloj...");
                            update(ticketRef, { timestampIngresoFisico: new Date().getTime() });
                        }
                    });
                }
                return; // Pausamos aquí hasta que el hardware cambie
            }

            // Sub-caso C2: ¡Ya se estacionó! Arrancamos el cronómetro y el cobro
            clearInterval(intervaloReloj); 
            relojUI.style.fontSize = "3.5rem";
            montoUI.style.color = "var(--danger-neon)";
            btnProcesar.disabled = false;

            intervaloReloj = setInterval(() => {
                const ahora = new Date().getTime();
                const milisegundosAdentro = ahora - ticketFisico.timestampIngresoFisico;
                
                const minutosReales = Math.floor(milisegundosAdentro / 1000);
                
                const horasUI = Math.floor(minutosReales / 60).toString().padStart(2, '0');
                const minutosUI = (minutosReales % 60).toString().padStart(2, '0');
                relojUI.textContent = `${horasUI}:${minutosUI}`;

                // --- NUEVA MATEMÁTICA: COBRO POR HORA FRACCIONADA ---
                // Math.ceil() redondea siempre hacia arriba. Ej: 1.1 horas = 2 horas a cobrar.
                // Math.max(1, ...) asegura que mínimo se cobre 1 hora apenas te estacionas.
                let horasACobrar = Math.max(1, Math.ceil(minutosReales / 60));
                
                // Si justo entra (minuto 0), horasACobrar será 1.
                totalAPagar = horasACobrar * 25.00;
                
                montoUI.innerHTML = `$${totalAPagar.toFixed(2)} <span style="font-size: 1rem; color: var(--text-muted); font-weight: 400;">MXN</span><br><span style="font-size: 0.8rem; color: var(--text-muted);">(${horasACobrar} hr cobrada)</span>`;
                
            }, 1000);
        }
    });

    // Procesar el pago (Simulado)
    formPago.addEventListener('submit', (e) => {
        e.preventDefault();
        btnProcesar.disabled = true;
        btnProcesar.textContent = "Procesando con banco...";

        setTimeout(() => {
            update(ticketRef, { 
                estado: "pagado",
                totalLiquidado: totalAPagar,
                timestampPagado: new Date().getTime() // NUEVO: Sellamos la hora exacta
            }).then(() => console.log("Pago registrado en la nube."));
        }, 2000);
        
    });
});