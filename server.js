const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- CONEXIÓN MONGODB ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";
mongoose.connect(mongoURI).then(() => console.log("✅ DB Conectada")).catch(err => console.log(err));

const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    clienteEmail: String,
    barbero: String,
    fecha: String,
    hora: String
});

// --- CONFIGURACIÓN DE CORREO ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'fabianortiz350@gmail.com', // Tu correo
        pass: 'TU_CONTRASEÑA_DE_APLICACION' // Debes generarla en Google -> Seguridad
    }
});

// --- RUTAS ---
app.get('/disponibilidad', async (req, res) => {
    const { fecha, barbero } = req.query;
    const ocupadas = await Cita.find({ fecha, barbero });
    res.json({ ocupadas: ocupadas.map(c => c.hora) });
});

app.post('/reservar', async (req, res) => {
    try {
        const nuevaCita = new Cita(req.body);
        await nuevaCita.save();

        // Enviar Correo
        const mailOptions = {
            from: 'Master Barber VIP',
            to: `${req.body.clienteEmail}, fabianortiz350@gmail.com`,
            subject: `✅ Cita Confirmada: ${req.body.fecha} a las ${req.body.hora}`,
            html: `<h2>¡Cita Agendada!</h2>
                   <p><b>Barbero:</b> ${req.body.barbero}</p>
                   <p><b>Cliente:</b> ${req.body.clienteNombre}</p>
                   <p>Nos vemos pronto.</p>`
        };
        transporter.sendMail(mailOptions);

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e }); }
});

app.get('/ver-agenda', async (req, res) => {
    const { barbero } = req.query;
    const filtro = barbero ? { barbero } : {};
    const citas = await Cita.find(filtro).sort({ fecha: 1, hora: 1 });
    res.json(citas);
});

app.listen(10000, () => console.log("🚀 Servidor VIP Iniciado"));
