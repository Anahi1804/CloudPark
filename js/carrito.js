// js/carrito.js
import { auth, db, firestoreDB, ref, set, runTransaction, onAuthStateChanged, collection, getDocs } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const cajonSeleccionado = localStorage.getItem('cajonTemporal');
    const nombrePaquete = localStorage.getItem('paqueteSeleccionado');
    const precioSeleccionado = parseFloat(localStorage.getItem('precioSeleccionado') || 0);
    const minutosPaquete = parseInt(localStorage.getItem('minutosSeleccionados') || 0);

    const txtCajon = document.getElementById('resumen-cajon');
    const txtPaquete = document.getElementById('resumen-paquete');
    const txtTotal = document.getElementById('monto-total');
    const selectPaquete = document.getElementById('select-paquete');
    
    const btnFinalizar = document.getElementById('btn-finalizar-compra'); // <-- ID Corregido
    const selectorTarjetas = document.getElementById('selector-tarjetas');
    const alertaSinTarjetas = document.getElementById('alerta-sin-tarjetas');

    let usuarioLogueado = null;
    let usuarioActualUID = null;
    let precioFinal = precioSeleccionado;
    let paqueteFinal = nombrePaquete;
    let minutosFinales = minutosPaquete;

    if (!cajonSeleccionado) {
        alert("Faltan datos de la reserva. Regresando...");
        window.location.href = 'reservas.html';
        return;
    }

    txtCajon.textContent = cajonSeleccionado;

    // Detectar cuando el usuario elige un paquete
    selectPaquete.addEventListener('change', () => {
        const opcion = selectPaquete.options[selectPaquete.selectedIndex];
        minutosFinales = parseInt(opcion.value);
        precioFinal = parseFloat(opcion.getAttribute('data-precio'));
        paqueteFinal = opcion.text.split('-')[0].trim(); 
        
        txtTotal.textContent = `$${precioFinal.toFixed(2)} MXN`;
        
        // Habilitamos el botón SOLO si seleccionó paquete Y tiene tarjetas (lo revisamos más abajo)
        if (selectorTarjetas.options.length > 1) { 
            btnFinalizar.disabled = false;
        }
    });

    // 1. Verificamos sesión y cargamos tarjetas
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

    // 💳 2. FUNCIÓN PARA LLENAR EL DESPLEGABLE
    async function cargarTarjetasBilletera() {
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

            snapshot.forEach((doc) => {
                const t = doc.data();
                const ultimosCuatro = t.numero.slice(-4);
                const opcion = document.createElement('option');
                
                opcion.value = t.numero; // Guardamos el num completo oculto
                opcion.textContent = `💳 ${t.nombreCard} (**** ${ultimosCuatro})`;
                selectorTarjetas.appendChild(opcion);
            });
        } catch (error) {
            console.error("Error al cargar tarjetas:", error);
            selectorTarjetas.innerHTML = '<option value="">Error al cargar billetera</option>';
        }
    }

    function generarCodigoReserva() {
        const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let codigo = 'PARK-';
        for (let i = 0; i < 6; i++) {
            codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
        }
        return codigo;
    }

    // 🚀 3. EL CLIC DE PAGAR (SIMULADOR BANCARIO + CONCURRENCIA)
    btnFinalizar.addEventListener('click', () => {
        const numTarjetaSeleccionada = selectorTarjetas.value;

        if (!numTarjetaSeleccionada) {
            alert("⚠️ Por favor selecciona una tarjeta de tu billetera para proceder con el pago.");
            return;
        }

        btnFinalizar.textContent = "Procesando con el banco...";
        btnFinalizar.disabled = true;

        // --- 🏦 SIMULADOR BANCARIO DE CASOS DE USO ---
        setTimeout(() => {
            // Caso 1: Fondos Insuficientes
            if (numTarjetaSeleccionada.endsWith('0000')) {
                alert("🏦 BANCO RECHAZA: Fondos insuficientes en la tarjeta terminación 0000.");
                btnFinalizar.disabled = false;
                btnFinalizar.textContent = "Pagar y Generar Código";
                return; 
            }

            // Caso 2: Tarjeta Bloqueada
            if (numTarjetaSeleccionada.endsWith('1111')) {
                alert("🏦 BANCO DECLINA: Tarjeta terminación 1111 bloqueada por seguridad. Contacte a su banco.");
                btnFinalizar.disabled = false;
                btnFinalizar.textContent = "Pagar y Generar Código";
                return; 
            }

            // Caso 3: PAGO EXITOSO -> Continuamos con el candado de Firebase
            btnFinalizar.textContent = "Asegurando tu cajón...";

            const codigoGenerado = generarCodigoReserva(); 
            const candadoRef = ref(db, `cajones_bloqueados/${cajonSeleccionado}`);

            // 🛡️ TRANSACCIÓN DE CONCURRENCIA
            runTransaction(candadoRef, (estadoActual) => {
                if (estadoActual === null) {
                    return codigoGenerado; 
                } else {
                    return; 
                }
            }).then((resultadoTransaccion) => {
                if (!resultadoTransaccion.committed) {
                    alert("¡Lo sentimos! 🤯 Alguien más acaba de comprar este cajón. Tu tarjeta NO ha sido cobrada.");
                    window.location.href = 'reservas.html';
                    return;
                }

                // SOMOS DUEÑOS DEL CAJÓN
                const ahora = new Date();
                const fechaExpiracion = new Date(ahora);
                fechaExpiracion.setSeconds(ahora.getSeconds() + minutosFinales);

                const datosReserva = {
                    usuario: usuarioLogueado,
                    nombre: localStorage.getItem('nombreUsuario') || "Usuario",
                    placa: localStorage.getItem('placaUsuario') || "S/N",
                    cajon: cajonSeleccionado,
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

                const ticketRef = ref(db, 'tickets_activos/' + codigoGenerado);

                set(ticketRef, datosReserva).then(() => {
                    localStorage.setItem('ticketActual', JSON.stringify(datosReserva));
                    localStorage.removeItem('cajonTemporal');
                    window.location.href = 'ticket.html'; 
                }).catch((error) => {
                    console.error("Error al guardar:", error);
                    alert("Hubo un error de conexión.");
                    btnFinalizar.disabled = false;
                    btnFinalizar.textContent = "Pagar y Generar Código";
                });
            }); 
        }, 1500); 
    });
});
