const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Brevo = require('@getbrevo/brevo'); 
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- 🔌 CONEXIÓN ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";
mongoose.connect(mongoURI).then(() => console.log("✅ MongoDB Conectado")).catch(err => console.error("❌ Error:", err));

// --- 🏗️ MODELOS ---
const Usuario = mongoose.model('Usuario', {
    correo: { type: String, unique: true },
    rol: { type: String, enum: ['ADMIN', 'STAFF', 'CLIENTE'], default: 'CLIENTE' },
    nombreEmpleado: String,
    codigoVerificacion: String,
    fechaExpiracion: Date
});

const Cita = mongoose.model('Cita', {
    clienteNombre: String, clienteTelefono: String, clienteEmail: String, 
    barbero: String, servicio: String, precio: Number, fecha: String, 
    hora: String, reservaId: String, estado: { type: String, default: 'confirmada' }
});

// --- ⚙️ CONFIGURACIÓN BREVO ---
let apiInstance = new Brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_KEY || 'TU_KEY_AQUI_SI_NO_USAS_VARIABLES';

// --- 🔐 RUTAS DE AUTENTICACIÓN (OTP) ---

// 1. ENVIAR CÓDIGO
app.post('/api/auth/enviar-codigo', async (req, res) => {
    const { correo } = req.body;
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 10 * 60000); // 10 min

    try {
        let user = await Usuario.findOne({ correo });
        if (!user) user = new Usuario({ correo, rol: 'CLIENTE' });
        
        user.codigoVerificacion = codigo;
        user.fechaExpiracion = expiracion;
        await user.save();

        let email = new Brevo.SendSmtpEmail();
        email.subject = `Tu código: ${codigo}`;
        email.htmlContent = `<h2>Agendate Live</h2><p>Tu código de acceso es: <b>${codigo}</b></p>`;
        email.sender = { name: "Agendate Live", email: "fabianortiz350@gmail.com" };
        email.to = [{ email: correo }];
        
        await apiInstance.sendTransacEmail(email);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Error enviando email" }); }
});

// 2. VERIFICAR CÓDIGO
app.post('/api/auth/verificar', async (req, res) => {
    const { correo, codigo } = req.body;
    const user = await Usuario.findOne({ correo, codigoVerificacion: codigo, fechaExpiracion: { $gt: new Date() } });

    if (user) {
        user.codigoVerificacion = null; // Usado
        await user.save();
        res.json({ success: true, rol: user.rol, nombre: user.nombreEmpleado || "Usuario", correo: user.correo });
    } else {
        res.status(401).json({ success: false, mensaje: "Código inválido o expirado" });
    }
});

// --- 📅 RUTAS DE CITAS ---
app.post('/reservar', async (req, res) => {
    const nuevaCita = new Cita(req.body);
    await nuevaCita.save();
    res.json({ success: true });
});

app.get('/disponibilidad', async (req, res) => {
    const { fecha, barbero } = req.query;
    const ocupadas = await Cita.find({ fecha, barbero, estado: 'confirmada' });
    res.json({ ocupadas: ocupadas.map(c => c.hora) });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Puerto ${PORT}`));