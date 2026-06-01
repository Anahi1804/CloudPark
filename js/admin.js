// js/admin.js
import { auth, firestoreDB, db, onAuthStateChanged, collection, getDocs, ref, onValue, set, doc, setDoc, update } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (!user) window.location.href = '../index.html';
    });

    // --- FUNCIÓN DE NOTIFICACIONES ELEGANTES (TOAST) ---
    function showToast(mensaje, tipo = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        
        let icono = '';
        if(tipo === 'success') icono = '✅';
        if(tipo === 'error') icono = '❌';
        if(tipo === 'info') icono = 'ℹ️';

        const toast = document.createElement('div');
        toast.className = `toast ${tipo}`;
        toast.innerHTML = `<span>${icono}</span> <span>${mensaje}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    const tablaBody = document.getElementById('tabla-body-historial');
    const statIngresos = document.getElementById('stat-ingresos');
    const statTickets = document.getElementById('stat-tickets');
    const mapaContainer = document.getElementById('admin-mapa-container');
    const infoVehiculo = document.getElementById('info-vehiculo');
    const filtroHistorial = document.getElementById('filtro-historial');
    const btnExportar = document.getElementById('btn-exportar-csv');

    let historialGlobal = []; 
    let chartInstancia = null; 

    // --- CARGAR HISTORIAL Y GRÁFICAS ---
    async function cargarHistorial() {
        try {
            const querySnapshot = await getDocs(collection(firestoreDB, "historial_tickets"));
            let totalDinero = 0;
            let totalTickets = 0;
            historialGlobal = [];

            // Contadores para la gráfica
            let paquetesCount = { 'Express': 0, 'Estándar': 0, 'Reunión': 0, 'Máximo': 0 };

            querySnapshot.forEach((documento) => {
                const ticket = documento.data(); 
                ticket.idReal = documento.id; 
                historialGlobal.push(ticket);

                const reserva = Number(ticket.pagoReserva) || 0;
                const tiempo = Number(ticket.pagoEstacionamiento) || 0;
                const multa = Number(ticket.pagoMulta) || 0;
                const sumaTotal = Number(ticket.granTotal) || (reserva + tiempo + multa);

                // 🐛 CORRECCIÓN DE LA GRÁFICA: Ignoramos los emojis buscando la palabra clave
                const paq = ticket.paquete || "";
                if (paq.includes('Express')) paquetesCount['Express']++;
                else if (paq.includes('Estándar')) paquetesCount['Estándar']++;
                else if (paq.includes('Reunión')) paquetesCount['Reunión']++;
                else if (paq.includes('Máximo')) paquetesCount['Máximo']++;

                totalTickets++;
                totalDinero += sumaTotal; 
            });

            statTickets.textContent = totalTickets;
            statIngresos.textContent = `$${totalDinero.toFixed(2)}`;
            renderizarTablaHistorial(historialGlobal);
            
            // Dibujamos la dona si hay datos
            if (totalTickets > 0) dibujarGrafica(paquetesCount);

        } catch (error) {
            console.error("Error al cargar historial:", error);
        }
    }

    function dibujarGrafica(conteo) {
        const ctx = document.getElementById('graficaPaquetes');
        if(!ctx) return; // Por si no ha cargado el HTML

        if (chartInstancia) chartInstancia.destroy(); // Limpiamos la anterior

        chartInstancia = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Express', 'Estándar', 'Reunión', 'Máximo'],
                datasets: [{
                    data: [conteo['Express'], conteo['Estándar'], conteo['Reunión'], conteo['Máximo']],
                    backgroundColor: ['#0A84FF', '#32D74B', '#FFD60A', '#BF5AF2'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#8E8E93' } }
                }
            }
        });
    }

    function renderizarTablaHistorial(datos) {
        let htmlTabla = '';
        if (datos.length === 0) {
            tablaBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No hay tickets encontrados.</td></tr>`;
            return;
        }

        datos.forEach(ticket => {
            const reserva = Number(ticket.pagoReserva) || 0;
            const tiempo = Number(ticket.pagoEstacionamiento) || 0;
            const multa = Number(ticket.pagoMulta) || 0;
            const sumaTotal = Number(ticket.granTotal) || (reserva + tiempo + multa);

            const nombreCliente = ticket.nombre || "Cliente Web";
            const placaCliente = ticket.placa || "N/A";
            
            let tiempoTexto = "--";
            if (ticket.timestampIngresoFisico && ticket.timestampSalida) {
                const min = Math.ceil((ticket.timestampSalida - ticket.timestampIngresoFisico) / 60000);
                tiempoTexto = `${min} min`;
            }

            let uiDinero = `<strong style="color: var(--success-neon); font-size: 1.1rem;">$${sumaTotal.toFixed(2)}</strong><br>`;
            uiDinero += `<span style="font-size: 0.75rem; color: var(--text-muted);">Reserva: $${reserva.toFixed(2)}</span><br>`;
            if (tiempo > 0) uiDinero += `<span style="font-size: 0.75rem; color: var(--text-muted);">Tiempo: $${tiempo.toFixed(2)}</span><br>`;
            if (multa > 0) uiDinero += `<span style="font-size: 0.75rem; color: var(--danger-neon);">Multa: +$${multa.toFixed(2)}</span>`;

            htmlTabla += `
                <tr>
                    <td style="font-family: monospace; color: var(--spot-selected);">${ticket.idReal.substring(0,8)}...</td>
                    <td><strong>${nombreCliente}</strong><br><span style="font-size: 0.8rem; color: var(--text-muted);">${placaCliente}</span></td>
                    <td><strong>${ticket.cajon}</strong></td>
                    <td>${tiempoTexto}</td>
                    <td>${uiDinero}</td>
                    <td><span class="badge-pagado">Completado</span></td>
                </tr>
            `;
        });
        tablaBody.innerHTML = htmlTabla;
    }

    cargarHistorial();

    if(filtroHistorial) {
        filtroHistorial.addEventListener('input', (e) => {
            const texto = e.target.value.toLowerCase();
            const filtrados = historialGlobal.filter(t => 
                (t.placa && t.placa.toLowerCase().includes(texto)) || 
                (t.nombre && t.nombre.toLowerCase().includes(texto))
            );
            renderizarTablaHistorial(filtrados);
        });
    }

    if (btnExportar) {
        btnExportar.addEventListener('click', () => {
            let csv = "ID_Ticket,Cliente,Placa,Cajon,Pago_Reserva,Pago_Tiempo,Pago_Multa,Total\n";
            historialGlobal.forEach(t => {
                const reserva = Number(t.pagoReserva) || 0;
                const tiempo = Number(t.pagoEstacionamiento) || 0;
                const multa = Number(t.pagoMulta) || 0;
                const total = Number(t.granTotal) || (reserva+tiempo+multa);
                csv += `${t.idReal},${t.nombre},${t.placa},${t.cajon},$${reserva},$${tiempo},$${multa},$${total}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "Reporte_CloudPark.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("Reporte Excel descargado con éxito", "success");
        });
    }


// --- 🗑️ RECOLECTOR DE BASURA SUPER AGRESIVO ---
    let adminTicketsActivos = {};
    let adminEstadoFisico = {};

    setInterval(() => {
        const ahora = new Date().getTime();
        
        for (let id in adminTicketsActivos) {
            let t = adminTicketsActivos[id];
            
            if (t.estado === 'reservado' && t.timestampExpiracion) {
                const limiteConTolerancia = t.timestampExpiracion + 60000;
                const segundosRestantes = Math.floor((limiteConTolerancia - ahora) / 1000);
                
                if (segundosRestantes > 0 && segundosRestantes <= 60) {
                    console.log(`⏳ Ticket ${id} será eliminado en ${segundosRestantes} segundos...`);
                }

                // Usamos <= 0 para atraparlo incluso si Chrome pausó el reloj por unos segundos
                if (segundosRestantes <= 0) {
                    console.log(`💥 [SISTEMA] El ticket ${id} expiró. Ejecutando exterminio...`);
                    
                    try {
                        // 1. Borramos el ticket de la RTDB instantáneamente
                        set(ref(db, `tickets_activos/${id}`), null)
                            .then(() => console.log(`✅ Ticket ${id} fulminado de la base de datos.`));
                        
                        // 2. Liberamos el candado del cajón
                        if (t.cajon) {
                            set(ref(db, `cajones_bloqueados/${t.cajon}`), null);
                        }
                        
                        showToast(`Cajón ${t.cajon} liberado (Reserva expirada)`, 'error');
                        
                        // 3. Lo sacamos de nuestra memoria local para no borrarlo 2 veces
                        delete adminTicketsActivos[id];

                    } catch (error) {
                        console.error("❌ Error en el Recolector:", error);
                    }
                }
            }
        }
    }, 3000); // ⏱️ Lo bajamos a 3 segundos para que sea ultra rápido


    // --- MATRIZ DE ESTADOS EN TIEMPO REAL ---
    const ticketsActivosRef = ref(db, 'tickets_activos');
    const sensoresFisicosRef = ref(db, 'estacionamiento_actual');

    onValue(ticketsActivosRef, (snapshot) => {
        adminTicketsActivos = snapshot.val() || {};
        dibujarMapaAdmin();
    });

    onValue(sensoresFisicosRef, (snapshot) => {
        adminEstadoFisico = snapshot.val() || {};
        const equivalenciasInversas = {
            'cajon_1': 'A1', 'cajon_2': 'A2', 'cajon_3': 'A3',
            'cajon_4': 'B1', 'cajon_5': 'B2', 'cajon_6': 'B3'
        };
        for(let keySensor in adminEstadoFisico) {
            let estado = String(adminEstadoFisico[keySensor]).trim().toLowerCase();
            if(estado === 'ocupado') {
                let nombreCajon = equivalenciasInversas[keySensor];
                for(let idTicket in adminTicketsActivos) {
                    let t = adminTicketsActivos[idTicket];
                    if(t.cajon === nombreCajon && t.estado === 'en_uso' && !t.timestampIngresoFisico) {
                        update(ref(db, `tickets_activos/${idTicket}`), {
                            timestampIngresoFisico: new Date().getTime()
                        });
                    }
                }
            }
        }
        dibujarMapaAdmin();
    });

    function dibujarMapaAdmin() {
        const equivalencias = { 'A1': 'cajon_1', 'A2': 'cajon_2', 'A3': 'cajon_3', 'B1': 'cajon_4', 'B2': 'cajon_5', 'B3': 'cajon_6' };
        let infoPorCajon = {};
        for (let id in adminTicketsActivos) {
            infoPorCajon[adminTicketsActivos[id].cajon] = { id: id, ...adminTicketsActivos[id] };
        }
        let htmlMapa = `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">`;
        ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'].forEach(cajon => {
            const idSensor = equivalencias[cajon];
            const estadoSensor = adminEstadoFisico[idSensor]; 
            const ticketInfo = infoPorCajon[cajon];

            let colorFondo = 'rgba(255,255,255,0.02)';
            let colorBorde = 'var(--border-dark)';
            let colorTexto = 'var(--text-muted)';
            let etiqueta = 'LIBRE';
            let brillo = 'none';

            if (estadoSensor === 'ocupado') {
                if (ticketInfo && ticketInfo.estado === 'multado') {
                    colorFondo = 'rgba(255, 0, 255, 0.1)'; colorBorde = '#FF00FF'; colorTexto = '#FF00FF'; etiqueta = 'MULTADO'; brillo = '0 0 15px rgba(255, 0, 255, 0.4)';
                } else if (!ticketInfo || ticketInfo.estado === 'reservado') {
                    colorFondo = 'rgba(255, 149, 0, 0.15)'; colorBorde = '#FF9500'; colorTexto = '#FF9500'; etiqueta = 'OBSTRUIDO';
                } else {
                    colorFondo = 'rgba(255, 69, 58, 0.15)'; colorBorde = 'var(--danger-neon)'; colorTexto = 'var(--danger-neon)'; etiqueta = 'OCUPADO';
                }
            } else {
                if (ticketInfo) {
                    if (ticketInfo.estado === 'multado') {
                        colorFondo = 'rgba(191, 90, 242, 0.1)'; colorBorde = '#FF00FF'; colorTexto = '#FF00FF'; etiqueta = 'MULTA PENDIENTE';
                    } else if (ticketInfo.estado === 'en_uso' || ticketInfo.estado === 'pagado') {
                        colorFondo = 'rgba(191, 90, 242, 0.1)'; colorBorde = '#BF5AF2'; colorTexto = '#BF5AF2'; etiqueta = 'EN TRÁNSITO'; brillo = 'inset 0 0 10px rgba(191, 90, 242, 0.3)';
                    } else if (ticketInfo.estado === 'reservado') {
                        colorFondo = 'rgba(255, 214, 10, 0.1)'; colorBorde = '#FFD60A'; etiqueta = 'RESERVADO';
                    }
                }
            }

            htmlMapa += `
                <div class="cajon-admin" data-cajon="${cajon}" style="background: ${colorFondo}; border: 2px solid ${colorBorde}; box-shadow: ${brillo}; border-radius: 8px; padding: 1rem; text-align: center; cursor: pointer; transition: all 0.3s;">
                    <strong style="color: #fff; font-size: 1.2rem;">${cajon}</strong><br>
                    <span style="font-size: 0.7rem; color: ${colorTexto}; text-transform: uppercase; font-weight: bold;">${etiqueta}</span>
                </div>
            `;
        });
        htmlMapa += `</div>`;
        mapaContainer.innerHTML = htmlMapa;

        document.querySelectorAll('.cajon-admin').forEach(btn => {
            btn.addEventListener('click', () => {
                const cajonSeleccionado = btn.getAttribute('data-cajon');
                const datos = infoPorCajon[cajonSeleccionado];
                if (datos) {
                    mostrarInfo(datos);
                } else {
                    infoVehiculo.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted);"><p>Cajón vacío y sin reservas.</p></div>`;
                }
            });
        });
    }

    function mostrarInfo(datos) {
        let tiempoVivo = '<span style="color: var(--text-muted); font-size: 1.1rem;">Aún en tránsito</span>';
        if (datos.timestampIngresoFisico) {
            const minutos = Math.floor((new Date().getTime() - datos.timestampIngresoFisico) / 60000);
            tiempoVivo = `<span style="color: #FFFFFF; font-weight: bold; font-size: 1.4rem;">${minutos} <small style="font-size: 0.9rem; color: var(--text-muted);">min</small></span>`;
        }

        let botonesAccion = '';
        if (datos.estado === 'reservado') {
            botonesAccion = `<button id="btn-cancelar-reserva" data-id="${datos.id}" data-cajon="${datos.cajon}" style="width: 100%; padding: 10px; background: rgba(255, 69, 58, 0.2); border: 1px solid var(--danger-neon); color: var(--danger-neon); border-radius: 8px; cursor: pointer; font-weight: bold;">🚫 Cancelar Reserva</button>`;
        } else {
            botonesAccion = `<button id="btn-forzar-salida" data-id="${datos.id}" data-cajon="${datos.cajon}" style="width: 100%; padding: 10px; background: rgba(255, 149, 0, 0.2); border: 1px solid #FF9500; color: #FF9500; border-radius: 8px; cursor: pointer; font-weight: bold;">🧹 Forzar Finalización</button>`;
        }

        infoVehiculo.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1.2rem; width: 100%;">
                <div style="border-bottom: 1px dashed var(--border-dark); padding-bottom: 0.5rem; display: flex; justify-content: space-between;">
                    <div>
                        <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Estado</span><br>
                        <strong style="color: var(--spot-selected); font-size: 1.3rem;">${datos.estado}</strong>
                    </div>
                    <div style="text-align: right;">
                        <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Cajón</span><br>
                        <strong style="color: #fff; font-size: 1.3rem;">${datos.cajon}</strong>
                    </div>
                </div>
                <div style="border-bottom: 1px dashed var(--border-dark); padding-bottom: 0.5rem;">
                    <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Cliente / Código</span><br>
                    <strong style="color: #fff; font-size: 1rem;">${datos.nombre} (${datos.placa})</strong><br>
                    <span style="color: var(--spot-selected); font-family: monospace;">${datos.id}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Tiempo</span><br>
                        ${tiempoVivo}
                    </div>
                </div>
                <div style="margin-top: 10px;">${botonesAccion}</div>
            </div>
        `;

        const btnCancelar = document.getElementById('btn-cancelar-reserva');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', (e) => {
                if(confirm("¿Cancelar esta reserva? El lugar quedará libre.")) {
                    const idT = e.target.getAttribute('data-id');
                    const caj = e.target.getAttribute('data-cajon');
                    set(ref(db, `tickets_activos/${idT}`), null);
                    set(ref(db, `cajones_bloqueados/${caj}`), null);
                    showToast("Reserva cancelada exitosamente.", "success");
                    infoVehiculo.innerHTML = `<p style="color: var(--text-muted); text-align: center;">Reserva cancelada.</p>`;
                }
            });
        }

        const btnForzar = document.getElementById('btn-forzar-salida');
        if (btnForzar) {
            btnForzar.addEventListener('click', async (e) => {
                if(confirm("ATENCIÓN: Esto sacará al auto del sistema. ¿Continuar?")) {
                    const idT = e.target.getAttribute('data-id');
                    const caj = e.target.getAttribute('data-cajon');
                    const ticketAForzar = adminTicketsActivos[idT];
                    ticketAForzar.estadoFinal = "completado_forzoso";
                    ticketAForzar.timestampSalida = new Date().getTime();
                    
                    await setDoc(doc(firestoreDB, "historial_tickets", idT), ticketAForzar);
                    set(ref(db, `tickets_activos/${idT}`), null);
                    set(ref(db, `cajones_bloqueados/${caj}`), null);
                    
                    showToast("Vehículo removido del sistema.", "success");
                    infoVehiculo.innerHTML = `<p style="color: var(--text-muted); text-align: center;">Ticket finalizado y cajón liberado.</p>`;
                    cargarHistorial(); 
                }
            });
        }
    }

    const btnEmergenciaEntrada = document.getElementById('btn-emergencia-entrada');
    const btnEmergenciaSalida = document.getElementById('btn-emergencia-salida');

    if(btnEmergenciaEntrada) {
        btnEmergenciaEntrada.addEventListener('click', () => {
            set(ref(db, 'control_plumas/entrada'), 'abrir');
            showToast("Señal enviada: Abriendo pluma de Entrada", "info");
        });
    }

    if(btnEmergenciaSalida) {
        btnEmergenciaSalida.addEventListener('click', () => {
            set(ref(db, 'control_plumas/salida'), 'abrir');
            showToast("Señal enviada: Abriendo pluma de Salida", "info");
        });
    }

    const inputBusqueda = document.getElementById('input-busqueda-admin');
    const btnBuscar = document.getElementById('btn-buscar-admin');
    const divResultado = document.getElementById('resultado-busqueda');

    if (btnBuscar && inputBusqueda) {
        inputBusqueda.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); btnBuscar.click(); }
        });

        btnBuscar.addEventListener('click', () => {
            const query = inputBusqueda.value.trim().toUpperCase();
            if (!query) { showToast("Por favor ingresa una placa o código.", "error"); return; }

            btnBuscar.textContent = "Buscando...";
            divResultado.classList.add('oculto');
            
            let ticketEncontrado = null;
            let idTicketEncontrado = null;

            for (let id in adminTicketsActivos) {
                const t = adminTicketsActivos[id];
                if (id.trim().toUpperCase() === query || (t.placa || "").trim().toUpperCase() === query) {
                    ticketEncontrado = t;
                    idTicketEncontrado = id;
                    break; 
                }
            }

            setTimeout(() => {
                btnBuscar.textContent = "Buscar Cliente";
                divResultado.classList.remove('oculto');

                if (!ticketEncontrado) {
                    divResultado.innerHTML = `<div style="text-align: center; padding: 10px;"><p style="color: var(--danger-neon); margin: 0; font-weight: bold; font-size: 1.1rem;">❌ Vehículo no encontrado</p></div>`;
                    return;
                }

                let colorEstado = "#32D74B"; 
                let accionHTML = "";
                let mensajeDeuda = "Todo pagado";

                if (ticketEncontrado.estado === 'multado') {
                    colorEstado = "#FF00FF";
                    mensajeDeuda = `DEBE MULTA: $${ticketEncontrado.pagoMulta}`;
                    accionHTML = `<button class="btn-resolver-plan-b" data-id="${idTicketEncontrado}" style="background: #FF00FF; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; width: 100%; font-size: 1rem;">💵 Cobrar Efectivo y Abrir</button>`;
                } else if (ticketEncontrado.estado === 'en_uso' || ticketEncontrado.estado === 'reservado') {
                    colorEstado = "#FFD60A";
                    mensajeDeuda = "Ticket en curso";
                    accionHTML = `<button class="btn-abrir-plan-b" data-id="${idTicketEncontrado}" style="background: transparent; border: 2px solid var(--spot-selected); color: var(--spot-selected); padding: 12px; border-radius: 8px; cursor: pointer; width: 100%; font-size: 1rem;">🚨 Forzar Apertura</button>`;
                } else if (ticketEncontrado.estado === 'pagado') {
                    accionHTML = `<button class="btn-abrir-plan-b" data-id="${idTicketEncontrado}" style="background: var(--success-neon); color: black; border: none; padding: 12px; border-radius: 8px; cursor: pointer; width: 100%; font-size: 1rem;">✅ Ya pagó. Abrir Pluma</button>`;
                }

                divResultado.innerHTML = `
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-dark); padding-bottom: 10px;">
                        <div>
                            <p style="margin: 0; color: var(--text-muted); font-size: 0.75rem;">CLIENTE</p>
                            <strong style="color: white; font-size: 1.2rem;">${ticketEncontrado.nombre}</strong><br>
                            <span style="color: var(--spot-selected); font-family: monospace;">${idTicketEncontrado}</span> | Placa: <strong>${ticketEncontrado.placa}</strong>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; color: var(--text-muted); font-size: 0.75rem;">ESTADO</p>
                            <strong style="color: ${colorEstado}; font-size: 1.1rem;">${mensajeDeuda}</strong><br>
                            <span style="color: white; font-size: 0.9rem;">Cajón: ${ticketEncontrado.cajon}</span>
                        </div>
                    </div>
                    <div style="margin-top: 15px;">${accionHTML}</div>
                `;

                const btnResolver = divResultado.querySelector('.btn-resolver-plan-b');
                if (btnResolver) {
                    btnResolver.addEventListener('click', () => {
                        set(ref(db, `tickets_activos/${idTicketEncontrado}/estado`), 'pagado');
                        set(ref(db, 'control_plumas/salida'), 'abrir');
                        showToast("Pago registrado. Abriendo pluma...", "success");
                        divResultado.innerHTML = `<p style="color: var(--success-neon); text-align: center; font-weight: bold;">Pluma abierta y pago resuelto.</p>`;
                    });
                }

                const btnAbrir = divResultado.querySelector('.btn-abrir-plan-b');
                if (btnAbrir) {
                    btnAbrir.addEventListener('click', () => {
                        set(ref(db, 'control_plumas/salida'), 'abrir');
                        showToast("Señal enviada: Abriendo pluma", "info");
                    });
                }
            }, 600); 
        });
    }
});
