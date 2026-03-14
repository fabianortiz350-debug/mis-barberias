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

const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";
mongoose.connect(mongoURI)
    .then(() => console.log("✅ Conectado a la Base de Datos en la Nube"))
    .catch(err => console.error("❌ Error de conexión:", err));

const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    barbero: String,
    fecha: String,
    hora: String
});

// MODELO USUARIO ACTUALIZADO: Añadimos nombre y password
const Usuario = mongoose.model('Usuario', {
    correo: String,
    nombre: String,          // NUEVO
    password: String,        // NUEVO
    codigoVerificacion: String,
    fechaExpiracion: Date, 
    verificado: { type: Boolean, default: false }
});

const calendar = google.calendar({
    version: 'v3',
    auth: process.env.GOOGLE_CALENDAR_API_KEY
});

let apiInstance = new Brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_KEY; 

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- ✅ RUTA: REGISTRAR NUEVO USUARIO (NUEVA) ---
app.post('/api/auth/registrar', async (req, res) => {
    try {
        const { nombre, correo, password } = req.body;
        const existe = await Usuario.findOne({ correo });
        if (existe) {
            return res.status(400).json({ success: false, mensaje: "El correo ya está registrado" });
        }
        const nuevoUsuario = new Usuario({ nombre, correo, password });
        await nuevoUsuario.save();
        res.json({ success: true, mensaje: "Usuario creado con éxito" });
    } catch (error) {
        res.status(500).json({ success: false, mensaje: "Error al registrar" });
    }
});

// --- ✅ RUTA: LOGIN CON CONTRASEÑA (NUEVA) ---
app.post('/api/auth/login-pass', async (req, res) => {
    try {
        const { correo, password } = req.body;
        const usuario = await Usuario.findOne({ correo, password });
        if (usuario) {
            res.json({ success: true, nombre: usuario.nombre });
        } else {
            res.status(401).json({ success: false, mensaje: "Correo o contraseña incorrectos" });
        }
    } catch (error) {
        res.status(500).json({ success: false, mensaje: "Error en el servidor" });
    }
});

// --- ✅ RUTA: ENVIAR CÓDIGO POR CORREO ---
app.post('/api/auth/enviar-codigo', async (req, res) => {
    const { correo } = req.body;
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 5 * 60 * 1000); 

    try {
        await Usuario.findOneAndUpdate(
            { correo }, 
            { 
                codigoVerificacion: codigo,
                fechaExpiracion: expiracion 
            }, 
            { upsert: true }
        );

        let sendSmtpEmail = new Brevo.SendSmtpEmail();
        sendSmtpEmail.subject = "Tu código de seguridad - Agendate Live";
        sendSmtpEmail.htmlContent = `<h3>Bienvenido</h3><p>Tu código de verificación es: <b>${codigo}</b></p><p>Este código expirará en 5 minutos.</p>`;
        sendSmtpEmail.sender = { "name": "Agendate Live", "email": "fabianortiz350@gmail.com" };
        sendSmtpEmail.to = [{ "email": correo }];

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.json({ mensaje: "Código enviado" });

    } catch (error) {
        res.status(500).json({ mensaje: "Error al enviar el correo" });
    }
});

// --- ✅ RUTA: VERIFICAR CÓDIGO ---
app.post('/api/auth/verificar', async (req, res) => {
    const { correo, codigo } = req.body;
    try {
        const usuario = await Usuario.findOne({ correo });
        if (!usuario || !usuario.codigoVerificacion) {
            return res.status(400).json({ success: false, mensaje: "No hay un código activo." });
        }
        if (new Date() > usuario.fechaExpiracion) {
            await Usuario.findOneAndUpdate({ correo }, { codigoVerificacion: null });
            return res.status(400).json({ success: false, mensaje: "El código ha expirado." });
        }
        if (usuario.codigoVerificacion === codigo) {
            await Usuario.findOneAndUpdate({ correo }, { codigoVerificacion: null }); 
            res.json({ success: true, mensaje: "Acceso concedido" });
        } else {
            res.status(400).json({ success: false, mensaje: "Código incorrecto." });
        }
    } catch (error) {
        res.status(500).json({ success: false, mensaje: "Error en el servidor" });
    }
});

app.get('/disponibilidad', async (req, res) => {
    try {
        const { fecha, barbero } = req.query;
        res.json({ ocupadas: [], bloqueadas: [] });
    } catch (error) {
        res.status(500).json({ error: "Error cargando horas" });
    }
});

app.post('/reservar', async (req, res) => {
    try {
        const { clienteNombre, clienteTelefono, barbero, fecha, hora } = req.body;
        const nuevaCita = new Cita(req.body);
        await nuevaCita.save();

        try {
            const startDateTime = new Date(`${fecha}T${hora}:00`);
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
            await calendar.events.insert({
                calendarId: 'primary',
                resource: {
                    summary: `💈 Cita: ${clienteNombre} - ${barbero}`,
                    location: 'Master Barber VIP',
                    description: `Teléfono: ${clienteTelefono}`,
                    start: { dateTime: startDateTime.toISOString(), timeZone: 'America/Bogota' },
                    end: { dateTime: endDateTime.toISOString(), timeZone: 'America/Bogota' },
                },
            });
        } catch (calError) {
            console.error("❌ ERROR CALENDAR:", calError);
        }
        res.status(200).json({ message: "Cita guardada" });
    } catch (e) {
        res.status(500).json({ error: "Error en el servidor" });
    }
});

const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));