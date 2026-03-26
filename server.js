const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Brevo = require('@getbrevo/brevo');
const app = express();

app.use(cors());
app.use(express.json());

// --- 🔌 CONEXIÓN MONGO ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";
mongoose.connect(mongoURI).then(() => console.log("✅ DB Conectada")).catch(e => console.log(e));

// --- 🏗️ MODELOS ---
const Usuario = mongoose.model('Usuario', {
    correo: { type: String, unique: true },
    rol: { type: String, enum: ['SUPER', 'ADMIN', 'STAFF', 'CLIENTE'], default: 'CLIENTE' },
    nombre: String,
    negocioId: String, // ID del negocio al que pertenece
    codigoVerificacion: String,
    fechaExpiracion: Date
});

const Negocio = mongoose.model('Negocio', {
    nombre: String,
    idSlug: { type: String, unique: true },
    adminEmail: String,
    ubicacion: String,
    servicios: [{ nombre: String, precio: Number }]
});

const Cita = mongoose.model('Cita', {
    cliente: String, email: String, barbero: String, fecha: String, hora: String, estado: String
});

// --- ⚙️ CONFIG BREVO ---
let apiInstance = new Brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_KEY || 'TU_API_KEY_AQUI';

// --- 🔐 SISTEMA AUTH (CÓDIGO) ---
app.post('/api/auth/enviar-codigo', async (req, res) => {
    const { correo } = req.body;
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        await Usuario.findOneAndUpdate(
            { correo }, 
            { codigoVerificacion: codigo, fechaExpiracion: new Date(Date.now() + 10*60000) },
            { upsert: true }
        );
        let email = new Brevo.SendSmtpEmail();
        email.subject = `Tu código: ${codigo}`;
        email.htmlContent = `<h2>Acceso Agendate Live</h2><p>Código: <b>${codigo}</b></p>`;
        email.sender = { name: "Agendate Live", email: "fabianortiz350@gmail.com" };
        email.to = [{ email: correo }];
        await apiInstance.sendTransacEmail(email);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.post('/api/auth/verificar', async (req, res) => {
    const { correo, codigo } = req.body;
    const user = await Usuario.findOne({ correo, codigoVerificacion: codigo, fechaExpiracion: { $gt: new Date() } });
    if (user) {
        res.json({ success: true, rol: user.rol, nombre: user.nombre, correo: user.correo });
    } else {
        res.status(401).json({ success: false, mensaje: "Código inválido" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Puerto ${PORT}`));