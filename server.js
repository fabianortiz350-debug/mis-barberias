const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const Brevo = require('@getbrevo/brevo');
const path = require('path'); 
require('dotenv').config(); // Importante para la seguridad de tus llaves

const app = express();

// --- 🛠️ MIDDLEWARES ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); 

// --- 🔌 CONEXIÓN MONGO ---
// Nota: En producción, usa process.env.MONGO_URI
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
    negocioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Negocio' }, 
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
// Prioriza la variable de entorno para seguridad profesional
const BREVO_KEY = process.env.BREVO_KEY || 'TU_API_KEY_AQUI'; 
apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, BREVO_KEY);

// --- 🔐 SISTEMA AUTH ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const correo = req.body.correo.trim().toLowerCase();
        const { password } = req.body;

        const user = await Usuario.findOne({ correo });
        if (!user) return res.status(404).json({ mensaje: "Usuario no encontrado" });

        const passValida = await bcrypt.compare(password, user.password);
        if (!passValida) return res.status(401).json({ mensaje: "Credenciales inválidas" });

        // Generar código de 6 dígitos
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        user.codigoVerificacion = codigo;
        user.fechaExpiracion = new Date(Date.now() + 10 * 60000); 
        await user.save();

        // Enviar Email
        let sendEmail = new Brevo.SendSmtpEmail();
        sendEmail.subject = `Tu código de acceso: ${codigo}`;
        sendEmail.htmlContent = `
            <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                <h2 style="color: #333;">Verificación de Acceso</h2>
                <p>Tu código de seguridad es:</p>
                <h1 style="color: #007bff; letter-spacing: 5px;">${codigo}</h1>
                <p>Este código expira en 10 minutos.</p>
            </div>`;
        sendEmail.sender = { name: "Agendate Live", email: "fabianortiz350@gmail.com" };
        sendEmail.to = [{ email: correo }];
        
        await apiInstance.sendTransacEmail(sendEmail);
        res.json({ success: true, mensaje: "Código de verificación enviado" });
    } catch (e) { 
        console.error("Error Login:", e);
        res.status(500).json({ error: "Error interno en el servidor" }); 
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
            user.codigoVerificacion = null; // Limpiar código tras éxito
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
    } catch (e) { res.status(500).json({ error: "Error en verificación" }); }
});

// --- 🏪 RUTAS NEGOCIOS & STAFF ---

app.post('/api/admin/crear-negocio', async (req, res) => {
    try {
        const { nombre, ubicacion } = req.body;
        const adminEmail = req.body.adminEmail.trim().toLowerCase();

        const existe = await Usuario.findOne({ correo: adminEmail });
        if (existe) return res.status(400).json({ error: "El correo ya está registrado" });

        const nuevoNegocio = new Negocio({ nombre, ubicacion, adminEmail });
        await nuevoNegocio.save();

        const hashedPassword = await bcrypt.hash("Barber2026*", 10);
        const nuevoAdmin = new Usuario({
            correo: adminEmail,
            password: hashedPassword,
            rol: 'ADMIN',
            nombre: `Dueño ${nombre}`,
            negocioId: nuevoNegocio._id
        });
        await nuevoAdmin.save();

        res.json({ success: true, passwordTemporal: "Barber2026*" });
    } catch (e) { res.status(500).json({ error: e.message }); }
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
    } catch (e) { res.status(500).json({ error: "Error al registrar personal" }); }
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
    console.log(`🚀 Servidor corriendo profesionalmente en puerto ${PORT}`);
});