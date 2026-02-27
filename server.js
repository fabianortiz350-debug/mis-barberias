const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { google } = require('googleapis'); 
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

// --- CONFIGURACIÓN GOOGLE CALENDAR ---
// ⚠️ Nota: Para escribir en el calendario necesitas credenciales JSON (OAuth2), 
// no solo una API Key simple. Asegúrate de tener la variable de entorno correcta.
const calendar = google.calendar({
    version: 'v3',
    auth: process.env.GOOGLE_CALENDAR_API_KEY
});

// --- RUTA PARA MOSTRAR TU PÁGINA ---
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- ✅ RUTA: CARGAR HORAS DISPONIBLES ---
app.get('/disponibilidad', async (req, res) => {
    try {
        const { fecha, barbero } = req.query;
        console.log(`Consultando disponibilidad para ${barbero} el ${fecha}`);

        // Por ahora simulamos sin citas ocupadas para que funcione.
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
        
        // A. Guardar en la base de datos
        const nuevaCita = new Cita(req.body);
        await nuevaCita.save();
        console.log("Cita guardada en DB ✅");

        // B. CREAR EVENTO EN GOOGLE CALENDAR
        try {
            const startDateTime = new Date(`${fecha}T${hora}:00`);
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hora después

            await calendar.events.insert({
                calendarId: 'primary',
                resource: {
                    summary: `💈 Cita: ${clienteNombre} - ${barbero}`,
                    location: 'Master Barber VIP',
                    description: `Teléfono: ${clienteTelefono}`,
                    start: {
                        dateTime: startDateTime.toISOString(),
                        timeZone: 'America/Bogota',
                    },
                    end: {
                        dateTime: endDateTime.toISOString(),
                        timeZone: 'America/Bogota',
                    },
                },
            });
            console.log("Evento creado en Google Calendar ✅");
        } catch (calError) {
            // 🔥 LOG DETALLADO PARA DEPURAR
            console.error("❌ ERROR CRÍTICO EN CALENDAR:", JSON.stringify(calError, null, 2));
        }

        res.status(200).json({ message: "Cita guardada" });

    } catch (e) {
        console.error("Error al procesar reserva:", e);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));