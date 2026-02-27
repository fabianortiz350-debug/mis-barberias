const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios'); 
const app = express();

app.use(cors());
app.use(express.json());

// --- 1. CONEXIÓN A MONGODB ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP"; 

mongoose.connect(mongoURI)
    .then(() => console.log("Base de datos conectada ✅"))
    .catch(err => console.error("Error de conexión MongoDB:", err));

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

// --- 2. RUTA PARA RESERVAR (Envío por API) ---
app.post('/reservar', async (req, res) => {
    try {
        const { clienteNombre, clienteTelefono, barbero, fecha, hora } = req.body;
        
        // Guardar en la base de datos
        const nuevaReserva = new Reserva(req.body);
        await nuevaReserva.save();
        console.log("Reserva guardada en DB ✅");

        // CONFIGURACIÓN DE BREVO API
        // ⚠️ PEGA TU CLAVE DE BREVO AQUÍ ABAJO:
        const BREVO_API_KEY = 'xsmtpsib-1b16312d919ac81a999fdf0ae8c0fe57b7ce49bf35a3a45c6efdbfdf7092532d-lNeqh14jDx4kPiI9'; 

        // Enviar correo usando AXIOS (Puerto 443 - No se bloquea)
        await axios.post('https://api.brevo.com/v3/smtp/email', {
            sender: { name: "Master Barber VIP", email: "fabianortiz350@gmail.com" },
            to: [{ email: correosBarberos[barbero] }],
            subject: `💈 Nueva Cita: ${clienteNombre}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px;">
                    <h2 style="color: #333;">¡Nueva reserva recibida!</h2>
                    <p><strong>Cliente:</strong> ${clienteNombre}</p>
                    <p><strong>Teléfono:</strong> ${clienteTelefono}</p>
                    <p><strong>Fecha:</strong> ${fecha}</p>
                    <p><strong>Hora:</strong> ${hora}</p>
                    <hr>
                    <p style="font-size: 12px; color: #666;">Gestionado por Master Barber App</p>
                </div>
            `
        }, {
            headers: { 
                'api-key': BREVO_API_KEY,
                'Content-Type': 'application/json' 
            }
        });

        console.log(`Correo enviado a ${barbero} vía API ✅`);
        res.json({ success: true });

    } catch (e) {
        console.error("Error en el proceso:");
        if (e.response) {
            console.error("Error de Brevo:", e.response.data);
        } else {
            console.error(e.message);
        }
        res.status(500).json({ error: "Error al procesar reserva" });
    }
});

// --- 3. OTRAS RUTAS ---
app.get('/', (req, res) => res.send("<h1>Servidor Master Barber Activo ✅</h1>"));

app.get('/disponibilidad', async (req, res) => {
    try {
        const { fecha, barbero } = req.query;
        const ocupadas = await Reserva.find({ fecha, barbero });
        const bloqueadas = await Bloqueo.find({ fecha, barbero });
        res.json({ 
            ocupadas: ocupadas.map(r => r.hora), 
            bloqueadas: bloqueadas.map(b => b.hora) 
        });
    } catch (e) {
        res.status(500).json({ ocupadas: [], bloqueadas: [] });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));







