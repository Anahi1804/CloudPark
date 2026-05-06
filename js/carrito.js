// js/carrito.js
// 1. Importamos las herramientas para escribir en Firebase
import { db, ref, set } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const usuarioLogueado = localStorage.getItem('usuarioLogueado');
    const cajonSeleccionado = localStorage.getItem('cajonTemporal');

    if (!usuarioLogueado || !cajonSeleccionado) {
        window.location.href = '../index.html';
        return;
    }

    document.getElementById('resumen-usuario').textContent = usuarioLogueado;
    document.getElementById('resumen-cajon').textContent = cajonSeleccionado;

    const selectPaquete = document.getElementById('select-paquete');
    const textoTotal = document.getElementById('monto-total');
    const btnFinalizar = document.getElementById('btn-finalizar');

    let precioSeleccionado = 0;
    let nombrePaquete = "";
    let minutosPaquete = 0;

    // Detectar cuando el usuario elige un paquete
    selectPaquete.addEventListener('change', () => {
        const opcion = selectPaquete.options[selectPaquete.selectedIndex];
        minutosPaquete = parseInt(opcion.value);
        precioSeleccionado = parseFloat(opcion.getAttribute('data-precio'));
        nombrePaquete = opcion.text.split('-')[0].trim(); 
        
        textoTotal.textContent = `$${precioSeleccionado.toFixed(2)} MXN`;
        btnFinalizar.disabled = false;
    });

    // Generador del código PARK-XXXX
    function generarCodigoReserva() {
        const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let codigo = 'PARK-';
        for (let i = 0; i < 4; i++) {
            codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
        }
        return codigo;
    }

    // 2. Guardar la compra en la Nube y en el Navegador
    btnFinalizar.addEventListener('click', () => {
        
        // Deshabilitamos el botón para que no le den doble clic
        btnFinalizar.disabled = true;
        btnFinalizar.textContent = "Procesando pago...";

        const codigoGenerado = generarCodigoReserva();
        
// --- INICIO CÁLCULO DE TIEMPO (MODO PRUEBAS) ---
        const ahora = new Date();
        const fechaExpiracion = new Date(ahora);

        // TRUCO DE DESARROLLADOR: 
        // Tu select manda 30, 60, 120, etc. 
        // En lugar de sumarle MINUTOS, le sumaremos SEGUNDOS para que caduque rápido.
        // Ej: "1 hora" (60) va a durar exactamente 60 segundos en la vida real.
        // Cuando presentes el proyecto oficial, solo cambias 'setSeconds' por 'setMinutes'.
        fechaExpiracion.setSeconds(ahora.getSeconds() + minutosPaquete);
        // -----------------------------------------------

        const datosReserva = {
            usuario: usuarioLogueado,
            nombre: localStorage.getItem('nombreUsuario') || "Usuario", // ¡NUEVO!
            placa: localStorage.getItem('placaUsuario') || "S/N",       // ¡NUEVO!
            cajon: cajonSeleccionado,
            paquete: nombrePaquete,
            minutosComprados: minutosPaquete,
            totalPagado: precioSeleccionado,
            codigo: codigoGenerado,
            // Guardamos las fechas en milisegundos para que sea facilísimo restar tiempos después
            timestampCompra: ahora.getTime(), 
            timestampExpiracion: fechaExpiracion.getTime(),
            fechaTexto: ahora.toLocaleString(), // Para mostrarlo bonito en el ticket
            estado: "reservado" // ESTADO 2: Pagado pero no ha llegado físicamente
        };

        // PASO CLAVE: Creamos una carpeta en Firebase llamada "tickets_activos"
        const ticketRef = ref(db, 'tickets_activos/' + codigoGenerado);

        // Subimos los datos a Firebase
        set(ticketRef, datosReserva)
            .then(() => {
                // Si Firebase dice que todo salió bien, guardamos una copia rápida para la vista del ticket
                localStorage.setItem('ticketActual', JSON.stringify(datosReserva));
                localStorage.removeItem('cajonTemporal');
                
                // Redirigimos al usuario a ver su ticket bonito
                window.location.href = 'ticket.html';
            })
            .catch((error) => {
                console.error("Error al guardar en Firebase:", error);
                alert("Hubo un error de conexión. Intenta de nuevo.");
                btnFinalizar.disabled = false;
                btnFinalizar.textContent = "Pagar y Generar Código";
            });
    });
});