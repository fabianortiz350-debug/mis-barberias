const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { google } = require('googleapis'); 
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
    clienteTelefono: String, // 🔥 Ajustado a lo que envías en HTML
    barbero: String,         // 🔥 Ajustado a lo que envías en HTML
    fecha: String,
    hora: String
});

const calendar = google.calendar({
    version: 'v3',
    auth: process.env.GOOGLE_CALENDAR_API_KEY
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- ✅ RUTA CORREGIDA: CARGAR HORAS DISPONIBLES ---
app.get('/disponibilidad', async (req, res) => {
    try {
        const { fecha, barbero } = req.query;
        console.log(`Consultando disponibilidad para ${barbero} el ${fecha}`);

        // Por ahora simulamos que no hay citas ocupadas para que funcione.
        // Después conectaremos con Google Calendar realmente.
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

        // B. CREAR EVENTO EN GOOGLE CALENDAR (Lógica omitida por brevedad, usa la anterior)
        
        res.status(200).json({ message: "Cita guardada" });

    } catch (e) {
        console.error("Error al procesar reserva:", e);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));