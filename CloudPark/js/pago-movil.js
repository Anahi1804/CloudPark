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
    let historicoPagado = 0;
    let intervaloReloj;
    let hardwareListenerActivo = false;
    let esPagoMulta = false;

    // NUESTRAS 3 CAJITAS GLOBALES:
    let historicoReserva = 0;
    let historicoEstacionamiento = 0;
    let historicoMulta = 0;

    const ticketRef = ref(db, 'tickets_activos/' + codigoTicket);
    
    // AQUÍ EMPIEZA LA LECTURA DONDE VIVE "ticketFisico"
    onValue(ticketRef, (snapshot) => {
        const ticketFisico = snapshot.val();

        if (!ticketFisico) {
            clearInterval(intervaloReloj);
            relojUI.textContent = "00:00";
            montoUI.innerHTML = `$0.00 <span style="font-size: 1rem; color: var(--text-muted); font-weight: 400;">MXN</span>`;
            return;
        }

        // NUEVO: Leemos las 3 cajitas financieras
        historicoReserva = Number(ticketFisico.pagoReserva) || 0;
        historicoEstacionamiento = Number(ticketFisico.pagoEstacionamiento) || 0;
        historicoMulta = Number(ticketFisico.pagoMulta) || 0;

        historicoPagado = Number(ticketFisico.totalLiquidado) || 0;

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

        // Caso D (LA MULTA): El usuario se tardó en salir y fue multado

        if (ticketFisico.estado === "multado") {
            esPagoMulta = true;
            clearInterval(intervaloReloj);
            relojUI.style.fontSize = "3rem";
            relojUI.style.color = "var(--danger-neon)";
            btnProcesar.disabled = false;
            
            intervaloReloj = setInterval(() => {
                const ahora = new Date().getTime();
                
                // Límite de prueba 30 seg (30000 ms). En producción pon 15 min (900000 ms)
                const tiempoTolerancia = 30000; 
                const inicioMulta = ticketFisico.timestampPagado + tiempoTolerancia;
                
                // Calculamos cuánto tiempo lleva ATRASADO
                const milisegundosRetraso = ahora - inicioMulta;
                const minutosRetraso = Math.floor(milisegundosRetraso / 1000); // Usamos div /1000 para simular minutos rápidos
                
                const horasUI = Math.floor(minutosRetraso / 60).toString().padStart(2, '0');
                const minUI = (minutosRetraso % 60).toString().padStart(2, '0');
                relojUI.textContent = `+ ${horasUI}:${minUI} extra`;

                // Cobramos $25 por cada hora (o fracción) de retraso
                let horasMulta = Math.max(1, Math.ceil(minutosRetraso / 60));
                totalAPagar = horasMulta * 25.00;

                montoUI.innerHTML = `Recargo: $${totalAPagar.toFixed(2)} <span style="font-size: 1rem; color: var(--text-muted);">MXN</span>`;
                btnProcesar.textContent = `Pagar Recargo ($${totalAPagar.toFixed(2)})`;
                btnProcesar.style.background = "linear-gradient(135deg, #FF453A 0%, #8A0000 100%)";
            }, 1000);
            
            return; // Detenemos aquí para que no corra el otro reloj
        }

        // Caso C: Ya cruzó la pluma, pero ¿ya se estacionó?
        if (ticketFisico.estado === "en_uso") {
            esPagoMulta = false;
            // Sub-caso C1: Aún no se ha estacionado
            if (!ticketFisico.timestampIngresoFisico) {
                relojUI.textContent = "Manejando";
                relojUI.style.fontSize = "2rem";
                montoUI.innerHTML = `Dirígete al cajón ${ticketFisico.cajon}`;
                btnProcesar.disabled = true;

                if (!hardwareListenerActivo) {
                    hardwareListenerActivo = true;
                    const equivalencias = {
                        'A1': 'cajon_1', 'A2': 'cajon_2', 'A3': 'cajon_3',
                        'B1': 'cajon_4', 'B2': 'cajon_5', 'B3': 'cajon_6'
                    };
                    const cajonIdHardware = equivalencias[ticketFisico.cajon];
                    const sensorRef = ref(db, `estacionamiento_actual/${cajonIdHardware}`);
                    
                    onValue(sensorRef, (sensorSnap) => {
                        const estadoCajon = sensorSnap.val();
                        if (estadoCajon === "ocupado" && !ticketFisico.timestampIngresoFisico) {
                            console.log("¡Auto detectado en el cajón! Iniciando reloj...");
                            update(ticketRef, { timestampIngresoFisico: new Date().getTime() });
                        }
                    });
                }
                return;
            }

            // Sub-caso C2: ¡Ya se estacionó! Arrancamos el cronómetro y el cobro
// Sub-caso C2: ¡Ya se estacionó! Arrancamos el cronómetro y el cobro
            clearInterval(intervaloReloj); 
            relojUI.style.fontSize = "3.5rem";
            montoUI.style.color = "var(--danger-neon)";
            btnProcesar.disabled = false;
            
            // Regresamos el botón a su color original por si venía de una multa
            btnProcesar.textContent = "Pagar y Liberar Salida";
            btnProcesar.style.background = "linear-gradient(135deg, #0A84FF 0%, #005BB5 100%)";

            intervaloReloj = setInterval(() => {
                const ahora = new Date().getTime();
                
                // FIX DEL "-1": Usamos Math.max(0, ...) para evitar números negativos si hay desincronización
                const milisegundosAdentro = Math.max(0, ahora - ticketFisico.timestampIngresoFisico);
                
                const minutosReales = Math.floor(milisegundosAdentro / 1000);
                
                const horasUI = Math.floor(minutosReales / 60).toString().padStart(2, '0');
                const minutosUI = (minutosReales % 60).toString().padStart(2, '0');
                relojUI.textContent = `${horasUI}:${minutosUI}`;

                let horasACobrar = Math.max(1, Math.ceil(minutosReales / 60));
                totalAPagar = horasACobrar * 25.00;
                
                montoUI.innerHTML = `$${totalAPagar.toFixed(2)} <span style="font-size: 1rem; color: var(--text-muted); font-weight: 400;">MXN</span><br><span style="font-size: 0.8rem; color: var(--text-muted);">(${horasACobrar} hr cobrada)</span>`;
                
            }, 1000);
        }
    });

    // Procesar el pago (Código Limpio sin variables duplicadas)
    formPago.addEventListener('submit', (e) => {
        e.preventDefault();
        btnProcesar.disabled = true;
        btnProcesar.textContent = "Procesando con banco...";

        setTimeout(() => {
            let nuevoEstacionamiento = historicoEstacionamiento;
            let nuevoMulta = historicoMulta;
            
            if (esPagoMulta) {
                nuevoMulta += totalAPagar; // Lo mete a la caja de multas     
            } else {
                nuevoEstacionamiento += totalAPagar; // Lo mete a la caja de tiempo normal
            }

            const totalHistorico = historicoReserva + nuevoEstacionamiento + nuevoMulta;

            update(ticketRef, { 
                estado: "pagado",
                pagoEstacionamiento: nuevoEstacionamiento,
                pagoMulta: nuevoMulta,
                granTotal: totalHistorico,
                timestampPagado: new Date().getTime() 
            }).then(() => console.log("Pago registrado con desglose perfecto."));
        }, 2000);
    });
}); // Cierre del DOMContentLoaded