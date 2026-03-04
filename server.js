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
    hora: String,
    codigoReserva: String
});

// --- CONFIGURACIÓN DE CORREO REFORZADA ---
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true para 465, false para otros puertos
    auth: {
        user: 'fabianortiz350@gmail.com',
        pass: 'gscslelifivakzdp' // <--- ASEGÚRATE QUE NO TENGA ESPACIOS
    },
    tls: {
        rejectUnauthorized: false // Esto ayuda a evitar bloqueos en servidores externos
    }
});

// --- API: DISPONIBILIDAD ---
app.get('/disponibilidad', async (req, res) => {
    try {
        const { fecha, barbero } = req.query;
        const ocupadas = await Cita.find({ fecha, barbero });
        res.json({ ocupadas: ocupadas.map(c => c.hora) });
    } catch (e) { res.status(500).send(e); }
});

// --- API: RESERVAR ---
app.post('/reservar', async (req, res) => {
    try {
        const { fecha, hora, barbero, clienteEmail, clienteNombre } = req.body;
        const existe = await Cita.findOne({ fecha, hora, barbero });
        if (existe) return res.status(400).json({ error: "Esta hora ya fue reservada." });

        const codigo = "R-" + Math.floor(1000 + Math.random() * 9000);
        const nuevaCita = new Cita({ ...req.body, codigoReserva: codigo });
        await nuevaCita.save();

        // Estructura del Correo
        const mailOptions = {
            from: '"Master Barber VIP" <fabianortiz350@gmail.com>',
            to: `${clienteEmail}, fabianortiz350@gmail.com`,
            subject: `Confirmación de Reserva [${codigo}]`,
            html: `
                <div style="font-family: Arial, sans-serif; border: 2px solid #d4af37; padding: 20px; background-color: #000; color: #fff; border-radius: 15px; text-align: center;">
                    <h1 style="color: #d4af37;">MASTER BARBER</h1>
                    <p>¡Hola <b>${clienteNombre}</b>!</p>
                    <p>Tu cita con <b>${barbero}</b> ha sido confirmada.</p>
                    <div style="border: 1px solid #d4af37; padding: 10px; margin: 20px 0;">
                        <p>FECHA: ${fecha} | HORA: ${hora}</p>
                        <p style="font-size: 20px; font-weight: bold; color: #d4af37;">CÓDIGO: ${codigo}</p>
                    </div>
                    <p style="font-size: 12px; color: #888;">Si necesitas cancelar, usa tu correo en nuestra web.</p>
                </div>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log("❌ Error de correo detallado:", error.message);
            } else {
                console.log("📧 Correo enviado con éxito:", info.response);
            }
        });

        res.json({ success: true, codigo });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- API: CANCELAR ---
app.post('/cancelar', async (req, res) => {
    try {
        const { email } = req.body;
        const borrado = await Cita.findOneAndDelete({ clienteEmail: email });
        if (borrado) res.json({ success: true, message: "Reserva cancelada" });
        else res.status(404).json({ error: "No se encontró la reserva." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor Online en puerto ${PORT}`));
