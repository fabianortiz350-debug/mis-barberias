const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
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
    hora: String,
    codigoReserva: String
});

// --- CONFIGURACIÓN DE BREVO (Sustituye a Gmail) ---
const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    auth: {
        user: 'fabianortiz350@gmail.com', // Tu correo de registro en Brevo
        pass: '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' // <--- AQUÍ PEGAS LA LLAVE LARGA (xkeysib...)
    }
});

app.post('/reservar', async (req, res) => {
    try {
        const { fecha, hora, barbero, clienteEmail, clienteNombre } = req.body;
        const existe = await Cita.findOne({ fecha, hora, barbero });
        if (existe) return res.status(400).json({ error: "Esta hora ya fue reservada." });

        const codigo = "R-" + Math.floor(1000 + Math.random() * 9000);
        const nuevaCita = new Cita({ ...req.body, codigoReserva: codigo });
        await nuevaCita.save();

        const mailOptions = {
            from: 'fabianortiz350@gmail.com',
            to: `fabianortiz350@gmail.com, ${clienteEmail}`,
            subject: `Reserva Master Barber VIP: ${codigo}`,
            text: `¡Hola ${clienteNombre}! Tu cita con ${barbero} está confirmada para el ${fecha} a las ${hora}.`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) console.log("❌ Error Brevo:", error.message);
            else console.log("📧 ¡CORREO ENVIADO CON BREVO!");
        });

        res.json({ success: true, codigo });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mantén el resto igual (disponibilidad, cancelar, etc.)
app.get('/disponibilidad', async (req, res) => {
    const { fecha, barbero } = req.query;
    const ocupadas = await Cita.find({ fecha, barbero });
    res.json({ ocupadas: ocupadas.map(c => c.hora) });
});

app.post('/cancelar', async (req, res) => {
    const { email } = req.body;
    const borrado = await Cita.findOneAndDelete({ clienteEmail: email });
    if (borrado) res.json({ success: true, message: "Reserva cancelada" });
    else res.status(404).json({ error: "No se encontró la reserva." });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor con Brevo Activo`));
