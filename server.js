const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt'); // Para encriptar contraseñas
const Brevo = require('@getbrevo/brevo');
const app = express();

app.use(cors());
app.use(express.json());

// --- 🔌 CONEXIÓN MONGO ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";
mongoose.connect(mongoURI).then(() => console.log("✅ DB Conectada")).catch(e => console.log(e));

// --- 🏗️ MODELOS ---
const Usuario = mongoose.model('Usuario', {
    correo: { type: String, unique: true, required: true },
    password: { type: String, required: true }, // Nueva: Contraseña encriptada
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
    intervalo: { type: Number, default: 60 }, // Tiempo entre citas
    adminEmail: String,
    creadoEn: { type: Date, default: Date.now }
});

const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    clienteEmail: String,
    barbero: String, // Nombre o ID del empleado
    fecha: String,
    hora: String,
    estado: { type: String, enum: ['pendiente', 'confirmada', 'realizada', 'cancelada'], default: 'confirmada' },
    reservaId: String,
    negocioId: String
});

// --- ⚙️ CONFIG BREVO ---
let apiInstance = new Brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_KEY || 'TU_API_KEY_AQUI';

// --- 🔐 SISTEMA AUTH 2 PASOS (PASSWORD + CÓDIGO) ---

// PASO 1: Login con Password
app.post('/api/auth/login', async (req, res) => {
    const { correo, password } = req.body;
    
    try {
        const user = await Usuario.findOne({ correo });
        if (!user) return res.status(404).json({ mensaje: "Usuario no encontrado" });

        // Verificar contraseña
        const passValida = await bcrypt.compare(password, user.password);
        if (!passValida) return res.status(401).json({ mensaje: "Contraseña incorrecta" });

        // Si es válida, generar código de 6 dígitos
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        user.codigoVerificacion = codigo;
        user.fechaExpiracion = new Date(Date.now() + 10 * 60000); // 10 min
        await user.save();

        // Enviar Email con Brevo
        let sendEmail = new Brevo.SendSmtpEmail();
        sendEmail.subject = `Tu código de seguridad: ${codigo}`;
        sendEmail.htmlContent = `
            <div style="font-family: sans-serif; text-align: center;">
                <h2>Verificación de Acceso</h2>
                <p>Tu código es: <b style="font-size: 24px; color: #d4af37;">${codigo}</b></p>
                <p>Este código expira en 10 minutos.</p>
            </div>`;
        sendEmail.sender = { name: "Agendate Live", email: "fabianortiz350@gmail.com" };
        sendEmail.to = [{ email: correo }];
        
        await apiInstance.sendTransacEmail(sendEmail);
        res.json({ success: true, mensaje: "Código enviado al correo" });

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PASO 2: Verificar Código
app.post('/api/auth/verificar', async (req, res) => {
    const { correo, codigo } = req.body;
    const user = await Usuario.findOne({ 
        correo, 
        codigoVerificacion: codigo, 
        fechaExpiracion: { $gt: new Date() } 
    });

    if (user) {
        // Limpiar código tras éxito
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
        res.status(401).json({ success: false, mensaje: "Código inválido o expirado" });
    }
});

// --- 🏪 RUTAS SUPER ADMIN (CREAR NEGOCIOS) ---
app.post('/api/admin/crear-negocio', async (req, res) => {
    try {
        const nuevoNegocio = new Negocio(req.body);
        await nuevoNegocio.save();
        res.json({ success: true, negocio: nuevoNegocio });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/negocios', async (req, res) => {
    const negocios = await Negocio.find();
    res.json(negocios);
});

// --- 📅 RUTAS DE CITAS (GESTIÓN) ---

// Obtener citas (Filtra por email de empleado o negocio)
app.get('/api/citas/ver', async (req, res) => {
    const { email, rol } = req.query;
    let query = {};
    if (rol === 'STAFF') query = { barbero: email }; // Empleado solo ve lo suyo
    if (rol === 'ADMIN') query = { adminEmail: email }; // Dueño ve todo (ajustar según lógica)
    
    const citas = await Cita.find(query).sort({ fecha: 1, hora: 1 });
    res.json(citas);
});

// Marcar como realizada (Para empleados)
app.post('/api/citas/completar', async (req, res) => {
    const { id } = req.body;
    await Cita.findByIdAndUpdate(id, { estado: 'realizada' });
    res.json({ success: true });
});

// Cancelar Cita
app.post('/api/citas/cancelar', async (req, res) => {
    const { id } = req.body;
    await Cita.findByIdAndUpdate(id, { estado: 'cancelada' });
    res.json({ success: true });
});

// Registro inicial de usuarios (Solo para crear tu SUPER ADMIN la primera vez)
app.post('/api/auth/registrar-interno', async (req, res) => {
    const { correo, password, rol, nombre } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUser = new Usuario({ correo, password: hashedPassword, rol, nombre });
    await nuevoUser.save();
    res.json({ success: true, mensaje: "Usuario administrativo creado" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));