const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// --- CONEXIÓN A MONGODB ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP"; 

mongoose.connect(mongoURI)
    .then(() => console.log("Base de datos conectada ✅"))
    .catch(err => console.error("Error de conexión:", err));

// Esquemas
const Reserva = mongoose.model('Reserva', { 
    clienteNombre: String, clienteTelefono: String, barbero: String, fecha: String, hora: String 
});

const Bloqueo = mongoose.model('Bloqueo', { 
    barbero: String, fecha: String, hora: String 
});

const correosBarberos = {
    "Fabian Ortiz": "FA.ORTIZM94@GMAIL.COM",
    "Andrés Silva": "oa.orregocetina@GMAIL.COM"
};

// --- RUTA PARA RESERVAR (Envío por API) ---
app.post('/reservar', async (req, res) => {
    try {
        const nuevaReserva = new Reserva(req.body);
        await nuevaReserva.save();
        console.log("Reserva guardada en DB ✅");

        // ⚠️ PEGA AQUÍ TU CLAVE API DE BREVO:
        const BREVO_API_KEY = 'xsmtpsib-1b16312d919ac81a999fdf0ae8c0fe57b7ce49bf35a3a45c6efdbfdf7092532d-lNeqh14jDx4kPiI9'; 

        await axios.post('https://api.brevo.com/v3/smtp/email', {
            sender: { name: "Master Barber VIP", email: "fabianortiz350@gmail.com" },
            to: [{ email: correosBarberos[req.body.barbero] }],
            subject: `💈 Nueva Cita: ${req.body.clienteNombre}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px;">
                    <h2 style="color: #333;">¡Nueva reserva recibida!</h2>
                    <p><strong>Cliente:</strong> ${req.body.clienteNombre}</p>
                    <p><strong>Teléfono:</strong> ${req.body.clienteTelefono}</p>
                    <p><strong>Fecha:</strong> ${req.body.fecha}</p>
                    <p><strong>Hora:</strong> ${req.body.hora}</p>
                </div>
            `
        }, {
            headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' }
        });

        console.log(`Correo enviado a ${req.body.barbero} vía API ✅`);
        res.json({ success: true });

    } catch (e) {
        console.error("Error API:", e.response ? e.response.data : e.message);
        res.status(500).json({ error: "Error al procesar reserva" });
    }
});

// --- RUTA PARA DISPONIBILIDAD (¡Aquí están las horas!) ---
app.get('/disponibilidad', async (req, res) => {
    try {
        const { fecha, barbero } = req.query;
        const ocupadas = await Reserva.find({ fecha, barbero });
        const bloqueadas = await Bloqueo.find({ fecha, barbero });
        
        // Esta es la lista de horas totales, ajusta si es necesario
        const horasTotales = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"];
        
        const ocupadasFormateadas = ocupadas.map(r => r.hora);
        const bloqueadasFormateadas = bloqueadas.map(b => b.hora);
        
        const disponibles = horasTotales.filter(hora => 
            !ocupadasFormateadas.includes(hora) && !bloqueadasFormateadas.includes(hora)
        );

        res.json({ disponibles });
    } catch (e) {
        res.status(500).json({ disponibles: [] });
    }
});

app.get('/', (req, res) => res.send("<h1>Servidor Activo ✅</h1>"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
