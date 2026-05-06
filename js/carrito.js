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
// 2. Guardar la compra en la Nube al ENVIAR el formulario
    const formPagoEntrada = document.getElementById('form-pago-entrada');

    formPagoEntrada.addEventListener('submit', (e) => {
        e.preventDefault(); // Evita que la página recargue

        // Deshabilitamos el botón para que no le den doble clic
        btnFinalizar.disabled = true;
        btnFinalizar.textContent = "Procesando pago con el banco...";

        // Simulamos un retraso de procesamiento de banco de 2 segundos
        setTimeout(() => {
            const codigoGenerado = generarCodigoReserva(); 

            const ahora = new Date();
            const fechaExpiracion = new Date(ahora);
            fechaExpiracion.setSeconds(ahora.getSeconds() + minutosPaquete);

            const datosReserva = {
                usuario: usuarioLogueado,
                nombre: localStorage.getItem('nombreUsuario') || "Usuario",
                placa: localStorage.getItem('placaUsuario') || "S/N",
                cajon: cajonSeleccionado,
                paquete: nombrePaquete,
                minutosComprados: minutosPaquete,
                totalLiquidado: precioSeleccionado, // Usamos totalLiquidado para unificar la economía
                totalPagado: precioSeleccionado, // (Dejamos este por compatibilidad del diseño del ticket)
                codigo: codigoGenerado,
                timestampCompra: ahora.getTime(), 
                timestampExpiracion: fechaExpiracion.getTime(),
                fechaTexto: ahora.toLocaleString(),
                estado: "reservado" 
            };

            const ticketRef = ref(db, 'tickets_activos/' + codigoGenerado);

            set(ticketRef, datosReserva)
                .then(() => {
                    localStorage.setItem('ticketActual', JSON.stringify(datosReserva));
                    localStorage.removeItem('cajonTemporal');
                    window.location.href = 'ticket.html';
                })
                .catch((error) => {
                    console.error("Error al guardar en Firebase:", error);
                    alert("Hubo un error de conexión. Intenta de nuevo.");
                    btnFinalizar.disabled = false;
                    btnFinalizar.textContent = "Pagar y Generar Código";
                });
        }, 2000); // 2 segundos de "Loading" falso
    });
});