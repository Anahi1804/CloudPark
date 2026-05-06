// js/pago-movil.js
import { db, ref, onValue, update } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar si hay un ticket activo en la memoria local
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

    let tarifaPorMinuto = 25.00 / 60; // $25 pesos la hora
    let totalAPagar = 0;
    let intervaloReloj;

    // 2. Conectarnos a Firebase para escuchar el ticket en tiempo real
    const ticketRef = ref(db, 'tickets_activos/' + codigoTicket);
    
    onValue(ticketRef, (snapshot) => {
        const ticketFisico = snapshot.val();

        if (!ticketFisico) {
            // Si no existe, es porque ya salió y el ticket se borró
            clearInterval(intervaloReloj);
            relojUI.textContent = "00:00";
            montoUI.innerHTML = `$0.00 <span style="font-size: 1rem; color: var(--text-muted); font-weight: 400;">MXN</span>`;
            return;
        }

        // Caso A: El usuario ya pagó el apartado, pero AÚN NO ENTRA al estacionamiento
        if (ticketFisico.estado === "reservado") {
            relojUI.textContent = "En camino";
            relojUI.style.fontSize = "2.5rem";
            montoUI.innerHTML = `Esperando ingreso...`;
            montoUI.style.fontSize = "1.2rem";
            montoUI.style.color = "var(--text-muted)";
            btnProcesar.disabled = true;
            btnProcesar.style.background = "var(--surface-hover)";
            return;
        }

        // Caso B: El usuario ya pagó su salida y está por irse
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

        // Caso C: El usuario está "en_uso" (Adentro del estacionamiento)
        if (ticketFisico.estado === "en_uso" && ticketFisico.timestampIngresoFisico) {
            // Asegurarnos de no arrancar dos relojes
            clearInterval(intervaloReloj); 
            
            // Reajustar UI por si venía del estado "En camino"
            relojUI.style.fontSize = "3.5rem";
            montoUI.style.color = "var(--danger-neon)";
            btnProcesar.disabled = false;
            btnProcesar.style.background = "";

            // Iniciar el cronómetro que actualiza cada segundo
            intervaloReloj = setInterval(() => {
                const ahora = new Date().getTime();
                const milisegundosAdentro = ahora - ticketFisico.timestampIngresoFisico;
                
                // TRUCO DE DESARROLLADOR: Convertimos milisegundos a "minutos" de sistema
                const minutosReales = Math.floor(milisegundosAdentro / 1000);
                
                // Formatear reloj a MM:SS visuales (simulado)
                const horasUI = Math.floor(minutosReales / 60).toString().padStart(2, '0');
                const minutosUI = (minutosReales % 60).toString().padStart(2, '0');
                relojUI.textContent = `${horasUI}:${minutosUI}`;

                // Calcular dinero
                totalAPagar = minutosReales * tarifaPorMinuto;
                montoUI.innerHTML = `$${totalAPagar.toFixed(2)} <span style="font-size: 1rem; color: var(--text-muted); font-weight: 400;">MXN</span>`;
                
            }, 1000);
        }
    });

    // 3. Procesar el pago (Simulado)
    formPago.addEventListener('submit', (e) => {
        e.preventDefault();
        
        btnProcesar.disabled = true;
        btnProcesar.textContent = "Procesando pago con banco...";

        // Simulamos que el banco tarda 2 segundos en responder
        setTimeout(() => {
            // Cambiamos el estado en Firebase a "pagado"
            update(ticketRef, { 
                estado: "pagado",
                totalLiquidado: totalAPagar // Guardamos cuánto pagó para el historial
            }).then(() => {
                // Firebase detectará el cambio a "pagado" y actualizará la interfaz automáticamente
                console.log("Pago registrado en la nube.");
            }).catch(error => {
                console.error("Error al pagar:", error);
                btnProcesar.disabled = false;
                btnProcesar.textContent = "Reintentar Pago";
            });
        }, 2000);
    });
});