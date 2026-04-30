// js/salida.js
// Importamos las herramientas (usaremos 'set' para borrar poniendo el valor en null)
import { db, ref, get, set } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Validar Sesión
    const usuarioLogueado = localStorage.getItem('usuarioLogueado');
    if (!usuarioLogueado) { window.location.href = '../index.html'; return; }

    const inputCodigo = document.getElementById('codigo-salida');
    const btnValidar = document.getElementById('btn-validar-salida');
    const pantallaEstado = document.getElementById('pantalla-hardware');
    const loader = document.getElementById('loader-hardware');
    const iconoResultado = document.getElementById('icono-estado');
    const textoEstado = document.getElementById('texto-estado');
    const detalleCobro = document.getElementById('detalle-cobro');

    btnValidar.addEventListener('click', () => {
        const codigoIngresado = inputCodigo.value.trim().toUpperCase();
        
        if (codigoIngresado === '') { inputCodigo.focus(); return; }

        // 1. Bloquear interfaz y mostrar loader
        inputCodigo.disabled = true;
        btnValidar.disabled = true;
        pantallaEstado.classList.remove('oculto');
        loader.classList.remove('oculto');
        iconoResultado.classList.add('oculto');
        detalleCobro.classList.add('oculto');
        textoEstado.className = '';
        textoEstado.textContent = 'Calculando tarifa y verificando...';

        // 2. Buscamos el ticket en Firebase
        const ticketRef = ref(db, 'tickets_activos/' + codigoIngresado);

        get(ticketRef).then((snapshot) => {
            if (!snapshot.exists()) {
                mostrarError("Código no válido o el ticket ya fue liquidado.");
                reactivarInterfaz();
                return;
            }

            const ticket = snapshot.val();

            // Validación de seguridad: Tiene que haber entrado primero
            if (ticket.estado !== "en_uso" || !ticket.timestampIngresoFisico) {
                mostrarError("Error: Este código no ha registrado entrada en la pluma.");
                reactivarInterfaz();
                return;
            }

            // --- LÓGICA DE COBRO MATEMÁTICA ---
            const ahora = new Date().getTime();
            const tiempoAdentroMilisegundos = ahora - ticket.timestampIngresoFisico;
            
            // TRUCO DE DESARROLLADOR: Convertimos milisegundos a "Minutos" (En realidad son segundos para pruebas rápidas)
            const minutosRealesAdentro = Math.floor(tiempoAdentroMilisegundos / 1000);
            
            // ¿Se pasó de su tiempo prepagado?
            let minutosExtra = minutosRealesAdentro - ticket.minutosComprados;
            if (minutosExtra < 0) minutosExtra = 0; // Si le sobró tiempo, no le cobramos nada extra

            // Tarifa dinámica: Supongamos que cobramos $1.50 por cada "minuto" extra
            const tarifaPorMinutoExtra = 1.50; 
            const totalAPagarSalida = minutosExtra * tarifaPorMinutoExtra;

            // 3. RECOLECCIÓN DE BASURA (Borrar el ticket de Firebase)
            set(ticketRef, null).then(() => {
                
                // Mostrar éxito en la pantalla
                mostrarExito("¡Liquidado! Abriendo pluma...");
                detalleCobro.classList.remove('oculto');
                
                let htmlCobro = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Cajón liberado:</span>
                        <strong style="color: #FFFFFF;">${ticket.cajon}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Tiempo extra:</span>
                        <strong style="color: #FFFFFF;">${minutosExtra} min</strong>
                    </div>
                `;

                if (totalAPagarSalida > 0) {
                    htmlCobro += `
                        <div style="display: flex; justify-content: space-between; margin-top: 10px; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 10px;">
                            <span>A Pagar Ahora:</span>
                            <strong style="color: #FF453A; font-size: 1.2rem;">$${totalAPagarSalida.toFixed(2)} MXN</strong>
                        </div>
                    `;
                } else {
                    htmlCobro += `
                        <div style="display: flex; justify-content: space-between; margin-top: 10px; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 10px;">
                            <span>A Pagar Ahora:</span>
                            <strong style="color: #32D74B; font-size: 1.2rem;">$0.00 MXN (Cubierto)</strong>
                        </div>
                    `;
                }

                detalleCobro.innerHTML = htmlCobro;

                // Después de 5 segundos, limpiar todo por si viene el siguiente coche
                setTimeout(() => {
                    pantallaEstado.classList.add('oculto');
                    reactivarInterfaz();
                }, 5000);

            });

        }).catch((error) => {
            console.error(error);
            mostrarError("Error de conexión. Intenta de nuevo.");
            reactivarInterfaz();
        });
    });

    function mostrarExito(mensaje) {
        textoEstado.textContent = mensaje;
        textoEstado.classList.add('estado-exito');
        iconoResultado.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #32D74B;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    }

    function mostrarError(mensaje) {
        textoEstado.textContent = mensaje;
        textoEstado.classList.add('estado-error');
        iconoResultado.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #FF453A;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    }

    function reactivarInterfaz() {
        inputCodigo.disabled = false;
        btnValidar.disabled = false;
        inputCodigo.value = '';
        inputCodigo.focus();
    }
});
