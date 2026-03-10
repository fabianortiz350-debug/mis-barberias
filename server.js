const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis'); 
const Brevo = require('@getbrevo/brevo'); // NUEVO: Importar Brevo
const app = express();

app.use(cors());
app.use(express.json());

// Servir archivos estáticos
app.use(express.static(__dirname));

// --- CONEXIÓN A MONGODB ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";
mongoose.connect(mongoURI)
    .then(() => console.log("✅ Conectado a la Base de Datos en la Nube"))
    .catch(err => console.error("❌ Error de conexión:", err));

// Esquema para guardar las citas
const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    barbero: String,
    fecha: String,
    hora: String
});

// NUEVO: Esquema para Usuarios y Códigos de verificación
const Usuario = mongoose.model('Usuario', {
    correo: String,
    codigoVerificacion: String,
    verificado: { type: Boolean, default: false }
});

// --- CONFIGURACIÓN GOOGLE CALENDAR ---
const calendar = google.calendar({
    version: 'v3',
    auth: process.env.GOOGLE_CALENDAR_API_KEY
});

// --- NUEVA: CONFIGURACIÓN DE API BREVO ---
let apiInstance = new Brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_KEY; // Usa tu variable de Render

// --- RUTA PARA MOSTRAR TU PÁGINA ---
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- ✅ RUTA: ENVIAR CÓDIGO POR CORREO (BREVO API) ---
app.post('/api/auth/enviar-codigo', async (req, res) => {
    const { correo } = req.body;
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();

    try {
        // Guardar código en la base de datos
        await Usuario.findOneAndUpdate(
            { correo }, 
            { codigoVerificacion: codigo }, 
            { upsert: true }
        );

        // Configurar el envío vía API de Brevo
        let sendSmtpEmail = new Brevo.SendSmtpEmail();
        sendSmtpEmail.subject = "Tu código de seguridad - Agendate Live";
        sendSmtpEmail.htmlContent = `<h3>Bienvenido</h3><p>Tu código de verificación es: <b>${codigo}</b></p>`;
        sendSmtpEmail.sender = { "name": "Agendate Live", "email": "fabianortiz350@gmail.com" };
        sendSmtpEmail.to = [{ "email": correo }];

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        
        console.log(`✅ Correo enviado con éxito a: ${correo}`);
        res.json({ mensaje: "Código enviado" });

    } catch (error) {
        console.error("❌ Error API Brevo:", error.response ? error.response.body : error);
        res.status(500).json({ mensaje: "Error al enviar el correo" });
    }
});

// --- ✅ RUTA: CARGAR HORAS DISPONIBLES ---
app.get('/disponibilidad', async (req, res) => {
    try {
        const { fecha, barbero } = req.query;
        res.json({
            ocupadas: [],
            bloqueadas: []
        });
    } catch (error) {
        console.error("Error al cargar horas:", error);
        res.status(500).json({ error: "Error cargando horas" });
    }
});

// --- RUTA PARA RESERVAR ---
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
            console.log("Evento creado en Google Calendar ✅");
        } catch (calError) {
            console.error("❌ ERROR CRÍTICO EN CALENDAR:", JSON.stringify(calError, null, 2));
        }

        res.status(200).json({ message: "Cita guardada" });

    } catch (e) {
        console.error("Error al procesar reserva:", e);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

const PORT = process.env.PORT || 10000; // Ajustado a 10000 para Render
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));