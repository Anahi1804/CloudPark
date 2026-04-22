// js/acceso-entrada.js

document.addEventListener('DOMContentLoaded', () => {
    const inputCodigo = document.getElementById('codigo-input');
    const btnValidar = document.getElementById('btn-validar');
    const divMensaje = document.getElementById('mensaje-estado');
    const textoMensaje = document.getElementById('texto-estado');

    // Función para mostrar mensajes de estado
    function mostrarEstado(mensaje, tipo) {
        textoMensaje.textContent = mensaje;
        divMensaje.className = 'mensaje-terminal'; // Resetear clases
        divMensaje.classList.add(tipo);
        divMensaje.classList.remove('oculto');
    }

    btnValidar.addEventListener('click', () => {
        // 1. Obtener y limpiar el código ingresado
        const codigoIngresado = inputCodigo.value.trim().toUpperCase();
        
        if (codigoIngresado === "") {
            mostrarEstado("Por favor, ingresa tu código.", "error");
            return;
        }

        // --- INICIO SIMULACIÓN SISTEMA DISTRIBUIDO ---
        // Deshabilitamos el botón para simular tiempo de espera de red
        btnValidar.disabled = true;
        btnValidar.textContent = "Conectando con servidor...";

        // Recuperamos el ticket guardado en la memoria del navegador
        const ticketGuardadoString = localStorage.getItem('ticketActual');

        // Simulamos un retraso de red de 1.5 segundos
        setTimeout(() => {
            btnValidar.disabled = false;
            btnValidar.textContent = "Validar y Abrir Pluma";

            if (!ticketGuardadoString) {
                mostrarEstado("No hay reservas activas en el sistema.", "error");
                return;
            }

            const ticket = JSON.parse(ticketGuardadoString);

            // 2. Validar Código
            if (codigoIngresado === ticket.codigo) {
                // ÉXITO: El código coincide
                mostrarEstado(
                    `¡Código Válido!\nCajón asignado: ${ticket.cajon}.\nAvanza, abriendo pluma...`, 
                    "exito"
                );
                
                // NOTA IMPORTANTE PARA TU PROYECTO:
                // Aquí es donde tu servidor Pyro, al validar, enviaría la señal 
                // por Socket/MQTT al ESP32 para mover el servomotor de la pluma física.
                
                // Limpiamos el input
                inputCodigo.value = "";
                
            } else {
                // ERROR: El código no existe o está mal escrito
                mostrarEstado("Código incorrecto o expirado. Verifica tu ticket.", "error");
            }

        }, 1500);
        // --- FIN SIMULACIÓN SISTEMA DISTRIBUIDO ---
    });
});