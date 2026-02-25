const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());

// ⚠️ PEGA TU URL DE MONGO AQUÍ ABAJO
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/?appName=BarberAPP"; 

mongoose.connect(mongoURI)
    .then(() => console.log("Conectado a MongoDB ✅"))
    .catch(err => console.log("Error de conexión:", err));

const Reserva = mongoose.model('Reserva', { barbero: String, fecha: String, hora: String });
const Bloqueo = mongoose.model('Bloqueo', { barbero: String, fecha: String, hora: String });

const HORAS_BASE = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];

app.get('/', (req, res) => res.send("Servidor Activo ✅"));

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
        // Si falla la base de datos, enviamos las horas vacías para que no se vea en blanco
        res.json({ ocupadas: [], bloqueadas: [] });
    }
});

app.post('/admin/bloquear', async (req, res) => {
    const { fecha, hora, barbero, estado } = req.body;
    if (estado === 'B') {
        await new Bloqueo({ fecha, hora, barbero }).save();
    } else {
        await Bloqueo.deleteOne({ fecha, hora, barbero });
    }
    res.json({ message: "OK" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Corriendo"));
