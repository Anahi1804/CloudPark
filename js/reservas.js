// js/reservas.js
// 1. Importamos nuestro puente de Firebase
import { db, ref, onValue } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Validar Sesión (Mantenemos la simulación por ahora)
    const usuarioLogueado = localStorage.getItem('usuarioLogueado');
    if (!usuarioLogueado) {
        window.location.href = '../index.html';
        return;
    }

// Buscamos el botón primero
    const btnSalir = document.getElementById('btn-salir');
    
    // Solo le agregamos el evento SI el botón existe en esta página
    if (btnSalir) {
        btnSalir.addEventListener('click', () => {
            localStorage.removeItem('usuarioLogueado');
            window.location.href = '../index.html';
        });
    }

    // Variables de la Interfaz
    const cajonesElementos = document.querySelectorAll('.cajon');
    const infoCajon = document.getElementById('info-cajon');
    const btnIrCarrito = document.getElementById('btn-ir-carrito');
    let cajonSeleccionado = null;

    // 2. ESCUCHAMOS A FIREBASE EN TIEMPO REAL 📡
    // Le decimos que mire la carpeta "estacionamiento_actual"
    const estacionamientoRef = ref(db, 'estacionamiento_actual');
    
    onValue(estacionamientoRef, (snapshot) => {
        const datos = snapshot.val();
        
        // Si hay datos en Firebase, actualizamos el mapa
        if (datos) {
            actualizarMapaVisual(datos);
        }
    });

    // 3. Función que pinta el mapa según Firebase
    function actualizarMapaVisual(datosFirebase) {
        // Mapeamos los nombres del ESP32 (cajon_1) con la web (A1)
        const equivalencias = {
            'A1': datosFirebase.cajon_1,
            'A2': datosFirebase.cajon_2,
            'A3': datosFirebase.cajon_3,
            'B1': datosFirebase.cajon_4,
            'B2': datosFirebase.cajon_5,
            'B3': datosFirebase.cajon_6
        };

        cajonesElementos.forEach(cajon => {
            const numero = cajon.querySelector('.numero-cajon').textContent;
            const estadoEnNube = equivalencias[numero]; // "libre" u "ocupado"

            // Limpiamos las clases actuales
            cajon.classList.remove('disponible', 'ocupado');

            if (estadoEnNube === 'ocupado') {
                cajon.classList.add('ocupado');
                // Si el cajón que teníamos seleccionado se ocupó de repente, lo deseleccionamos
                if (cajonSeleccionado === numero) {
                    resetearSeleccion();
                }
            } else {
                cajon.classList.add('disponible');
            }
        });
    }

    // 4. Lógica de clics (Solo para los disponibles)
    cajonesElementos.forEach(cajon => {
        cajon.addEventListener('click', () => {
            // Si está ocupado por Firebase, no hacemos nada
            if (cajon.classList.contains('ocupado')) return;

            // Limpiar selecciones previas
            cajonesElementos.forEach(c => {
                if (c.classList.contains('seleccionado')) {
                    c.classList.remove('seleccionado');
                }
            });

            // Seleccionar el nuevo
            cajon.classList.add('seleccionado');
            cajonSeleccionado = cajon.querySelector('.numero-cajon').textContent;

            // Actualizar panel derecho
            infoCajon.innerHTML = `
                <p class="etiqueta-info">Cajón seleccionado:</p>
                <p class="valor-info cyan-glow">${cajonSeleccionado}</p>
            `;
            btnIrCarrito.disabled = false;
        });
    });

    function resetearSeleccion() {
        cajonSeleccionado = null;
        infoCajon.innerHTML = `
            <p class="etiqueta-info">Estado actual:</p>
            <p class="valor-info" style="font-size: 1.2rem; color: var(--text-muted);">Esperando selección...</p>
        `;
        btnIrCarrito.disabled = true;
    }

if (btnIrCarrito) {
        btnIrCarrito.addEventListener('click', () => {
            if (cajonSeleccionado) {
                localStorage.setItem('cajonTemporal', cajonSeleccionado);
                window.location.href = 'carrito.html'; 
            }
        });
    }
}); // Este es el cierre del DOMContentLoaded, no lo pierdas de vista
