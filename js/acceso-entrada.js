// js/acceso-entrada.js
import { db, ref, get, update, set, PARKIL_CONFIG } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const inputCodigo = document.getElementById('codigo-input');
    const btnValidar = document.getElementById('btn-validar');
    const divMensaje = document.getElementById('mensaje-estado');
    const textoMensaje = document.getElementById('texto-estado');

    function mostrarEstado(mensaje, tipo) {
        textoMensaje.textContent = mensaje;
        divMensaje.className = 'mensaje-terminal';
        divMensaje.classList.add(tipo);
        divMensaje.classList.remove('oculto');
    }

    btnValidar.addEventListener('click', async () => {
        const codigoIngresado = inputCodigo.value.trim().toUpperCase();

        if (codigoIngresado === "") {
            mostrarEstado("Por favor, ingresa tu código.", "error");
            return;
        }

        btnValidar.disabled = true;
        btnValidar.textContent = "Consultando base de datos...";

        const ticketRef = ref(db, 'tickets_activos/' + codigoIngresado);

        try {
            const snapshot = await get(ticketRef);

            if (!snapshot.exists()) {
                mostrarEstado("Código no encontrado. Verifica tu ticket.", "error");
                reactivarBoton();
                return;
            }

            const ticket = snapshot.val();
            const ahora = Date.now();

            if (ticket.estado !== "reservado") {
                mostrarEstado("Este código ya fue utilizado o está inactivo.", "error");
                reactivarBoton();
                return;
            }

            if (ahora > ticket.timestampExpiracion) {
                await update(ticketRef, { estado: "vencido" });
                const rutaCandado = ticket.estacionamientoId
                    ? `cajones_bloqueados_${ticket.estacionamientoId}/${ticket.cajon}`
                    : `cajones_bloqueados/${ticket.cajon}`;
                await set(ref(db, rutaCandado), null);
                mostrarEstado("Tu tiempo de tolerancia ha expirado. Debes generar otra reserva.", "error");
                reactivarBoton();
                return;
            }

            // Determinamos si este cajón tiene sensor físico de la maqueta o si es sensor virtual
            const sensorHardware = ticket.sensorFisico || PARKIL_CONFIG.SENSORES_MAQUETA[ticket.cajon] || null;
            const datosActualizacion = {
                estado: "en_uso",
                timestampEntradaPluma: ahora
            };

            // Si es un cajón virtual (sin sensor físico asignado), iniciamos el cronómetro al cruzar la pluma
            if (!sensorHardware) {
                datosActualizacion.timestampIngresoFisico = ahora;
            } else {
                // Si el sensor físico ya estaba ocupado al validar, también iniciamos de inmediato
                const snapSensor = await get(ref(db, `estacionamiento_actual/${sensorHardware}`));
                if (snapSensor.exists() && String(snapSensor.val()).trim().toLowerCase() === "ocupado") {
                    datosActualizacion.timestampIngresoFisico = ahora;
                }
            }

            await update(ticketRef, datosActualizacion);

            mostrarEstado(`¡Código Válido!\nCajón asignado: ${ticket.cajon}.\nAvanza, abriendo pluma...`, "exito");
            await set(ref(db, 'control_plumas/entrada'), 'abrir');

            inputCodigo.value = "";
            reactivarBoton();
        } catch (error) {
            console.error("Error al conectar con Firebase:", error);
            mostrarEstado("Error de conexión. Intenta de nuevo.", "error");
            reactivarBoton();
        }
    });

    function reactivarBoton() {
        btnValidar.disabled = false;
        btnValidar.textContent = "Validar y Abrir Pluma";
    }
});