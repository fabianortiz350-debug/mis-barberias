const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const Brevo = require('@getbrevo/brevo');
const path = require('path'); 
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 🔌 CONEXIÓN MONGO ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";
mongoose.connect(mongoURI)
    .then(() => console.log("✅ DB Conectada"))
    .catch(e => console.log("❌ Error DB:", e));

// --- 🏗️ MODELOS ---
const Usuario = mongoose.model('Usuario', {
    correo: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    rol: { type: String, enum: ['SUPER', 'ADMIN', 'STAFF', 'CLIENTE'], default: 'CLIENTE' },
    nombre: String,
    negocioId: String, 
    codigoVerificacion: String,
    fechaExpiracion: Date
});

const Negocio = mongoose.model('Negocio', {
    nombre: String,
    ubicacion: String,
    adminEmail: String,
    creadoEn: { type: Date, default: Date.now }
});

const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    barbero: String,
    fecha: String,
    hora: String,
    estado: { type: String, enum: ['pendiente', 'confirmada', 'realizada', 'cancelada'], default: 'confirmada' },
    negocioId: String
});

// --- ⚙️ CONFIG BREVO ---
const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_KEY || 'TU_API_KEY_AQUI');

// --- 🔐 SISTEMA AUTH ---

app.post('/api/auth/login', async (req, res) => {
    const correo = req.body.correo.trim().toLowerCase();
    const { password } = req.body;
    try {
        const user = await Usuario.findOne({ correo });
        if (!user) return res.status(404).json({ mensaje: "Correo no registrado" });

        const passValida = await bcrypt.compare(password, user.password);
        if (!passValida) return res.status(401).json({ mensaje: "Contraseña incorrecta" });

        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        user.codigoVerificacion = codigo;
        user.fechaExpiracion = new Date(Date.now() + 10 * 60000); 
        await user.save();

        let sendEmail = new Brevo.SendSmtpEmail();
        sendEmail.subject = `Tu código: ${codigo}`;
        sendEmail.htmlContent = `<h2>Código de acceso: ${codigo}</h2>`;
        sendEmail.sender = { name: "Agendate Live", email: "fabianortiz350@gmail.com" };
        sendEmail.to = [{ email: correo }];
        
        await apiInstance.sendTransacEmail(sendEmail);
        res.json({ success: true, mensaje: "Código enviado" });
    } catch (e) { res.status(500).json({ error: "Error en login" }); }
});

app.post('/api/auth/verificar', async (req, res) => {
    const correo = req.body.correo.trim().toLowerCase();
    const { codigo } = req.body;
    try {
        const user = await Usuario.findOne({ correo, codigoVerificacion: codigo, fechaExpiracion: { $gt: new Date() } });
        if (user) {
            user.codigoVerificacion = null;
            await user.save();
            res.json({ success: true, rol: user.rol, correo: user.correo, negocioId: user.negocioId });
        } else {
            res.status(401).json({ success: false, mensaje: "Código inválido" });
        }
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

// --- 🏪 RUTAS NEGOCIOS ---

app.post('/api/admin/crear-negocio', async (req, res) => {
    const { nombre, ubicacion } = req.body;
    const adminEmail = req.body.adminEmail.trim().toLowerCase();
    try {
        const existe = await Usuario.findOne({ correo: adminEmail });
        if (existe) return res.status(400).json({ error: "El correo ya existe" });

        const nuevoNegocio = new Negocio({ nombre, ubicacion, adminEmail });
        await nuevoNegocio.save();

        const hashedPassword = await bcrypt.hash("Barber2026*", 10);
        const nuevoAdmin = new Usuario({
            correo: adminEmail,
            password: hashedPassword,
            rol: 'ADMIN',
            nombre: `Dueño ${nombre}`,
            negocioId: nuevoNegocio._id.toString()
        });
        await nuevoAdmin.save();

        res.json({ success: true, passwordTemporal: "Barber2026*" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// NUEVA RUTA: Obtener citas por Negocio (Para el panel del dueño)
app.get('/api/citas/negocio/:id', async (req, res) => {
    try {
        const citas = await Cita.find({ negocioId: req.params.id });
        res.json(citas);
    } catch (e) { res.status(500).json({ error: "Error al obtener citas" }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Puerto ${PORT}`));