const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// CONFIGURACIÓN DE SEGURIDAD (CORS) - Muy importante para el botón
app.use(cors());
app.use(express.json());

// ⚠️ PEGA TU URL DE MONGO AQUÍ ABAJO
const mongoURI = "TU_URL_DE_MONGODB_REAL_AQUI"; 

mongoose.connect(mongoURI)
    .then(() => console.log("MongoDB Conectado ✅"))
    .catch(err => console.log("Error de conexión:", err));

// Esquemas de datos
const Reserva = mongoose.model('Reserva', { 
    clienteNombre: String, 
    clienteTelefono: String, 
    barbero: String, 
    fecha: String, 
    hora: String 
});

const Bloqueo = mongoose.model('Bloqueo', { 
    barbero: String, 
    fecha: String, 
    hora: String 
});

// Ruta para ver si el servidor está vivo
app.get('/', (req, res) => {
    res.send("<h1>Servidor Master Barber Activo ✅</h1>");
});

// Ruta para ver disponibilidad
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
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// Ruta para guardar la reserva (EL BOTÓN QUE FALLA)
app.post('/reservar', async (req, res) => {
    try {
        const nuevaReserva = new Reserva(req.body);
        await nuevaReserva.save();
        res.json({ message: "Reserva guardada con éxito" });
    } catch (e) {
        res.status(500).json({ error: "No se pudo guardar" });
    }
});

// Ruta para el Admin
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
app.listen(PORT, () => console.log("Servidor corriendo"));
