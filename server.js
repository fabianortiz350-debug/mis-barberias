<<<<<<< HEAD
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos (para que cargue tus fotos o estilos si tienes)
app.use(express.static(__dirname));

const mongoURI = 'mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/?appName=BarberAPP'; 

mongoose.connect(mongoURI)
  .then(() => console.log("✅ Conectado a la Base de Datos en la Nube"))
  .catch(err => console.error("❌ Error de conexión:", err));

// Esquema para guardar las citas
const CitaSchema = new mongoose.Schema({
  barberiaNombre: String,
  clienteNombre: String,
  clienteEmail: String,
  fecha: String,
  hora: String,
  creadoEn: { type: Date, default: Date.now }
});
const Cita = mongoose.model('Cita', CitaSchema);

// --- ESTO ES LO NUEVO: MOSTRAR TU PÁGINA ---
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// CONFIGURACIÓN DE TU GMAIL
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'fabianortiz350@gmail.com',
    pass: 'lcpfyayysewetkoy' 
  }
});

app.post('/reservar', async (req, res) => {
  try {
    const nuevaCita = new Cita(req.body);
    await nuevaCita.save();

    const { clienteEmail, barberoEmail, clienteNombre, fecha, hora, barberiaNombre } = req.body;
    await transporter.sendMail({
      from: '"BarberApp Pro" <fabianortiz350@gmail.com>',
      to: `${clienteEmail}, ${barberoEmail}`,
      subject: `💈 Cita Confirmada - ${barberiaNombre}`,
      html: `<h1>¡Hola ${clienteNombre}!</h1><p>Tu cita en <b>${barberiaNombre}</b> está lista para el ${fecha} a las ${hora}.</p>`
    });

    res.status(200).send("Cita guardada y correos enviados");
  } catch (error) {
    console.log(error);
    res.status(500).send("Error en el servidor");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));
=======
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
>>>>>>> 786bac372d486c4ab1d09a2712e705b1dacbf245
