// js/acceso-entrada.js
// 1. Importamos las herramientas, incluyendo 'get' para leer una sola vez y 'update' para actualizar datos
import { db, ref, get, update } from './firebase-config.js';

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

    btnValidar.addEventListener('click', () => {
        const codigoIngresado = inputCodigo.value.trim().toUpperCase();
        
        if (codigoIngresado === "") {
            mostrarEstado("Por favor, ingresa tu código.", "error");
            return;
        }

        // Bloqueamos la interfaz mientras consultamos a la nube
        btnValidar.disabled = true;
        btnValidar.textContent = "Consultando base de datos...";

        // 2. Buscamos exactamente la carpeta de este código en Firebase
        const ticketRef = ref(db, 'tickets_activos/' + codigoIngresado);
        
        get(ticketRef).then((snapshot) => {
            // Regla A: ¿El código existe en la base de datos?
            if (!snapshot.exists()) {
                mostrarEstado("Código no encontrado. Verifica tu ticket.", "error");
                reactivarBoton();
                return;
            }

            const ticket = snapshot.val();
            const ahora = new Date().getTime();

            // Regla B: ¿El ticket está en estado "reservado"? (evita que usen un código que ya se usó)
            if (ticket.estado !== "reservado") {
                mostrarEstado("Este código ya fue utilizado o está inactivo.", "error");
                reactivarBoton();
                return;
            }

            // Regla C: ¿Llegó tarde y el tiempo ya expiró?
            if (ahora > ticket.timestampExpiracion) {
                // Sanción: Pasamos su ticket a estado 'vencido' para que ya no sirva
                update(ticketRef, { estado: "vencido" });
                mostrarEstado("Tu tiempo de tolerancia ha expirado. Debes generar otra reserva.", "error");
                reactivarBoton();
                return;
            }

            // 3. ¡ÉXITO! Pasó todas las validaciones de seguridad
            // ESTADO 3: Cambiamos a "en_uso" y guardamos cuándo entró realmente para cobrarle después
            update(ticketRef, { 
                estado: "en_uso",
                timestampIngresoFisico: ahora 
            }).then(() => {
                mostrarEstado(`¡Código Válido!\nCajón asignado: ${ticket.cajon}.\nAvanza, abriendo pluma...`, "exito");
                
                // Limpiamos el input
                inputCodigo.value = "";
                reactivarBoton();

                // NOTA FUTURA PARA EL RMI/PYTHON:
                // Justo aquí es donde Python le enviaría la señal eléctrica al ESP32 para abrir el servomotor.
            });

        }).catch((error) => {
            console.error("Error al conectar con Firebase:", error);
            mostrarEstado("Error de conexión. Intenta de nuevo.", "error");
            reactivarBoton();
        });
    });

    function reactivarBoton() {
        btnValidar.disabled = false;
        btnValidar.textContent = "Validar y Abrir Pluma";
    }
});