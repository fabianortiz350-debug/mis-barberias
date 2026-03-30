const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const Brevo = require('@getbrevo/brevo');
const path = require('path'); 
require('dotenv').config(); 

const app = express();

// --- 🛠️ MIDDLEWARES ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); 

// --- 🔌 CONEXIÓN MONGO ---
// Nota: Para máxima seguridad en Render, usa process.env.MONGO_URI
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ DB Conectada exitosamente"))
    .catch(e => console.error("❌ Error crítico en DB:", e));

// --- 🏗️ MODELOS (Esquemas Formales) ---
const usuarioSchema = new mongoose.Schema({
    correo: { type: String, unique: true, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    rol: { type: String, enum: ['SUPER', 'ADMIN', 'STAFF', 'CLIENTE'], default: 'CLIENTE' },
    nombre: String,
    negocioId: { type: String }, // Guardamos el ID como String para simplificar rutas
    codigoVerificacion: String,
    fechaExpiracion: Date
});
const Usuario = mongoose.model('Usuario', usuarioSchema);

const negocioSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    ubicacion: String,
    adminEmail: { type: String, lowercase: true },
    creadoEn: { type: Date, default: Date.now }
});
const Negocio = mongoose.model('Negocio', negocioSchema);

const citaSchema = new mongoose.Schema({
    clienteNombre: String,
    clienteTelefono: String,
    barbero: String, 
    fecha: String,
    hora: String,
    estado: { type: String, enum: ['pendiente', 'confirmada', 'realizada', 'cancelada'], default: 'confirmada' },
    negocioId: String
});
const Cita = mongoose.model('Cita', citaSchema);

// --- ⚙️ CONFIG BREVO ---
const apiInstance = new Brevo.TransactionalEmailsApi();
// Render leerá BREVO_KEY desde la pestaña Environment
const BREVO_KEY = process.env.BREVO_KEY; 

if (BREVO_KEY) {
    apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, BREVO_KEY);
} else {
    console.warn("⚠️ ADVERTENCIA: BREVO_KEY no detectada. Revisa la configuración en Render.");
}

// --- 🔐 RUTAS DE NAVEGACIÓN ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 🔐 SISTEMA DE AUTENTICACIÓN ---

app.post('/api/auth/login', async (req, res) => {
    try {
        const correo = req.body.correo.trim().toLowerCase();
        const { password } = req.body;

        const user = await Usuario.findOne({ correo });
        if (!user) return res.status(404).json({ mensaje: "Usuario no registrado" });

        const passValida = await bcrypt.compare(password, user.password);
        if (!passValida) return res.status(401).json({ mensaje: "Contraseña incorrecta" });

        // Generar código de 6 dígitos
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        user.codigoVerificacion = codigo;
        user.fechaExpiracion = new Date(Date.now() + 10 * 60000); // 10 min
        await user.save();

        // Configuración de envío para Brevo
        const sendEmail = {
            subject: `Tu código de acceso: ${codigo}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #333;">Verificación Agéndate Live</h2>
                    <p>Usa el siguiente código para ingresar al sistema:</p>
                    <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px;">${codigo}</h1>
                    <p style="font-size: 12px; color: #888;">Este código expirará en 10 minutos.</p>
                </div>`,
            sender: { name: "Agendate Live", email: "fabianortiz350@gmail.com" },
            to: [{ email: correo }]
        };
        
        await apiInstance.sendTransacEmail(sendEmail);
        console.log(`📧 Código enviado exitosamente a: ${correo}`);
        res.json({ success: true, mensaje: "Código enviado" });

    } catch (e) { 
        console.error("❌ Error en Login/Brevo:", e.response ? e.response.body : e);
        res.status(500).json({ error: "Error al procesar el inicio de sesión" }); 
    }
});

app.post('/api/auth/verificar', async (req, res) => {
    try {
        const correo = req.body.correo.trim().toLowerCase();
        const { codigo } = req.body;

        const user = await Usuario.findOne({ 
            correo, 
            codigoVerificacion: codigo, 
            fechaExpiracion: { $gt: new Date() } 
        });

        if (user) {
            user.codigoVerificacion = null; // Limpiar código
            await user.save();
            res.json({ 
                success: true, 
                rol: user.rol, 
                correo: user.correo, 
                negocioId: user.negocioId, 
                nombre: user.nombre 
            });
        } else {
            res.status(401).json({ success: false, mensaje: "Código inválido o expirado" });
        }
    } catch (e) { 
        console.error("Error en Verificación:", e);
        res.status(500).json({ error: "Error en el servidor" }); 
    }
});

// --- 🏪 RUTAS NEGOCIOS & STAFF ---

app.post('/api/admin/crear-negocio', async (req, res) => {
    try {
        const { nombre, ubicacion } = req.body;
        const adminEmail = req.body.adminEmail.trim().toLowerCase();

        const existe = await Usuario.findOne({ correo: adminEmail });
        if (existe) return res.status(400).json({ error: "Este correo ya es administrador de un negocio" });

        const nuevoNegocio = new Negocio({ nombre, ubicacion, adminEmail });
        const negocioGuardado = await nuevoNegocio.save();

        const hashedPassword = await bcrypt.hash("Barber2026*", 10);
        const nuevoAdmin = new Usuario({
            correo: adminEmail,
            password: hashedPassword,
            rol: 'ADMIN',
            nombre: `Dueño ${nombre}`,
            negocioId: negocioGuardado._id.toString()
        });
        await nuevoAdmin.save();

        res.json({ success: true, passwordTemporal: "Barber2026*" });
    } catch (e) { 
        console.error("Error al crear negocio:", e);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/admin/registrar-staff', async (req, res) => {
    try {
        const { nombre, correo, password, negocioId } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const nuevoStaff = new Usuario({
            nombre,
            correo: correo.trim().toLowerCase(),
            password: hashedPassword,
            rol: 'STAFF',
            negocioId
        });
        await nuevoStaff.save();
        res.json({ success: true });
    } catch (e) { 
        console.error("Error al registrar staff:", e);
        res.status(500).json({ error: "No se pudo registrar el barbero" }); 
    }
});

app.get('/api/admin/staff/:negocioId', async (req, res) => {
    try {
        const staff = await Usuario.find({ negocioId: req.params.negocioId, rol: 'STAFF' }).select('-password');
        res.json(staff);
    } catch (e) { res.status(500).json({ error: "Error al obtener equipo" }); }
});

// --- 📅 RUTAS CITAS ---

app.get('/api/citas/barbero/:nombre', async (req, res) => {
    try {
        const citas = await Cita.find({ barbero: req.params.nombre });
        res.json(citas);
    } catch (e) { res.status(500).json({ error: "Error al obtener citas" }); }
});

app.get('/api/citas/negocio/:id', async (req, res) => {
    try {
        const citas = await Cita.find({ negocioId: req.params.id });
        res.json(citas);
    } catch (e) { res.status(500).json({ error: "Error al obtener citas del negocio" }); }
});

// --- 🚀 ARRANQUE ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor listo en puerto ${PORT}`);
});