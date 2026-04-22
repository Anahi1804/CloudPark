// js/reservas.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Validar Seguridad Básica
    const usuarioLogueado = localStorage.getItem('usuarioLogueado');
    if (!usuarioLogueado) {
        // Si alguien intenta entrar a reservas.html sin loguearse, lo pateamos al index
        window.location.href = '../index.html';
        return;
    }

    // Mostrar el correo del usuario en el menú superior
    document.getElementById('nombre-usuario').textContent = usuarioLogueado;

    // Lógica para Cerrar Sesión
    document.getElementById('btn-salir').addEventListener('click', () => {
        localStorage.removeItem('usuarioLogueado');
        window.location.href = '../index.html';
    });

    // 2. Simulación del estado del hardware (ESP32 vía Pyro)
    const cajonesBackend = [
        { id: 'A1', estado: 'disponible' },
        { id: 'A2', estado: 'ocupado' },
        { id: 'A3', estado: 'disponible' },
        { id: 'A4', estado: 'disponible' },
        { id: 'B1', estado: 'ocupado' },
        { id: 'B2', estado: 'ocupado' },
        { id: 'B3', estado: 'disponible' },
        { id: 'B4', estado: 'disponible' }
    ];

    const gridCajones = document.getElementById('contenedor-cajones');
    const panelInfo = document.getElementById('info-cajon');
    const btnIrCarrito = document.getElementById('btn-ir-carrito');
    
    let cajonSeleccionado = null;

    // 3. Dibujar el mapa en la pantalla
    function renderizarMapa() {
        gridCajones.innerHTML = ''; // Limpiar por si acaso
        
        cajonesBackend.forEach(cajon => {
            const div = document.createElement('div');
            div.classList.add('cajon', cajon.estado);
            div.textContent = cajon.id;

            // Solo los disponibles se pueden clickear
            if (cajon.estado === 'disponible') {
                div.addEventListener('click', () => manejarSeleccion(cajon.id, div));
            }
            
            gridCajones.appendChild(div);
        });
    }

    // 4. Lógica al darle clic a un cajón
    function manejarSeleccion(id, elementoDiv) {
        // Quitar la clase 'seleccionado' a cualquier otro cajón que la tenga
        const previos = document.querySelectorAll('.cajon.seleccionado');
        previos.forEach(el => el.classList.remove('seleccionado'));

        // Poner la clase 'seleccionado' al que acabamos de clickear
        elementoDiv.classList.add('seleccionado');
        cajonSeleccionado = id;

        // Actualizar el panel derecho
        panelInfo.innerHTML = `
            <p><strong>Cajón:</strong> ${id}</p>
            <p style="color: var(--success); font-weight: bold;">✓ Disponible para reserva</p>
        `;
        
        // Habilitar el botón para avanzar
        btnIrCarrito.disabled = false;
    }

    // 5. Enviar al Carrito
    btnIrCarrito.addEventListener('click', () => {
        // Guardamos solo el cajón seleccionado temporalmente
        localStorage.setItem('cajonTemporal', cajonSeleccionado);
        
        // Redirigimos a la vista del carrito (como están en la misma carpeta, va directo)
        window.location.href = 'carrito.html';
    });

    // Iniciar el renderizado
    renderizarMapa();
});