const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const Brevo = require('@getbrevo/brevo');
const path = require('path'); // ✅ Nueva librería para manejar rutas de archivos
const app = express();

app.use(cors());
app.use(express.json());

// ✅ NUEVO: Esto permite que Render muestre tus archivos HTML, CSS e Imágenes
app.use(express.static(__dirname)); 

// ✅ NUEVO: Ruta principal para que al entrar al link se vea tu index.html
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
    categoria: String,
    img: String,
    ubicacion: String,
    intervalo: { type: Number, default: 60 },
    adminEmail: String,
    creadoEn: { type: Date, default: Date.now }
});

const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    clienteEmail: String,
    barbero: String,
    fecha: String,
    hora: String,
    estado: { type: String, enum: ['pendiente', 'confirmada', 'realizada', 'cancelada'], default: 'confirmada' },
    reservaId: String,
    negocioId: String
});

// --- ⚙️ CONFIG BREVO ---
const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_KEY || 'TU_API_KEY_AQUI');

// --- 🔐 SISTEMA AUTH 2 PASOS ---

app.post('/api/auth/login', async (req, res) => {
    const { correo, password } = req.body;
    try {
        const user = await Usuario.findOne({ correo });
        if (!user) return res.status(404).json({ mensaje: "Usuario no encontrado" });

        const passValida = await bcrypt.compare(password, user.password);
        if (!passValida) return res.status(401).json({ mensaje: "Contraseña incorrecta" });

        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        user.codigoVerificacion = codigo;
        user.fechaExpiracion = new Date(Date.now() + 10 * 60000); 
        await user.save();

        let sendEmail = new Brevo.SendSmtpEmail();
        sendEmail.subject = `Tu código de seguridad: ${codigo}`;
        sendEmail.htmlContent = `
            <div style="font-family: sans-serif; text-align: center; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #1a1a1a;">Verificación de Acceso</h2>
                <p>Tu código de seguridad para Agendate Live es:</p>
                <b style="font-size: 32px; color: #d4af37; letter-spacing: 5px;">${codigo}</b>
                <p style="color: #666; font-size: 12px; margin-top: 20px;">Este código expira en 10 minutos.</p>
            </div>`;
        sendEmail.sender = { name: "Agendate Live", email: "fabianortiz350@gmail.com" };
        sendEmail.to = [{ email: correo }];
        
        await apiInstance.sendTransacEmail(sendEmail);
        res.json({ success: true, mensaje: "Código enviado" });

    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Error al procesar el login" }); 
    }
});

app.post('/api/auth/verificar', async (req, res) => {
    const { correo, codigo } = req.body;
    const user = await Usuario.findOne({ 
        correo, 
        codigoVerificacion: codigo, 
        fechaExpiracion: { $gt: new Date() } 
    });

    if (user) {
        user.codigoVerificacion = null;
        await user.save();
        res.json({ 
            success: true, 
            rol: user.rol, 
            nombre: user.nombre, 
            correo: user.correo,
            negocioId: user.negocioId 
        });
    } else {
        res.status(401).json({ success: false, mensaje: "Código inválido" });
    }
});

// --- 🏪 RUTAS SUPER ADMIN ---
app.post('/api/admin/crear-negocio', async (req, res) => {
    try {
        const nuevoNegocio = new Negocio(req.body);
        await nuevoNegocio.save();
        res.json({ success: true, negocio: nuevoNegocio });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/negocios', async (req, res) => {
    try {
        const negocios = await Negocio.find();
        res.json(negocios);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 📅 RUTAS DE CITAS ---
app.get('/api/citas/ver', async (req, res) => {
    const { email, rol } = req.query;
    let query = {};
    if (rol === 'STAFF') query = { barbero: email }; 
    if (rol === 'ADMIN') query = { adminEmail: email }; 
    
    try {
        const citas = await Cita.find(query).sort({ fecha: 1, hora: 1 });
        res.json(citas);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/citas/completar', async (req, res) => {
    const { id } = req.body;
    try {
        await Cita.findByIdAndUpdate(id, { estado: 'realizada' });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/citas/cancelar', async (req, res) => {
    const { id } = req.body;
    try {
        await Cita.findByIdAndUpdate(id, { estado: 'cancelada' });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/registrar-interno', async (req, res) => {
    const { correo, password, rol, nombre } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const nuevoUser = new Usuario({ correo, password: hashedPassword, rol, nombre });
        await nuevoUser.save();
        res.json({ success: true, mensaje: "Usuario creado" });
    } catch (e) { res.status(500).json({ error: "El usuario ya existe" }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor activo en puerto ${PORT}`));