// js/salida.js

document.addEventListener('DOMContentLoaded', () => {
    // Validar Sesión
    const usuarioLogueado = localStorage.getItem('usuarioLogueado');
    if (!usuarioLogueado) {
        window.location.href = '../index.html';
        return;
    }

    const inputCodigo = document.getElementById('codigo-salida');
    const btnValidar = document.getElementById('btn-validar-salida');
    
    // Elementos de la pantalla de hardware
    const pantallaEstado = document.getElementById('pantalla-hardware');
    const loader = document.getElementById('loader-hardware');
    const iconoResultado = document.getElementById('icono-estado');
    const textoEstado = document.getElementById('texto-estado');
    const detalleCobro = document.getElementById('detalle-cobro');

    btnValidar.addEventListener('click', () => {
        const codigoIngresado = inputCodigo.value.trim().toUpperCase();
        
        if (codigoIngresado === '') {
            inputCodigo.focus();
            return;
        }

        // --- INICIA SIMULACIÓN DE SISTEMA DISTRIBUIDO (PYRO/PYTHON) ---
        
        // 1. Bloquear interfaz y mostrar loader
        inputCodigo.disabled = true;
        btnValidar.disabled = true;
        pantallaEstado.classList.remove('oculto');
        
        // Resetear visuales de la pantalla
        loader.classList.remove('oculto');
        iconoResultado.classList.add('oculto');
        detalleCobro.classList.add('oculto');
        textoEstado.className = '';
        textoEstado.textContent = 'Verificando hardware ESP32...';

        // Recuperar la base de datos simulada
        const ticketGuardado = localStorage.getItem('ticketActual');

        // Retraso para simular comunicación por red
        setTimeout(() => {
            loader.classList.add('oculto');
            iconoResultado.classList.remove('oculto');

            if (!ticketGuardado) {
                mostrarError("No se encontraron reservas en el sistema.");
                reactivarInterfaz();
                return;
            }

            const ticket = JSON.parse(ticketGuardado);

            // 2. Validar el Código
            if (codigoIngresado === ticket.codigo) {
                // ÉXITO
                mostrarExito("¡Pago validado! Abriendo pluma...");
                
                detalleCobro.classList.remove('oculto');
                detalleCobro.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Cajón liberado:</span>
                        <strong style="color: #FFFFFF;">${ticket.cajon}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Paquete cubierto:</span>
                        <strong style="color: #FFFFFF;">${ticket.paquete}</strong>
                    </div>
                `;

                // LOGICA DE NEGOCIO: Borrar el ticket para que no se re-utilice
                localStorage.removeItem('ticketActual');
                
                // Opcional: Redirigir al dashboard después de 4 segundos
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 4000);

            } else {
                // ERROR
                mostrarError("Código inválido o ya utilizado.");
                reactivarInterfaz();
            }

        }, 1800); // 1.8 segundos de retraso simulado
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
        setTimeout(() => {
            inputCodigo.disabled = false;
            btnValidar.disabled = false;
            inputCodigo.value = '';
            inputCodigo.focus();
        }, 2000); // Darle tiempo al usuario de leer el error antes de resetear
    }
});