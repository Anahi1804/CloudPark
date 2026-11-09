// js/dashboard.js - Inicio del Conductor con Mapa de Red de Estacionamientos Parkil
import {
    auth, firestoreDB, doc, getDoc, onAuthStateChanged, signOut,
    db, ref, get, onValue, PARKIL_CONFIG, obtenerLogoParkilSVG
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Insertar nuevo logo de Parkil
    const avatarLogo = document.getElementById('avatar-logo-parkil');
    const iconoCarro = document.getElementById('icono-carro-parkil');
    if (avatarLogo) avatarLogo.innerHTML = obtenerLogoParkilSVG(32);
    if (iconoCarro) iconoCarro.innerHTML = obtenerLogoParkilSVG(48);

    const nombreUsuario = document.getElementById('nombre-usuario');
    const placaUsuario = document.getElementById('placa-usuario');
    const btnSalir = document.getElementById('btn-salir');
    const btnIrAdmin = document.getElementById('btn-ir-admin');
    const tarjetaTicket = document.getElementById('tarjeta-ticket');

    // 1. Verificar sesión y rol
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const docRef = doc(firestoreDB, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const datosUsuario = docSnap.data();
                nombreUsuario.textContent = datosUsuario.nombre;
                if (placaUsuario) placaUsuario.textContent = datosUsuario.placa || "SIN PLACA";
                localStorage.setItem('nombreUsuario', datosUsuario.nombre);
                localStorage.setItem('placaUsuario', datosUsuario.placa || "S/N");

                if (datosUsuario.rol === 'admin' && btnIrAdmin) {
                    btnIrAdmin.classList.remove('oculto');
                }
            }
        } else {
            window.location.href = '../index.html';
        }
    });

    btnSalir.addEventListener('click', () => {
        signOut(auth).then(() => {
            localStorage.removeItem('usuarioLogueado');
            localStorage.removeItem('ticketActual');
            window.location.href = '../index.html';
        });
    });

    // 2. Verificar si el usuario tiene un ticket activo en Firebase
    const ticketLocalString = localStorage.getItem('ticketActual');
    if (!ticketLocalString) {
        mostrarSinReservas();
    } else {
        const ticketLocal = JSON.parse(ticketLocalString);
        get(ref(db, 'tickets_activos/' + ticketLocal.codigo)).then((snapshot) => {
            if (!snapshot.exists()) {
                localStorage.removeItem('ticketActual');
                mostrarSinReservas();
            } else {
                tarjetaTicket.classList.remove('deshabilitada');
                tarjetaTicket.querySelector('.texto-secundario').textContent = "Ver Ticket";
            }
        });
    }

    function mostrarSinReservas() {
        tarjetaTicket.classList.add('deshabilitada');
        tarjetaTicket.querySelector('.texto-secundario').textContent = "Sin reservas";
        tarjetaTicket.removeAttribute('href');
    }

    // 3. MAPA INTERACTIVO DE LA RED DE ESTACIONAMIENTOS PARKIL
    const sedesFallback = {
        [PARKIL_CONFIG.ESTACIONAMIENTO_DEFAULT_ID]: {
            id: PARKIL_CONFIG.ESTACIONAMIENTO_DEFAULT_ID,
            nombre: "Parkil Matriz Centro Histórico (Maqueta IoT)",
            direccion: "Calle 10 #245, Centro Histórico, Campeche",
            tarifaHora: 25,
            niveles: 2,
            lat: 19.8454,
            lng: -90.5358
        },
        "parkil_galerias_campeche": {
            id: "parkil_galerias_campeche",
            nombre: "Parkil Plaza Galerías Ah-Kim-Pech",
            direccion: "Av. Pedro Sainz de Baranda, Campeche",
            tarifaHora: 30,
            niveles: 2,
            lat: 19.8528,
            lng: -90.5295
        }
    };

    let catalogoSedes = JSON.parse(localStorage.getItem('parkil_catalogo_sedes') || 'null') || sedesFallback;
    let sedeSeleccionadaId = localStorage.getItem('estacionamientoSeleccionadoId') || PARKIL_CONFIG.ESTACIONAMIENTO_DEFAULT_ID;
    if (!catalogoSedes[sedeSeleccionadaId]) {
        sedeSeleccionadaId = Object.keys(catalogoSedes)[0];
    }

    const mapa = L.map('mapa-conductor').setView([19.8485, -90.5325], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(mapa);

    let marcadores = {};

    function renderizarSedesEnMapaYLista() {
        const contenedorLista = document.getElementById('lista-estacionamientos-ui');
        contenedorLista.innerHTML = '';

        Object.values(marcadores).forEach(m => mapa.removeLayer(m));
        marcadores = {};

        Object.values(catalogoSedes).forEach(sede => {
            const lat = Number(sede.lat) || 19.8454;
            const lng = Number(sede.lng) || -90.5358;

            const marker = L.marker([lat, lng]).addTo(mapa);
            marker.bindPopup(`<b>${sede.nombre}</b><br>$${sede.tarifaHora}/hr • ${sede.niveles || 1} Nivel(es)`);
            marker.on('click', () => seleccionarSede(sede.id));
            marcadores[sede.id] = marker;

            const item = document.createElement('div');
            item.className = `sede-item ${sede.id === sedeSeleccionadaId ? 'activa' : ''}`;
            item.innerHTML = `
                <div>
                    <h4>🏢 ${sede.nombre}</h4>
                    <p>📍 ${sede.direccion || 'San Francisco de Campeche'} • ${sede.niveles || 1} Piso(s)</p>
                </div>
                <span class="badge-tarifa">$${sede.tarifaHora}/hr</span>
            `;
            item.addEventListener('click', () => seleccionarSede(sede.id));
            contenedorLista.appendChild(item);
        });

        actualizarBotonPrincipal();
    }

    function seleccionarSede(id) {
        sedeSeleccionadaId = id;
        const sede = catalogoSedes[id];
        localStorage.setItem('estacionamientoSeleccionadoId', id);
        if (sede) {
            localStorage.setItem('estacionamientoSeleccionadoNombre', sede.nombre);
            localStorage.setItem('tarifaHoraSeleccionada', sede.tarifaHora || 25);
            mapa.setView([Number(sede.lat) || 19.8454, Number(sede.lng) || -90.5358], 16);
            if (marcadores[id]) marcadores[id].openPopup();
        }
        renderizarSedesEnMapaYLista();
    }

    function actualizarBotonPrincipal() {
        const sede = catalogoSedes[sedeSeleccionadaId];
        if (!sede) return;
        localStorage.setItem('estacionamientoSeleccionadoId', sede.id);
        localStorage.setItem('estacionamientoSeleccionadoNombre', sede.nombre);
        localStorage.setItem('tarifaHoraSeleccionada', sede.tarifaHora || 25);

        document.getElementById('titulo-reservar-sede').textContent = "Reservar cajón";
        document.getElementById('subtitulo-reservar-sede').textContent = `${sede.nombre} ($${sede.tarifaHora}/hr)`;
    }

    renderizarSedesEnMapaYLista();

    // Escuchar si el Admin agrega o modifica estacionamientos en Firebase
getDoc(doc(firestoreDB, "configuracion_parkil", "catalogo_sedes")).then((docSnap) => {
        if (docSnap.exists() && docSnap.data().sedes) {
            catalogoSedes = docSnap.data().sedes;
            localStorage.setItem('parkil_catalogo_sedes', JSON.stringify(catalogoSedes));
            renderizarSedesEnMapaYLista();
        }
    }).catch(() => {});
});