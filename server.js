const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();

app.use(cors());
app.use(express.json());

// --- CONEXIÓN A MONGODB ---
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

// --- CONFIGURACIÓN DE CORREOS ---
// 1. Pones el correo real de cada barbero aquí
const correosBarberos = {
    "Fabian Ortiz": "FA.ORTIZM94@GMAIL.COM", // ✅ YA ESTÁ CORRECTO
    "Andrés Silva": "fa.ortizm@outlook.com" // ⚠️ CAMBIA ESTO POR EL REAL
};

// 2. Configuración del remitente (el que envía el correo)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        // ⚠️ CAMBIA ESTO POR EL CORREO QUE ENVÍA LOS AVISOS (Tuyo)
        user: 'fabianortiz350@gmail.com', 
        // ⚠️ CAMBIA ESTO POR LA CONTRASENA DE 16 LETRAS DE GOOGLE
        pass: 'lesv kkes jheb dewf' 
    }
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

        // Enviar correo al barbero correspondiente
        const mailOptions = {
            // ⚠️ CAMBIA ESTO TAMBIÉN POR EL CORREO QUE ENVÍA
            from: 'Master Barber VIP <fabianortiz350@gmail.com>', 
            to: correosBarberos[req.body.barbero],
            subject: `💈 Nueva Cita: ${req.body.clienteNombre}`,
            text: `Nueva reserva recibida:\n\n` +
                  `Cliente: ${req.body.clienteNombre}\n` +
                  `Teléfono: ${req.body.clienteTelefono}\n` +
                  `Fecha: ${req.body.fecha}\n` +
                  `Hora: ${req.body.hora}\n\n` +
                  `¡Prepárate para el servicio!`
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) console.log("Error enviando correo:", err);
            else console.log("Correo enviado ✅");
        });

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
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));



