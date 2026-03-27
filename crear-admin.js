const axios = require('axios');

const crearPrimerAdmin = async () => {
    // Configuración del usuario inicial
    const nuevoAdmin = {
        correo: "fabianortiz350@gmail.com", // 👈 Asegúrate de cambiar esto
        password: "Mudhuz-murru4",      // 👈 Usa una clave segura
        rol: "SUPER",                   // Este rol es el que te dará acceso a todo
        nombre: "Fabian Ortiz"
    };

    console.log("🚀 Intentando crear el Super Admin en el servidor...");

    try {
        const res = await axios.post('https://mis-barberias.onrender.com/api/auth/registrar-interno', nuevoAdmin);
        
        console.log("------------------------------------------");
        console.log("✅ ¡SUPER ADMIN CREADO CON ÉXITO!");
        console.log("📧 Correo:", nuevoAdmin.correo);
        console.log("🔑 ID en Base de Datos:", res.data.usuarioId || res.data._id || "Verificado");
        console.log("------------------------------------------");
        
    } catch (e) {
        console.log("------------------------------------------");
        console.error("❌ Error al crear usuario:");
        
        if (e.response) {
            // El servidor respondió con un error (ej: el correo ya existe)
            console.error("Mensaje del servidor:", e.response.data.mensaje || e.response.data);
            console.error("Estado:", e.response.status);
        } else if (e.request) {
            // No hubo respuesta del servidor (posible error de URL o servidor caído)
            console.error("No se recibió respuesta del servidor. Revisa si la URL es correcta o si Render está activo.");
        } else {
            console.error("Error de configuración:", e.message);
        }
        console.log("------------------------------------------");
    }
};

crearPrimerAdmin();