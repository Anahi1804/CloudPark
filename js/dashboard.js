// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    const usuarioLogueado = localStorage.getItem('usuarioLogueado');
    if (!usuarioLogueado) {
        window.location.href = '../index.html';
        return;
    }

    // Cortar el correo para mostrar solo el nombre (ej. "nombre" de "nombre@gmail.com")
    const nombreVisible = usuarioLogueado.split('@')[0];
    // Capitalizar la primera letra
    document.getElementById('nombre-usuario').textContent = nombreVisible.charAt(0).toUpperCase() + nombreVisible.slice(1);

    document.getElementById('btn-salir').addEventListener('click', () => {
        localStorage.removeItem('usuarioLogueado');
        window.location.href = '../index.html';
    });

    const tarjetaTicket = document.getElementById('tarjeta-ticket');
    const ticketActual = localStorage.getItem('ticketActual');

    if (!ticketActual) {
        tarjetaTicket.classList.add('deshabilitada');
        tarjetaTicket.querySelector('.texto-secundario').textContent = "Sin reservas";
    } else {
        tarjetaTicket.classList.remove('deshabilitada');
        tarjetaTicket.querySelector('.texto-secundario').textContent = "Ver Ticket";
    }
});