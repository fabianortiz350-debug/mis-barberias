const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// REEMPLAZA ESTA LÍNEA con el código que copiaste en el Paso 1
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/?appName=BarberAPP";

mongoose.connect(mongoURI)
    .then(() => console.log("¡Conectado a BarberAPP en MongoDB! ✅"))
    .catch(err => console.log("Error de conexión:", err));

// Esquemas para guardar en la base de datos
const Reserva = mongoose.model('Reserva', {
    clienteNombre: String, clienteTelefono: String, barbero: String, 
    fecha: String, hora: String, servicio: String
});

const Bloqueo = mongoose.model('Bloqueo', {
    barbero: String, fecha: String, hora: String
});

// SOLUCIÓN AL ERROR "Cannot GET /": Esta línea dice qué mostrar al entrar al link
app.get('/', (req, res) => {
    res.send("<h1>Servidor de Barbería Activo</h1><p>La base de datos está conectada correctamente.</p>");
});

// Ruta para que el cliente agende
app.post('/reservar', async (req, res) => {
    try {
        const nuevaReserva = new Reserva(req.body);
        await nuevaReserva.save();
        res.status(200).json({ message: "Reserva guardada" });
    } catch (error) { res.status(500).send(error); }
});

// Ruta para ver qué horas NO mostrar (Ocupadas + Bloqueadas)
app.get('/disponibilidad', async (req, res) => {
    const { fecha, barbero } = req.query;
    const ocupadas = await Reserva.find({ fecha, barbero });
    const bloqueadas = await Bloqueo.find({ fecha, barbero });
    
    res.json({
        ocupadas: ocupadas.map(r => r.hora),
        bloqueadas: bloqueadas.map(b => b.hora)
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`));
