// ... (Toda la parte inicial de importaciones y modelos se mantiene igual)

// --- ⚙️ CONFIGURACIÓN BREVO (Ajuste de seguridad) ---
let apiInstance = new Brevo.TransactionalEmailsApi();
if (process.env.BREVO_KEY) {
    let apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = process.env.BREVO_KEY;
}

// ... (Ruta de Login se mantiene igual)

// --- 💇 RUTAS PARA EMPLEADOS (STAFF) ---
app.get('/api/citas/empleado/:nombre', async (req, res) => {
    try {
        const { fecha } = req.query;
        // Usamos una expresión regular para que no importe si es Mayúscula o Minúscula
        const citas = await Cita.find({ 
            barbero: { $regex: new RegExp("^" + req.params.nombre + "$", "i") }, 
            fecha: fecha 
        }).sort({ hora: 1 });
        res.json(citas);
    } catch (e) {
        res.status(500).json({ error: "Error al obtener citas" });
    }
});

// ... (Rutas de Admin y Negocios se mantienen igual)

// --- 🛠️ INICIALIZACIÓN (Ajuste para asegurar acceso) ---
async function cargarDatosIniciales() {
    try {
        const adminExiste = await Usuario.findOne({ correo: "dueno@test.com" });
        if (!adminExiste) {
            await Usuario.create({ 
                correo: "dueno@test.com", 
                password: "123", 
                rol: "ADMIN", 
                nombreEmpleado: "Dueño" 
            });
            console.log("✅ Usuario Admin creado");
        }
        
        const staffExiste = await Usuario.findOne({ correo: "juan@test.com" });
        if (!staffExiste) {
            await Usuario.create({ 
                correo: "juan@test.com", 
                password: "123", 
                rol: "STAFF", 
                nombreEmpleado: "Juan" 
            });
            console.log("✅ Usuario Staff creado");
        }
    } catch (e) {
        console.error("Error en inicialización:", e);
    }
}

const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));