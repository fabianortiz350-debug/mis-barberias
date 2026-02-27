const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { google } = require('googleapis'); // 🚀 IMPORTANTE: Nueva librería
const app = express();

app.use(cors());
app.use(express.json());

// --- CONEXIÓN A MONGODB (Ya lo tenías) ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";
mongoose.connect(mongoURI);

// Esquema (Ya lo tenías)
const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteEmail: String,
    barberoEmail: String,
    fecha: String,
    hora: String,
    barberiaNombre: String
});

// --- 2. CONFIGURACIÓN GOOGLE CALENDAR ---
// 🚀 Usamos la API KEY que creamos en Google Cloud y pusimos en Render
const calendar = google.calendar({
    version: 'v3',
    auth: process.env.GOOGLE_CALENDAR_API_KEY
});

// --- 3. RUTA PARA RESERVAR ---
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

        // C. Enviar correo de confirmación (Ya lo tenías)
        // ... (Aquí iría tu configuración de nodemailer actual) ...

        res.status(200).send("Cita guardada y eventos creados");

    } catch (e) {
        console.error("Error al procesar reserva:", e);
        res.status(500).send("Error en el servidor");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`));
