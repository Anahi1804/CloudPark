// js/pago-movil.js - Optimizado con soporte completo para Safari / iOS y conteo 24/7
import { db, ref, onValue, get, update, auth, firestoreDB, onAuthStateChanged, collection, getDocs, PARKIL_CONFIG } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const userAtStart = await new Promise(resolve => {
        const unsubscribe = onAuthStateChanged(auth, user => { unsubscribe(); resolve(user); });
    });
    if (!userAtStart) { window.location.href = '../index.html'; return; }
    const ticketKey = `ticketActual:${userAtStart.uid}`;
    const ticketGuardado = localStorage.getItem(ticketKey);
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
    let ticketActualData = null;
    let totalAPagar = 0;
    let intervaloReloj = null;
    let sensorUnsubscribe = null;
    let esPagoMulta = false;

    let historicoReserva = 0;
    let historicoEstacionamiento = 0;
    let historicoMulta = 0;

    const ticketRef = ref(db, 'tickets_activos/' + codigoTicket);

    // 1. Cargar sesión y billetera
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

            snapshot.forEach((docSnap) => {
                const t = docSnap.data();
                const ultimosCuatro = t.numero.slice(-4);
                const opcion = document.createElement('option');
                opcion.value = t.numero;
                opcion.textContent = `💳 ${t.nombreCard} (**** ${ultimosCuatro})`;
                selectorTarjetas.appendChild(opcion);
            });

            if (ticketActualData && (ticketActualData.timestampIngresoFisico || esPagoMulta)) {
                btnProcesar.disabled = false;
            }
        } catch (error) {
            console.error("Error al cargar tarjetas:", error);
            selectorTarjetas.innerHTML = '<option value="">Error al cargar billetera</option>';
        }
    }

    // 2. Función pura de cálculo de tiempo (Funciona en Safari/iOS y tras apagar celular 8 hrs)
    function renderizarTickReloj() {
        if (!ticketActualData) return;

        const ahora = Date.now();
        const tarifaHora = Number(ticketActualData.tarifaHora) || PARKIL_CONFIG.TARIFA_HORA_DEFAULT;
        const divisorTiempo = PARKIL_CONFIG.MODO_DEMO ? 1000 : 60000; // Demo: 1 seg = 1 min | Real: 60 seg = 1 min

        if (ticketActualData.estado === "multado") {
            const inicioMulta = (ticketActualData.timestampPagado || ahora) + PARKIL_CONFIG.TOLERANCIA_SALIDA_MS;
            const msRetraso = Math.max(0, ahora - inicioMulta);
            const unidadesRetraso = Math.floor(msRetraso / divisorTiempo);

            const horasUI = Math.floor(unidadesRetraso / 60).toString().padStart(2, '0');
            const minUI = (unidadesRetraso % 60).toString().padStart(2, '0');
            relojUI.textContent = `+ ${horasUI}:${minUI} extra`;

            const horasMulta = Math.max(1, Math.ceil(unidadesRetraso / 60));
            totalAPagar = horasMulta * tarifaHora;

            montoUI.innerHTML = `Recargo: $${totalAPagar.toFixed(2)} <span style="font-size: 1rem; color: var(--text-muted);">MXN</span>`;
            btnProcesar.textContent = `Pagar Recargo ($${totalAPagar.toFixed(2)})`;
            btnProcesar.style.background = "linear-gradient(135deg, #FF453A 0%, #8A0000 100%)";
            return;
        }

        if (ticketActualData.estado === "en_uso" && ticketActualData.timestampIngresoFisico) {
            const msAdentro = Math.max(0, ahora - Number(ticketActualData.timestampIngresoFisico));
            const unidadesAdentro = Math.floor(msAdentro / divisorTiempo);

            const horasUI = Math.floor(unidadesAdentro / 60).toString().padStart(2, '0');
            const minutosUI = (unidadesAdentro % 60).toString().padStart(2, '0');
            relojUI.textContent = `${horasUI}:${minutosUI}`;

            const horasACobrar = Math.max(1, Math.ceil(unidadesAdentro / 60));
            totalAPagar = horasACobrar * tarifaHora;

            montoUI.innerHTML = `$${totalAPagar.toFixed(2)} <span style="font-size: 1rem; color: var(--text-muted); font-weight: 400;">MXN</span><br><span style="font-size: 0.8rem; color: var(--text-muted);">(${horasACobrar} hr cobrada a $${tarifaHora}/hr)</span>`;
        }
    }

    // 3. Procesar estado del ticket
    function procesarTicket(ticketFisico) {
        ticketActualData = ticketFisico;

        if (!ticketFisico) {
            clearInterval(intervaloReloj);
            relojUI.textContent = "00:00";
            montoUI.innerHTML = `$0.00 <span style="font-size: 1rem; color: var(--text-muted); font-weight: 400;">MXN</span>`;
            return;
        }

        historicoReserva = Number(ticketFisico.pagoReserva) || 0;
        historicoEstacionamiento = Number(ticketFisico.pagoEstacionamiento) || 0;
        historicoMulta = Number(ticketFisico.pagoMulta) || 0;

        // Caso A: Reservado (Aún no cruza pluma de entrada)
        if (ticketFisico.estado === "reservado") {
            clearInterval(intervaloReloj);
            relojUI.textContent = "En camino";
            relojUI.style.fontSize = "2.5rem";
            montoUI.innerHTML = `Valida tu código en la pluma de entrada`;
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
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 5px;">Escanea tu código <strong>${codigoTicket}</strong> en la pluma de salida.</p>
                </div>
            `;
            return;
        }

        // Caso C: Multado
        if (ticketFisico.estado === "multado") {
            esPagoMulta = true;
            clearInterval(intervaloReloj);
            relojUI.style.fontSize = "2.8rem";
            relojUI.style.color = "var(--danger-neon)";
            if (selectorTarjetas.options.length > 1) btnProcesar.disabled = false;

            renderizarTickReloj();
            intervaloReloj = setInterval(renderizarTickReloj, 1000);
            return;
        }

        // Caso D: En Uso
        if (ticketFisico.estado === "en_uso") {
            esPagoMulta = false;

            if (!ticketFisico.timestampIngresoFisico) {
                clearInterval(intervaloReloj);
                relojUI.textContent = "Manejando";
                relojUI.style.fontSize = "2rem";
                montoUI.innerHTML = `Dirígete al cajón <strong>${ticketFisico.cajon}</strong>`;
                btnProcesar.disabled = true;

                const cajonIdHardware = ticketFisico.sensorFisico || PARKIL_CONFIG.SENSORES_MAQUETA[ticketFisico.cajon];
                if (cajonIdHardware && !sensorUnsubscribe) {
                    const sensorRef = ref(db, `estacionamiento_actual/${cajonIdHardware}`);
                    sensorUnsubscribe = onValue(sensorRef, (sensorSnap) => {
                        const estadoCajon = sensorSnap.val();
                        if (estadoCajon && String(estadoCajon).trim().toLowerCase() === "ocupado") {
                            update(ticketRef, { timestampIngresoFisico: Date.now() });
                        }
                    });
                }
                return;
            }

            // ¡Ya hay timestampIngresoFisico! Arrancamos el reloj de inmediato
            clearInterval(intervaloReloj);
            relojUI.style.fontSize = "3.5rem";
            relojUI.style.color = "#FFFFFF";
            montoUI.style.color = "var(--danger-neon)";

            if (selectorTarjetas.options.length > 1) btnProcesar.disabled = false;
            btnProcesar.textContent = "Pagar y Liberar Salida";
            btnProcesar.style.background = "linear-gradient(135deg, #0A84FF 0%, #005BB5 100%)";

            renderizarTickReloj();
            intervaloReloj = setInterval(renderizarTickReloj, 1000);
        }
    }

    // Escucha en tiempo real de Firebase
    onValue(ticketRef, (snapshot) => {
        procesarTicket(snapshot.val());
    });

    // --- PARCHE DEFINITIVO SAFARI / iOS AL DESBLOQUEAR EL IPHONE ---
    async function sincronizarAlDespertar() {
        try {
            const snapTicket = await get(ticketRef);
            if (!snapTicket.exists()) return;
            const datos = snapTicket.val();

            // Si sigue esperando sensor físico, verificamos si el sensor ya se ocupó mientras el iPhone estaba bloqueado
            if (datos.estado === "en_uso" && !datos.timestampIngresoFisico) {
                const cajonIdHardware = datos.sensorFisico || PARKIL_CONFIG.SENSORES_MAQUETA[datos.cajon];
                if (cajonIdHardware) {
                    const snapSensor = await get(ref(db, `estacionamiento_actual/${cajonIdHardware}`));
                    if (snapSensor.exists() && String(snapSensor.val()).trim().toLowerCase() === "ocupado") {
                        const nuevoTimestamp = Date.now();
                        await update(ticketRef, { timestampIngresoFisico: nuevoTimestamp });
                        datos.timestampIngresoFisico = nuevoTimestamp;
                    }
                }
            }
            procesarTicket(datos);
        } catch (err) {
            console.error("Error al resincronizar en iOS:", err);
        }
    }

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") sincronizarAlDespertar();
    });
    window.addEventListener("pageshow", sincronizarAlDespertar);
    window.addEventListener("focus", sincronizarAlDespertar);

    // 4. Procesar el pago con el simulador bancario
    formPago.addEventListener('submit', (e) => {
        e.preventDefault();

        const numTarjetaSeleccionada = selectorTarjetas.value;
        if (!numTarjetaSeleccionada) {
            alert("Por favor selecciona una tarjeta para proceder con el pago.");
            return;
        }

        btnProcesar.disabled = true;
        btnProcesar.textContent = "Procesando con banco...";

        setTimeout(() => {
            if (numTarjetaSeleccionada.endsWith('0000')) {
                alert("❌ BANCO RECHAZA: Fondos insuficientes en la tarjeta terminación 0000.");
                btnProcesar.disabled = false;
                btnProcesar.textContent = esPagoMulta ? `Pagar Recargo ($${totalAPagar.toFixed(2)})` : "Pagar y Liberar Salida";
                return;
            }
            if (numTarjetaSeleccionada.endsWith('1111')) {
                alert("❌ BANCO DECLINA: Tarjeta terminación 1111 bloqueada por seguridad.");
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
                timestampPagado: Date.now()
            }).then(() => console.log("Pago registrado con éxito."));
        }, 1200);
    });
});
