// js/carrito.js

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
        // Obtener la opción que el usuario seleccionó
        const opcion = selectPaquete.options[selectPaquete.selectedIndex];
        
        // Leer los datos de esa opción
        minutosPaquete = parseInt(opcion.value);
        precioSeleccionado = parseFloat(opcion.getAttribute('data-precio'));
        nombrePaquete = opcion.text.split('-')[0].trim(); // Saca el nombre (ej. "⚡ Express")

        // Actualizar la interfaz
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

    // Guardar la compra
    btnFinalizar.addEventListener('click', () => {
        const datosReserva = {
            usuario: usuarioLogueado,
            cajon: cajonSeleccionado,
            paquete: nombrePaquete,
            minutosComprados: minutosPaquete,
            totalPagado: precioSeleccionado,
            fecha: new Date().toLocaleString(),
            codigo: generarCodigoReserva()
        };

        // Guardamos y nos vamos al ticket
        localStorage.setItem('ticketActual', JSON.stringify(datosReserva));
        localStorage.removeItem('cajonTemporal');

        window.location.href = 'ticket.html';
    });
});