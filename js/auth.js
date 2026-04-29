// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('formulario-login');
    const mensajeError = document.getElementById('mensaje-error');

    formulario.addEventListener('submit', (evento) => {
        evento.preventDefault(); // Evita que la página se recargue al enviar el formulario

        const usuario = document.getElementById('usuario').value;
        const password = document.getElementById('password').value;

        // Validación simulada (puedes cambiar la contraseña aquí)
        if (usuario !== '' && password === '1234') {
            
            // Guardamos el correo/usuario en la memoria del navegador
            localStorage.setItem('usuarioLogueado', usuario);
            
            // Ocultamos el error por si estaba visible
            mensajeError.classList.add('oculto');
            
            // REDIRECCIÓN: Entramos a la carpeta html/ para buscar la vista de reservas
            window.location.href = 'html/dashboard.html';
            
        } else {
            // Mostramos el mensaje de error si la contraseña falla
            mensajeError.classList.remove('oculto');
        }
    });
});