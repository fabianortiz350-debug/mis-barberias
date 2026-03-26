const axios = require('axios');

const crearPrimerAdmin = async () => {
    try {
        const res = await axios.post('https://mis-barberias.onrender.com/api/auth/registrar-interno', {
            correo: "tu-correo@gmail.com", // PON TU CORREO AQUÍ
            password: "TuPasswordSeguro123", // PON TU CONTRASEÑA AQUÍ
            rol: "SUPER",
            nombre: "Fabian Ortiz"
        });
        console.log("✅ Usuario creado con éxito:", res.data);
    } catch (e) {
        console.error("❌ Error al crear usuario:", e.response ? e.response.data : e.message);
    }
};

crearPrimerAdmin();