// js/carrito.js - Adaptado dinámicamente a las reglas de cobro de cada estacionamiento
import { auth, db, firestoreDB, ref, set, get, runTransaction, onAuthStateChanged, collection, getDocs, PARKIL_CONFIG } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const cajonSeleccionado = localStorage.getItem('cajonTemporal');
    const sedeId = localStorage.getItem('estacionamientoSeleccionadoId') || PARKIL_CONFIG.ESTACIONAMIENTO_DEFAULT_ID;

    const txtCajon = document.getElementById('resumen-cajon');
    const txtTotal = document.getElementById('monto-total');
    const selectPaquete = document.getElementById('select-paquete');
    const btnFinalizar = document.getElementById('btn-finalizar-compra');
    const selectorTarjetas = document.getElementById('selector-tarjetas');
    const alertaSinTarjetas = document.getElementById('alerta-sin-tarjetas');

    let usuarioLogueado = null;
    let usuarioActualUID = null;
    let precioFinal = 0;
    let paqueteFinal = "";
    let minutosFinales = 60;

    // Configuración de cobros del estacionamiento elegido
    let configSede = {
        tarifaHora: Number(localStorage.getItem('tarifaHoraSeleccionada')) || 25,
        cobrarReserva: true,
        cobrarMulta: true,
        precioMulta: 25,
        toleranciaMinutos: 15,
        paquetes: [
            { nombre: '⚡ Express (30 min)', minutos: 30, precio: 15.00, activo: true },
            { nombre: '🚗 Estándar (1 hora)', minutos: 60, precio: 25.00, activo: true },
            { nombre: '💼 Reunión (2 horas)', minutos: 120, precio: 45.00, activo: true },
            { nombre: '🌟 Máximo (4 horas)', minutos: 240, precio: 80.00, activo: true }
        ]
    };

    if (!cajonSeleccionado) {
        alert("Faltan datos de la reserva. Regresando al mapa...");
        window.location.href = 'reservas.html';
        return;
    }

    txtCajon.textContent = cajonSeleccionado;

    // 1. Cargar las reglas exactas que configuró el Administrador de esta sucursal
    async function cargarReglasDeSucursal() {
        try {
            const localCat = JSON.parse(localStorage.getItem('parkil_catalogo_sedes') || '{}');
            let sede = localCat[sedeId];

const snapCfg = await getDoc(doc(firestoreDB, "configuracion_parkil", "catalogo_sedes"));
            if (snapCfg.exists() && snapCfg.data().sedes && snapCfg.data().sedes[sedeId]) {
                sede = snapCfg.data().sedes[sedeId];
            }

            if (sede) {
                configSede.tarifaHora = Number(sede.tarifaHora ?? 25);
                if (sede.configCobros) {
                    configSede.cobrarReserva = sede.configCobros.cobrarReserva !== false;
                    configSede.cobrarMulta = sede.configCobros.cobrarMulta !== false;
                    configSede.precioMulta = Number(sede.configCobros.precioMulta ?? configSede.tarifaHora);
                    configSede.toleranciaMinutos = Number(sede.configCobros.toleranciaMinutos ?? 15);
                    if (Array.isArray(sede.configCobros.paquetes)) {
                        configSede.paquetes = sede.configCobros.paquetes.filter(p => p.activo);
                    }
                }
            }
        } catch (e) {
            console.warn("Usando configuración local de sucursal:", e);
        }

        // Llenar el selector de paquetes según lo que configuró el Admin
        selectPaquete.innerHTML = '<option value="" disabled selected>Elige una opción de tiempo...</option>';
        configSede.paquetes.forEach(p => {
            const costoMostrar = configSede.cobrarReserva ? Number(p.precio) : 0;
            const etiquetaPrecio = configSede.cobrarReserva ? `$${costoMostrar.toFixed(2)}` : `GRATIS ($0.00)`;
            const opt = document.createElement('option');
            opt.value = String(p.minutos);
            opt.setAttribute('data-precio', String(costoMostrar));
            opt.setAttribute('data-nombre', p.nombre);
            opt.textContent = `${p.nombre} - ${etiquetaPrecio}`;
            selectPaquete.appendChild(opt);
        });

        // Si el Admin configuró NO cobrar por reservar, no exigimos tarjeta hoy
        if (!configSede.cobrarReserva) {
            selectorTarjetas.innerHTML = '<option value="SIN_COBRO">✨ Reserva sin costo hoy (Pagarás tu estancia al salir)</option>';
            selectorTarjetas.disabled = true;
            alertaSinTarjetas.classList.add('oculto');
            btnFinalizar.textContent = "Confirmar Reserva Gratuita y Generar QR";
        }
    }

    cargarReglasDeSucursal();

    selectPaquete.addEventListener('change', () => {
        const opcion = selectPaquete.options[selectPaquete.selectedIndex];
        minutosFinales = parseInt(opcion.value);
        precioFinal = parseFloat(opcion.getAttribute('data-precio') || 0);
        paqueteFinal = opcion.getAttribute('data-nombre') || opcion.text.split('-')[0].trim();

        txtTotal.textContent = `$${precioFinal.toFixed(2)} MXN`;

        if (!configSede.cobrarReserva || selectorTarjetas.options.length > 1) {
            btnFinalizar.disabled = false;
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            usuarioLogueado = user.email;
            usuarioActualUID = user.uid;
            document.getElementById('resumen-usuario').textContent = usuarioLogueado;
            await cargarTarjetasBilletera();
        } else {
            window.location.href = '../index.html';
        }
    });

    async function cargarTarjetasBilletera() {
        if (!configSede.cobrarReserva) return; // Si la reserva es gratis no bloqueamos por tarjetas
        selectorTarjetas.innerHTML = '<option value="">Selecciona una tarjeta...</option>';
        try {
            const tarjetasRef = collection(firestoreDB, "usuarios", usuarioActualUID, "metodos_pago");
            const snapshot = await getDocs(tarjetasRef);

            if (snapshot.empty) {
                selectorTarjetas.classList.add('oculto');
                alertaSinTarjetas.classList.remove('oculto');
                btnFinalizar.disabled = true;
                btnFinalizar.style.opacity = '0.5';
                return;
            }

            snapshot.forEach((docSnap) => {
                const t = docSnap.data();
                const ultimosCuatro = t.numero.slice(-4);
                const opcion = document.createElement('option');
                opcion.value = t.numero;
                opcion.textContent = `💳 ${t.nombreCard} (**** ${ultimosCuatro})`;
                selectorTarjetas.appendChild(opcion);
            });
        } catch (error) {
            console.error("Error al cargar tarjetas:", error);
        }
    }

    function generarCodigoReserva() {
        const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let codigo = 'PARK-';
        for (let i = 0; i < 4; i++) {
            codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
        }
        return codigo;
    }

    btnFinalizar.addEventListener('click', () => {
        const numTarjetaSeleccionada = selectorTarjetas.value;

        if (configSede.cobrarReserva && !numTarjetaSeleccionada) {
            alert("Por favor selecciona una tarjeta de tu billetera para proceder con el pago.");
            return;
        }

        btnFinalizar.textContent = configSede.cobrarReserva ? "Procesando con el banco..." : "Asegurando tu cajón...";
        btnFinalizar.disabled = true;

        setTimeout(() => {
            if (configSede.cobrarReserva) {
                if (numTarjetaSeleccionada.endsWith('0000')) {
                    alert("❌ BANCO RECHAZA: Fondos insuficientes en la tarjeta terminación 0000.");
                    btnFinalizar.disabled = false;
                    btnFinalizar.textContent = "Pagar y Generar Código";
                    return;
                }
                if (numTarjetaSeleccionada.endsWith('1111')) {
                    alert("❌ BANCO DECLINA: Tarjeta terminación 1111 bloqueada por seguridad.");
                    btnFinalizar.disabled = false;
                    btnFinalizar.textContent = "Pagar y Generar Código";
                    return;
                }
            }

            const codigoGenerado = generarCodigoReserva();
            const candadoRef = ref(db, `cajones_bloqueados/${cajonSeleccionado}`);

            runTransaction(candadoRef, (estadoActual) => {
                if (estadoActual === null) return codigoGenerado;
                return;
            }).then((resultadoTransaccion) => {
                if (!resultadoTransaccion.committed) {
                    alert("¡Lo sentimos! Alguien más acaba de apartar este cajón.");
                    window.location.href = 'reservas.html';
                    return;
                }

                const ahora = new Date();
                const fechaExpiracion = new Date(ahora);
                // En MODO_DEMO minutosFinales cuenta en segundos para pruebas rápidas; en real son minutos
                if (PARKIL_CONFIG.MODO_DEMO) {
                    fechaExpiracion.setSeconds(ahora.getSeconds() + minutosFinales);
                } else {
                    fechaExpiracion.setMinutes(ahora.getMinutes() + minutosFinales);
                }

                const datosReserva = {
                    usuario: usuarioLogueado,
                    nombre: localStorage.getItem('nombreUsuario') || "Usuario",
                    placa: localStorage.getItem('placaUsuario') || "S/N",
                    cajon: cajonSeleccionado,
                    piso: localStorage.getItem('pisoTemporal') || "1",
                    sensorFisico: localStorage.getItem('sensorFisicoTemporal') || "",
                    estacionamientoId: sedeId,
                    estacionamientoNombre: localStorage.getItem('estacionamientoSeleccionadoNombre') || "Parkil Campeche",
                    tarifaHora: configSede.tarifaHora,
                    cobrarReserva: configSede.cobrarReserva,
                    cobrarMulta: configSede.cobrarMulta,
                    precioMulta: configSede.precioMulta,
                    toleranciaMinutos: configSede.toleranciaMinutos,
                    paquete: paqueteFinal,
                    minutosComprados: minutosFinales,
                    pagoReserva: precioFinal,
                    pagoEstacionamiento: 0,
                    pagoMulta: 0,
                    granTotal: precioFinal,
                    totalLiquidado: precioFinal,
                    totalPagado: precioFinal,
                    codigo: codigoGenerado,
                    timestampCompra: ahora.getTime(),
                    timestampExpiracion: fechaExpiracion.getTime(),
                    fechaTexto: ahora.toLocaleString(),
                    estado: "reservado"
                };

                set(ref(db, 'tickets_activos/' + codigoGenerado), datosReserva).then(() => {
                    localStorage.setItem('ticketActual', JSON.stringify(datosReserva));
                    localStorage.removeItem('cajonTemporal');
                    window.location.href = 'ticket.html';
                });
            });
        }, 1000);
    });
});