const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- CONEXIÓN A MONGODB ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Conectado a MongoDB"))
    .catch(err => console.error("❌ Error DB:", err));

// Esquema de la Cita
const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    barbero: String,
    fecha: String,
    hora: String
});

// Ruta para la página de clientes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para tu Agenda Privada
app.get('/agenda', (req, res) => {
    res.sendFile(path.join(__dirname, 'agenda.html'));
});

// --- API: CONSULTAR DISPONIBILIDAD ---
app.get('/disponibilidad', async (req, res) => {
    try {
        const { fecha, barbero } = req.query;
        const ocupadas = await Cita.find({ fecha, barbero });
        const horasOcupadas = ocupadas.map(c => c.hora);
        res.json({ ocupadas: horasOcupadas });
    } catch (error) {
        res.status(500).json({ error: "Error al consultar" });
    }
});

// --- API: GUARDAR RESERVA ---
app.post('/reservar', async (req, res) => {
    try {
        const nuevaCita = new Cita(req.body);
        await nuevaCita.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error al guardar" });
    }
});

// --- API: VER TODA LA AGENDA (Para el barbero) ---
app.get('/ver-agenda', async (req, res) => {
    try {
        // Ordena por fecha y luego por hora
        const citas = await Cita.find().sort({ fecha: 1, hora: 1 });
        res.json(citas);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener agenda" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));
