const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// CONFIGURACIÓN DE PERMISOS (CORS) - Esto arregla tu error
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Reemplaza con tu conexión de MongoDB Atlas
const mongoURI = "TU_URL_DE_MONGODB_AQUI"; 

mongoose.connect(mongoURI)
    .then(() => console.log("Conectado a MongoDB ✅"))
    .catch(err => console.log("Error de conexión:", err));

// Modelos de datos
const Reserva = mongoose.model('Reserva', {
    clienteNombre: String, clienteTelefono: String, barbero: String, fecha: String, hora: String
});

const Bloqueo = mongoose.model('Bloqueo', {
    barbero: String, fecha: String, hora: String
});

// Ruta de inicio
app.get('/', (req, res) => {
    res.send("<h1>Servidor de Barbería Activo ✅</h1>");
});

// Ruta para ver disponibilidad
app.get('/disponibilidad', async (req, res) => {
    const { fecha, barbero } = req.query;
    const ocupadas = await Reserva.find({ fecha, barbero });
    const bloqueadas = await Bloqueo.find({ fecha, barbero });
    res.json({
        ocupadas: ocupadas.map(r => r.hora),
        bloqueadas: bloqueadas.map(b => b.hora)
    });
});

// Ruta para reservar (Cliente)
app.post('/reservar', async (req, res) => {
    const nuevaReserva = new Reserva(req.body);
    await nuevaReserva.save();
    res.json({ message: "Reserva guardada" });
});

// RUTA PARA BLOQUEAR (Dueño) - IMPORTANTE
app.post('/admin/bloquear', async (req, res) => {
    const { fecha, hora, barbero, estado } = req.body;
    if (estado === 'B') {
        await new Bloqueo({ fecha, hora, barbero }).save();
    } else {
        await Bloqueo.deleteOne({ fecha, hora, barbero });
    }
    res.json({ message: "Estado actualizado" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor corriendo"));
