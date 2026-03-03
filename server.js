const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- CONEXIÓN A MONGODB ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Conexión exitosa a MongoDB"))
    .catch(err => console.error("❌ Error de conexión a MongoDB:", err));

// Esquema de la Cita
const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    barbero: String,
    fecha: String,
    hora: String
});

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- ✅ RUTA: DISPONIBILIDAD (Basada en tu DB) ---
app.get('/disponibilidad', async (req, res) => {
    try {
        const { fecha, barbero } = req.query;
        // Buscamos las citas que ya existen para ese día y ese barbero
        const citasExistentes = await Cita.find({ fecha, barbero });
        const horasOcupadas = citasExistentes.map(c => c.hora);

        res.json({
            ocupadas: horasOcupadas,
            bloqueadas: [] // Aquí podrías añadir horas de almuerzo si quisieras
        });
    } catch (error) {
        console.error("Error al consultar disponibilidad:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// --- ✅ RUTA: RESERVAR ---
app.post('/reservar', async (req, res) => {
    try {
        const nuevaCita = new Cita(req.body);
        await nuevaCita.save();
        console.log("✅ Nueva cita guardada:", req.body);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error al guardar cita:", error);
        res.status(500).json({ error: "No se pudo guardar la reserva" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
