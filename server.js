const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Esta es nuestra "Base de Datos" temporal (en un entorno real usarías MongoDB o SQL)
let db = {
    reservas: [],
    bloqueos: [] // Aquí guardaremos las horas que tú bloquees manualmente
};

// 1. Ruta para que el cliente reserve
app.post('/reservar', (req, res) => {
    const nuevaReserva = req.body;
    db.reservas.push(nuevaReserva);
    console.log("Nueva Reserva:", nuevaReserva);
    res.status(200).send({ message: "Reserva guardada" });
});

// 2. Ruta para que tú (Admin) bloquees/desbloquees horas
app.post('/admin/bloquear', (req, res) => {
    const { fecha, hora, barbero, estado } = req.body; 
    // estado: 'B' para bloquear, 'L' para liberar
    if (estado === 'B') {
        db.bloqueos.push({ fecha, hora, barbero });
    } else {
        db.bloqueos = db.bloqueos.filter(b => !(b.fecha === fecha && b.hora === hora && b.barbero === barbero));
    }
    res.status(200).send({ message: "Disponibilidad actualizada" });
});

// 3. Ruta para que la web consulte qué horas están ocupadas o bloqueadas
app.get('/disponibilidad', (req, res) => {
    const { fecha, barbero } = req.query;
    const ocupadas = db.reservas
        .filter(r => r.fecha === fecha && r.barbero === barbero)
        .map(r => r.hora);
    
    const bloqueadas = db.bloqueos
        .filter(b => b.fecha === fecha && b.barbero === barbero)
        .map(b => b.hora);

    res.json({ ocupadas, bloqueadas });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
