// js/perfil.js
import { auth, firestoreDB, doc, getDoc, updateDoc, onAuthStateChanged, collection, addDoc, getDocs, deleteDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Variables del Formulario de Perfil
    const inputNombre = document.getElementById('edit-nombre');
    const inputPlaca = document.getElementById('edit-placa');
    const formPerfil = document.getElementById('form-editar-perfil');
    const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');
    const mensajeUI = document.getElementById('mensaje-perfil');

    // Variables de la Billetera de Tarjetas
    const listaTarjetasUI = document.getElementById('lista-tarjetas');
    const formTarjeta = document.getElementById('form-nueva-tarjeta');
    const btnMostrarForm = document.getElementById('btn-mostrar-form-tarjeta');
    const btnCancelarTarjeta = document.getElementById('btn-cancelar-tarjeta');

    let usuarioActualUID = null;

    // Función auxiliar para mostrar alertas de UX
    function mostrarMensaje(mensaje, tipo) {
        mensajeUI.textContent = mensaje;
        mensajeUI.className = 'mensaje-terminal'; 
        mensajeUI.classList.add(tipo);
        mensajeUI.classList.remove('oculto');
        setTimeout(() => { mensajeUI.classList.add('oculto'); }, 4000);
    }

    // --- 1. CARGAR DATOS AL ENTRAR ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            usuarioActualUID = user.uid;
            cargarDatosUsuario();
            cargarTarjetas(); //  Carga la billetera
        } else {
            window.location.href = '../index.html';
        }
    });

    async function cargarDatosUsuario() {
        const docRef = doc(firestoreDB, "usuarios", usuarioActualUID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            inputNombre.value = docSnap.data().nombre || "";
            inputPlaca.value = docSnap.data().placa || "";
        }
    }

    async function cargarTarjetas() {
        listaTarjetasUI.innerHTML = "";
        // Buscamos en la sub-colección 'metodos_pago'
        const tarjetasRef = collection(firestoreDB, "usuarios", usuarioActualUID, "metodos_pago");
        const querySnapshot = await getDocs(tarjetasRef);

        if (querySnapshot.empty) {
            listaTarjetasUI.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center;">No tienes tarjetas registradas.</p>`;
            return;
        }

        querySnapshot.forEach((docTarj) => {
            const t = docTarj.data();
            const id = docTarj.id;
            // Solo mostramos los últimos 4 dígitos
            const ultimosCuatro = t.numero.slice(-4);
            
            const cardDiv = document.createElement('div');
            cardDiv.style = "background: rgba(255,255,255,0.05); border: 1px solid var(--border-dark); border-radius: 12px; padding: 12px; display: flex; justify-content: space-between; align-items: center;";
            cardDiv.innerHTML = `
                <div>
                    <strong style="color: white; font-size: 0.9rem;">${t.nombreCard}</strong><br>
                    <span style="color: var(--spot-selected); font-family: monospace;">**** **** **** ${ultimosCuatro}</span>
                </div>
                <button class="btn-borrar-tarjeta" data-id="${id}" style="background: transparent; border: none; color: var(--danger-neon); cursor: pointer;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            `;
            listaTarjetasUI.appendChild(cardDiv);
        });

        // Evento para borrar tarjetas
        document.querySelectorAll('.btn-borrar-tarjeta').forEach(btn => {
            btn.addEventListener('click', async () => {
                if(confirm("¿Eliminar este método de pago?")) {
                    await deleteDoc(doc(firestoreDB, "usuarios", usuarioActualUID, "metodos_pago", btn.dataset.id));
                    cargarTarjetas();
                }
            });
        });
    }

    // --- 2. MOSTRAR / OCULTAR FORMULARIO BILLETERA ---
    btnMostrarForm.addEventListener('click', () => {
        formTarjeta.classList.remove('oculto');
        btnMostrarForm.classList.add('oculto');
    });

    btnCancelarTarjeta.addEventListener('click', () => {
        formTarjeta.classList.add('oculto');
        btnMostrarForm.classList.remove('oculto');
    });

// --- 3. GUARDAR NUEVA TARJETA Y VALIDACIONES ---

    // UX: Formateo automático mientras el usuario escribe
    const inputCardNum = document.getElementById('card-numero');
    const inputCardExp = document.getElementById('card-exp');
    const inputCardCvv = document.getElementById('card-cvv');

    if(inputCardNum && inputCardExp && inputCardCvv) {
        // Separa la tarjeta de 4 en 4 y prohíbe letras
        inputCardNum.addEventListener('input', function (e) {
            this.value = this.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
        });

        // Agrega la diagonal automática en la fecha (MM/AA)
        inputCardExp.addEventListener('input', function (e) {
            this.value = this.value.replace(/\D/g, ''); // Solo números
            if (this.value.length > 2) {
                this.value = this.value.substring(0, 2) + '/' + this.value.substring(2, 4);
            }
        });

        // Prohíbe letras en el CVV
        inputCardCvv.addEventListener('input', function (e) {
            this.value = this.value.replace(/\D/g, '');
        });
    }

    // Lógica de Guardado con Seguridad Bancaria
    formTarjeta.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nombreCard = document.getElementById('card-nombre').value.trim();
        const numOriginal = inputCardNum.value;
        const numLimpio = numOriginal.replace(/\s/g, ''); // Le quitamos los espacios para la base de datos
        const exp = inputCardExp.value;
        const cvv = inputCardCvv.value;

        //  1. Validar Número de Tarjeta (Exactamente 16 números)
        const regexNum = /^\d{16}$/;
        if (!regexNum.test(numLimpio)) {
            alert("❌ Número inválido: La tarjeta debe tener exactamente 16 números.");
            return;
        }

        //  2. Validar Fecha de Vencimiento (Mes 01-12, Año 2 números)
        const regexExp = /^(0[1-9]|1[0-2])\/\d{2}$/;
        if (!regexExp.test(exp)) {
            alert("❌ Fecha inválida: Usa el formato de mes válido y año (Ej. 12/25).");
            return;
        }

        // 3. Validar CVV (Exactamente 3 o 4 números)
        const regexCvv = /^\d{3,4}$/;
        if (!regexCvv.test(cvv)) {
            alert("❌ CVV inválido: Deben ser 3 o 4 números de seguridad.");
            return;
        }

        const nuevaCard = {
            nombreCard: nombreCard,
            numero: numLimpio,
            exp: exp,
            cvv: cvv,
            fechaRegistro: new Date().getTime()
        };

        const btnGuardar = formTarjeta.querySelector('button[type="submit"]');
        btnGuardar.textContent = "Guardando...";
        btnGuardar.disabled = true;

        try {
            const tarjetasRef = collection(firestoreDB, "usuarios", usuarioActualUID, "metodos_pago");
            await addDoc(tarjetasRef, nuevaCard);
            
            formTarjeta.reset();
            formTarjeta.classList.add('oculto');
            btnMostrarForm.classList.remove('oculto');
            cargarTarjetas();
            
            // Usamos tu función de mensaje verde para que se vea bonito
            mostrarMensaje("¡Tarjeta agregada de forma segura!", "exito");
        } catch (error) {
            console.error("Error al guardar tarjeta:", error);
            mostrarMensaje("Hubo un problema al guardar la tarjeta.", "error");
        }

        btnGuardar.textContent = "Guardar Tarjeta";
        btnGuardar.disabled = false;
    });

    
    // --- 4. GUARDAR / ACTUALIZAR DATOS DE PERFIL ---
    formPerfil.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nuevoNombre = inputNombre.value.trim();
        const nuevaPlaca = inputPlaca.value.trim().toUpperCase();

        //  VALIDACIÓN DE PLACA ESTRICTA
        const regexPlaca = /^[A-Z]{3,4}-\d{2,4}$/;
        if (!regexPlaca.test(nuevaPlaca)) {
            mostrarMensaje("Placa inválida. Usa formato real (Ej. YZA-1234)", "error");
            return;
        }

        btnGuardarPerfil.textContent = "Guardando en nube...";
        btnGuardarPerfil.disabled = true;

        try {
            const docRef = doc(firestoreDB, "usuarios", usuarioActualUID);
            await updateDoc(docRef, {
                nombre: nuevoNombre,
                placa: nuevaPlaca
            });

            // Actualizamos la memoria local para que el dashboard y el carrito se enteren rápido
            localStorage.setItem('nombreUsuario', nuevoNombre);
            localStorage.setItem('placaUsuario', nuevaPlaca);

            mostrarMensaje("¡Datos actualizados con éxito!", "exito");
        } catch (error) {
            console.error("Error al actualizar:", error);
            mostrarMensaje("Error al guardar cambios.", "error");
        }

        btnGuardarPerfil.textContent = "Guardar Cambios";
        btnGuardarPerfil.disabled = false;
    });
});