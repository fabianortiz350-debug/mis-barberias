const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// --- TU CONEXIÓN REAL A MONGODB ---
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

// Rutas
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
    } catch (e) { res.status(500).json({ocupadas:[], bloqueadas:[]}); }
});

app.post('/reservar', async (req, res) => {
    try {
        const nuevaReserva = new Reserva(req.body);
        await nuevaReserva.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/bloquear', async (req, res) => {
    try {
        const { fecha, hora, barbero, estado } = req.body;
        if (estado === 'B') {
            await new Bloqueo({ fecha, hora, barbero }).save();
        } else {
            await Bloqueo.deleteOne({ fecha, hora, barbero });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
