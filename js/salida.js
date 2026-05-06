// js/salida.js
import { db, ref, get, set, firestoreDB, doc, setDoc, update} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Validar Sesión de quien opera la terminal
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

        bloquearInterfaz("Verificando pago...");

        const ticketRef = ref(db, 'tickets_activos/' + codigoIngresado);

        get(ticketRef).then((snapshot) => {
            if (!snapshot.exists()) {
                mostrarError("Código no válido o el ticket ya fue procesado.");
                return;
            }

            const ticket = snapshot.val();

            // REGLA DE ORO: ¿Ya pagó en su celular?
            if (ticket.estado !== "pagado") {
                mostrarError("Aún no has liquidado tu estancia. Por favor paga desde tu app móvil.");
                return;
            }

            // NUEVA REGLA: ¿Pasaron más de 15 minutos desde que pagó?
            const ahora = new Date().getTime();
            // TRUCO DEV: 15 minutos reales son 900,000 ms. 
            // Para probarlo AHORITA, lo pondremos en 30 segundos (30000 ms).
            const limiteTolerancia = 30000; 

            if (ticket.timestampPagado && (ahora - ticket.timestampPagado) > limiteTolerancia) {
                mostrarError("⏳ Tiempo de salida excedido. Se aplicará multa.");
                
                // CASTIGO: Solo actualizamos el estado, dejamos intacto el timestampPagado
                update(ticketRef, {
                    estado: "multado" // <-- Eliminamos la línea que decía timestampPagado: null
                });
                
                setTimeout(() => {
                    pantallaEstado.classList.add('oculto');
                    reactivarInterfaz();
                }, 5000);
                return; // Cortamos el proceso para que NO abra la pluma
            }
            // ¡ÉXITO! El cliente ya pagó. Procedemos con la Mudanza de Datos.
            textoEstado.textContent = "Archivando ticket...";

            // 1. Preparamos el documento para Firestore (Historial Histórico)
            const historialRef = doc(firestoreDB, "historial_tickets", codigoIngresado);
            const datosHistorial = {
                ...ticket, // Copiamos toda la info del ticket original
                fechaSalidaFisica: new Date().toLocaleString(),
                timestampSalida: new Date().getTime(),
                estadoFinal: "completado"
            };

            // 2. Guardamos en Firestore
            setDoc(historialRef, datosHistorial).then(() => {
                
                // 3. Borramos de la Realtime Database para liberar el cajón (Recolección de Basura)
                return set(ticketRef, null);

            }).then(() => {
                
                // 4. Mostramos éxito en la pantalla y abrimos pluma
                mostrarExito("¡Buen viaje! Abriendo pluma...");
                detalleCobro.classList.remove('oculto');
                detalleCobro.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Cajón liberado:</span>
                        <strong style="color: #FFFFFF;">${ticket.cajon}</strong>
                    </div>
                    <div style="text-align: center; margin-top: 15px; color: var(--spot-available); font-weight: bold;">
                        Pago Confirmado en Nube
                    </div>
                `;

                // Quitar el ticket del celular también (limpiar localstorage)
                localStorage.removeItem('ticketActual');

                setTimeout(() => {
                    pantallaEstado.classList.add('oculto');
                    reactivarInterfaz();
                }, 4000);

            }).catch(error => {
                console.error("Error en la mudanza de datos:", error);
                mostrarError("Error al archivar. Contacte administración.");
            });

        }).catch((error) => {
            console.error("Error de conexión:", error);
            mostrarError("Error de conexión. Intenta de nuevo.");
        });
    });

    // --- Funciones UI auxiliares ---
    function bloquearInterfaz(mensaje) {
        inputCodigo.disabled = true;
        btnValidar.disabled = true;
        pantallaEstado.classList.remove('oculto');
        loader.classList.remove('oculto');
        iconoResultado.classList.add('oculto');
        detalleCobro.classList.add('oculto');
        textoEstado.className = '';
        textoEstado.textContent = mensaje;
    }

    function mostrarExito(mensaje) {
        loader.classList.add('oculto');
        iconoResultado.classList.remove('oculto');
        textoEstado.textContent = mensaje;
        textoEstado.classList.add('estado-exito');
        iconoResultado.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #32D74B;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    }

    function mostrarError(mensaje) {
        loader.classList.add('oculto');
        iconoResultado.classList.remove('oculto');
        textoEstado.textContent = mensaje;
        textoEstado.classList.add('estado-error');
        iconoResultado.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #FF453A;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        setTimeout(() => {
            pantallaEstado.classList.add('oculto');
            reactivarInterfaz();
        }, 4000);
    }

    function reactivarInterfaz() {
        inputCodigo.disabled = false;
        btnValidar.disabled = false;
        inputCodigo.value = '';
        inputCodigo.focus();
    }
});