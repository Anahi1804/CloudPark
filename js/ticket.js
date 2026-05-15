// js/ticket.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Recuperar los datos de la reserva finalizada
    const datosReservaString = localStorage.getItem('ticketActual');

    // 2. Seguridad: Si no hay ticket, regresar al mapa
    if (!datosReservaString) {
        alert("No se encontró ninguna reserva activa.");
        window.location.href = 'reservas.html';
        return;
    }

    const reserva = JSON.parse(datosReservaString);

    // 3. Inyectar los datos en la vista
    document.getElementById('tkt-fecha').textContent = reserva.fechaTexto;
    document.getElementById('tkt-cajon').textContent = reserva.cajon;
    document.getElementById('tkt-usuario').textContent = reserva.usuario;
    document.getElementById('tkt-paquete').textContent = reserva.paquete;
    document.getElementById('tkt-codigo').textContent = reserva.codigo;
    document.getElementById('tkt-total').textContent = `$${reserva.totalPagado.toFixed(2)} MXN`;

    //  El código PARK-XXXX ya viene generado desde carrito.js
});