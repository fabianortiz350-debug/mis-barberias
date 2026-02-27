const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { google } = require('googleapis'); // 🚀 IMPORTANTE: Librería para Calendar
const app = express();

app.use(cors());
app.use(express.json());

// Servir archivos estáticos (index.html, css, etc.)
app.use(express.static(__dirname));

// --- CONEXIÓN A MONGODB ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";
mongoose.connect(mongoURI)
    .then(() => console.log("✅ Conectado a la Base de Datos en la Nube"))
    .catch(err => console.error("❌ Error de conexión:", err));

// Esquema para guardar las citas
const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteEmail: String,
    barberoEmail: String,
    fecha: String,
    hora: String,
    barberiaNombre: String
});

// --- CONFIGURACIÓN GOOGLE CALENDAR ---
// 🚀 Usamos la API KEY que creamos en Google Cloud y configuramos en Render
const calendar = google.calendar({
    version: 'v3',
    auth: process.env.GOOGLE_CALENDAR_API_KEY
});

// --- RUTA PARA MOSTRAR TU PÁGINA ---
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- ✅ RUTA NUEVA: CARGAR HORAS DISPONIBLES ---
app.get('/horas-disponibles', async (req, res) => {
    try {
        // Por ahora, simulamos horas disponibles.
        const horasSimuladas = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
        res.json(horasSimuladas);
    } catch (error) {
        console.error("Error al cargar horas:", error);
        res.status(500).json({ error: "Error cargando horas" });
    }
});

// --- RUTA PARA RESERVAR ---
app.post('/reservar', async (req, res) => {
    try {
        const { clienteEmail, barberoEmail, clienteNombre, fecha, hora, barberiaNombre } = req.body;
        
        // A. Guardar en la base de datos
        const nuevaCita = new Cita(req.body);
        await nuevaCita.save();
        console.log("Cita guardada en DB ✅");

        // B. CREAR EVENTO EN GOOGLE CALENDAR
        try {
            // Formatear fecha y hora para Google: YYYY-MM-DDTHH:mm:ss
            const startDateTime = new Date(`${fecha}T${hora}:00`);
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hora después

            await calendar.events.insert({
                calendarId: 'primary', // Tu calendario principal
                resource: {
                    summary: `💈 Cita: ${clienteNombre} - ${barberiaNombre}`,
                    location: 'Master Barber VIP',
                    description: `Cliente: ${clienteNombre}\nEmail: ${clienteEmail}`,
                    start: {
                        dateTime: startDateTime.toISOString(),
                        timeZone: 'America/Bogota', // 🔥 AJUSTA TU ZONA HORARIA AQUÍ
                    },
                    end: {
                        dateTime: endDateTime.toISOString(),
                        timeZone: 'America/Bogota',
                    },
                },
            });
            console.log("Evento creado en Google Calendar ✅");
        } catch (calError) {
            console.error("Error creando evento en Google Calendar:", calError);
        }

        res.status(200).send("Cita guardada y eventos creados");

    } catch (e) {
        console.error("Error al procesar reserva:", e);
        res.status(500).send("Error en el servidor");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));