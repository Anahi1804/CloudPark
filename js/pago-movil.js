// js/pago-movil.js
import { db, ref, onValue, get, update, auth, firestoreDB, onAuthStateChanged, collection, getDocs } from './firebase-config.js';

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
    
    const selectorTarjetas = document.getElementById('selector-tarjetas');
    const alertaSinTarjetas = document.getElementById('alerta-sin-tarjetas');
    let usuarioActualUID = null;

    let totalAPagar = 0;
    let historicoPagado = 0;
    let intervaloReloj;
    let hardwareListenerActivo = false;
    let esPagoMulta = false;

    let historicoReserva = 0;
    let historicoEstacionamiento = 0;
    let historicoMulta = 0;

    const ticketRef = ref(db, 'tickets_activos/' + codigoTicket);
    
    // 1. CARGAMOS LA BILLETERA
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            usuarioActualUID = user.uid;
            await cargarTarjetasBilletera();
        } else {
            window.location.href = '../index.html';
        }
    });

    async function cargarTarjetasBilletera() {
        selectorTarjetas.innerHTML = '<option value="">Selecciona una tarjeta...</option>';
        try {
            const tarjetasRef = collection(firestoreDB, "usuarios", usuarioActualUID, "metodos_pago");
            const snapshot = await getDocs(tarjetasRef);

            if (snapshot.empty) {
                selectorTarjetas.classList.add('oculto');
                alertaSinTarjetas.classList.remove('oculto');
                btnProcesar.disabled = true;
                btnProcesar.style.opacity = '0.5';
                return;
            }

            snapshot.forEach((doc) => {
                const t = doc.data();
                const ultimosCuatro = t.numero.slice(-4);
                const opcion = document.createElement('option');
                opcion.value = t.numero; 
                opcion.textContent = `💳 ${t.nombreCard} (**** ${ultimosCuatro})`;
                selectorTarjetas.appendChild(opcion);
            });
            
            if(!esPagoMulta && totalAPagar > 0) btnProcesar.disabled = false;
        } catch (error) {
            console.error("Error al cargar tarjetas:", error);
            selectorTarjetas.innerHTML = '<option value="">Error al cargar billetera</option>';
        }
    }

    // 2. LECTURA DEL TICKET Y RELOJ
    onValue(ticketRef, (snapshot) => {
        const ticketFisico = snapshot.val();

        if (!ticketFisico) {
            clearInterval(intervaloReloj);
            relojUI.textContent = "00:00";
            montoUI.innerHTML = `$0.00 <span style="font-size: 1rem; color: var(--text-muted); font-weight: 400;">MXN</span>`;
            return;
        }

        historicoReserva = Number(ticketFisico.pagoReserva) || 0;
        historicoEstacionamiento = Number(ticketFisico.pagoEstacionamiento) || 0;
        historicoMulta = Number(ticketFisico.pagoMulta) || 0;
        historicoPagado = Number(ticketFisico.totalLiquidado) || 0;

        // Caso A: Reservado
        if (ticketFisico.estado === "reservado") {
            relojUI.textContent = "En camino";
            relojUI.style.fontSize = "2.5rem";
            montoUI.innerHTML = `Esperando ingreso...`;
            btnProcesar.disabled = true;
            return;
        }

        // Caso B: Pagado
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

        // Caso D: Multado
        if (ticketFisico.estado === "multado") {
            esPagoMulta = true;
            clearInterval(intervaloReloj);
            relojUI.style.fontSize = "3rem";
            relojUI.style.color = "var(--danger-neon)";
            if (selectorTarjetas.options.length > 1) btnProcesar.disabled = false;
            
            intervaloReloj = setInterval(() => {
                const ahora = new Date().getTime();
                const tiempoTolerancia = 30000; 
                const inicioMulta = ticketFisico.timestampPagado + tiempoTolerancia;
                
                const milisegundosRetraso = Math.max(0, ahora - inicioMulta);
                const minutosRetraso = Math.floor(milisegundosRetraso / 1000); 
                
                const horasUI = Math.floor(minutosRetraso / 60).toString().padStart(2, '0');
                const minUI = (minutosRetraso % 60).toString().padStart(2, '0');
                relojUI.textContent = `+ ${horasUI}:${minUI} extra`;

                let horasMulta = Math.max(1, Math.ceil(minutosRetraso / 60));
                totalAPagar = horasMulta * 25.00;

                montoUI.innerHTML = `Recargo: $${totalAPagar.toFixed(2)} <span style="font-size: 1rem; color: var(--text-muted);">MXN</span>`;
                btnProcesar.textContent = `Pagar Recargo ($${totalAPagar.toFixed(2)})`;
                btnProcesar.style.background = "linear-gradient(135deg, #FF453A 0%, #8A0000 100%)";
            }, 1000);
            return; 
        }

        // Caso C: En Uso (ESPERANDO SENSOR)
        if (ticketFisico.estado === "en_uso") {
            esPagoMulta = false;
            
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
                    
                    // 🍏 PARCHE SAFARI: Función para forzar la lectura del sensor
                    const verificarSensorForzado = async () => {
                        const snap = await get(sensorRef);
                        const estadoCajon = snap.val();
                        if (estadoCajon && String(estadoCajon).trim().toLowerCase() === "ocupado") {
                            update(ticketRef, { timestampIngresoFisico: new Date().getTime() });
                        }
                    };

                    // Escucha normal por si la pantalla está encendida
                    onValue(sensorRef, (sensorSnap) => {
                        const estadoCajon = sensorSnap.val();
                        if (estadoCajon && String(estadoCajon).trim().toLowerCase() === "ocupado" && !ticketFisico.timestampIngresoFisico) {
                            update(ticketRef, { timestampIngresoFisico: new Date().getTime() });
                        }
                    });

                    // 🍏 PARCHE SAFARI: Escucha de Despertar de iOS
                    document.addEventListener("visibilitychange", () => {
                        if (document.visibilityState === "visible" && !ticketFisico.timestampIngresoFisico) {
                            verificarSensorForzado();
                        }
                    });
                    window.addEventListener("focus", () => {
                        if (!ticketFisico.timestampIngresoFisico) verificarSensorForzado();
                    });
                }
                return;
            }

            // RELOJ EN MARCHA
            clearInterval(intervaloReloj); 
            relojUI.style.fontSize = "3.5rem";
            montoUI.style.color = "var(--danger-neon)";
            if (selectorTarjetas.options.length > 1) btnProcesar.disabled = false;
            
            btnProcesar.textContent = "Pagar y Liberar Salida";
            btnProcesar.style.background = "linear-gradient(135deg, #0A84FF 0%, #005BB5 100%)";

            intervaloReloj = setInterval(() => {
                const ahora = new Date().getTime();
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

    // 3. PROCESAR PAGO CON SIMULADOR BANCARIO
    formPago.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const numTarjetaSeleccionada = selectorTarjetas.value;

        if (!numTarjetaSeleccionada) {
            alert("⚠️ Por favor selecciona una tarjeta para proceder con el pago.");
            return;
        }

        btnProcesar.disabled = true;
        btnProcesar.textContent = "Procesando con banco...";

        setTimeout(() => {
            if (numTarjetaSeleccionada.endsWith('0000')) {
                alert("🏦 BANCO RECHAZA: Fondos insuficientes en la tarjeta terminación 0000.");
                btnProcesar.disabled = false;
                btnProcesar.textContent = esPagoMulta ? `Pagar Recargo ($${totalAPagar.toFixed(2)})` : "Pagar y Liberar Salida";
                return; 
            }

            if (numTarjetaSeleccionada.endsWith('1111')) {
                alert("🏦 BANCO DECLINA: Tarjeta terminación 1111 bloqueada por seguridad.");
                btnProcesar.disabled = false;
                btnProcesar.textContent = esPagoMulta ? `Pagar Recargo ($${totalAPagar.toFixed(2)})` : "Pagar y Liberar Salida";
                return; 
            }

            btnProcesar.textContent = "Aprobado. Liberando salida...";

            let nuevoEstacionamiento = historicoEstacionamiento;
            let nuevoMulta = historicoMulta;
            
            if (esPagoMulta) {
                nuevoMulta += totalAPagar; 
            } else {
                nuevoEstacionamiento += totalAPagar; 
            }

            const totalHistorico = historicoReserva + nuevoEstacionamiento + nuevoMulta;

            update(ticketRef, { 
                estado: "pagado",
                pagoEstacionamiento: nuevoEstacionamiento,
                pagoMulta: nuevoMulta,
                granTotal: totalHistorico,
                timestampPagado: new Date().getTime() 
            }).then(() => console.log("Pago registrado con éxito."));
            
        }, 1500);
    });
});