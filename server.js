const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis'); 
const Brevo = require('@getbrevo/brevo'); 
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const mongoURI = "tu_uri_de_mongodb_aqui"; // Usa la que ya tienes
mongoose.connect(mongoURI)
    .then(() => console.log("✅ Conectado a la Base de Datos"))
    .catch(err => console.error("❌ Error:", err));

// --- MODELOS ---

// Modelo de Cita mejorado para historial
const Cita = mongoose.model('Cita', {
    clienteEmail: String,      // Clave para el historial
    clienteNombre: String,
    clienteTelefono: String,
    negocioNombre: String,     // Para saber dónde fue la cita
    barbero: String,
    fecha: String,
    hora: String,
    status: { type: String, default: "Asignada" } // Asignada, Asistida, Cancelada
});

const Usuario = mongoose.model('Usuario', {
    correo: String,
    codigoVerificacion: String,
    fechaExpiracion: Date,
    verificado: { type: Boolean, default: false }
});

// --- CONFIGURACIÓN APIs ---
let apiInstance = new Brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_KEY; 

const calendar = google.calendar({
    version: 'v3',
    auth: process.env.GOOGLE_CALENDAR_API_KEY
});

// --- RUTAS DE AUTENTICACIÓN ---

app.post('/api/auth/enviar-codigo', async (req, res) => {
    const { correo } = req.body;
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 5 * 60 * 1000);

    try {
        await Usuario.findOneAndUpdate(
            { correo }, 
            { codigoVerificacion: codigo, fechaExpiracion: expiracion }, 
            { upsert: true }
        );

        let sendSmtpEmail = new Brevo.SendSmtpEmail();
        sendSmtpEmail.subject = "Tu código - Agendate Live";
        sendSmtpEmail.htmlContent = `<h3>Código: ${codigo}</h3><p>Vence en 5 min.</p>`;
        sendSmtpEmail.sender = { "name": "Agendate Live", "email": "tu-email@gmail.com" };
        sendSmtpEmail.to = [{ "email": correo }];

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.json({ mensaje: "Código enviado" });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al enviar correo" });
    }
});

app.post('/api/auth/verificar', async (req, res) => {
    const { correo, codigo } = req.body;
    try {
        const usuario = await Usuario.findOne({ correo });
        if (!usuario || new Date() > usuario.fechaExpiracion) {
            return res.status(400).json({ success: false, mensaje: "Código expirado" });
        }
        if (usuario.codigoVerificacion === codigo) {
            await Usuario.findOneAndUpdate({ correo }, { codigoVerificacion: null, verificado: true }); 
            res.json({ success: true });
        } else {
            res.status(400).json({ success: false, mensaje: "Código incorrecto" });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// --- RUTAS DE CITAS ---

// Obtener historial de un usuario específico
app.get('/api/citas/historial/:email', async (req, res) => {
    try {
        const citas = await Cita.find({ clienteEmail: req.params.email }).sort({ fecha: -1 });
        res.json(citas);
    } catch (error) {
        res.status(500).json({ error: "Error de servidor" });
    }
});

app.post('/reservar', async (req, res) => {
    try {
        // Ahora guardamos también el email y el nombre del negocio
        const nuevaCita = new Cita(req.body);
        await nuevaCita.save();

        // Lógica de Google Calendar (opcional)
        // ... (mantén tu lógica de calendar.events.insert aquí)

        res.status(200).json({ message: "Cita guardada con éxito" });
    } catch (e) {
        res.status(500).json({ error: "Error al reservar" });
    }
});

const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));