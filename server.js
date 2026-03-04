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

// --- CONFIGURACIÓN DE CORREO (MODO SEGURO 465) ---
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // TRUE para puerto 465
    auth: {
        user: 'fabianortiz350@gmail.com',
        pass: 'wnqezueeqqhryjcj' // <--- ASEGÚRATE QUE NO TENGA ESPACIOS
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
                    <h1 style="color: #d4af37; letter-spacing: 5px;">MASTER BARBER</h1>
                    <p>¡Hola <b>${clienteNombre.toUpperCase()}</b>!</p>
                    <p>Tu cita ha sido confirmada con éxito.</p>
                    <div style="border: 1px solid #d4af37; padding: 15px; margin: 20px auto; width: 80%;">
                        <p><b>BARBERO:</b> ${barbero}</p>
                        <p><b>FECHA:</b> ${fecha} | <b>HORA:</b> ${hora}</p>
                        <p style="font-size: 22px; font-weight: bold; color: #d4af37; margin-top: 10px;">CÓDIGO: ${codigo}</p>
                    </div>
                    <p style="font-size: 11px; color: #888;">Si necesitas cancelar, usa tu correo en nuestra web oficial.</p>
                </div>`
        };

        // Enviando el correo de forma asíncrona pero rastreable
        transporter.sendMail(mailOptions)
            .then(info => console.log("📧 Correo enviado:", info.response))
            .catch(err => console.log("❌ Error persistente de correo:", err.message));

        res.json({ success: true, codigo });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- API: CANCELAR ---
app.post('/cancelar', async (req, res) => {
    try {
        const { email } = req.body;
        const borrado = await Cita.findOneAndDelete({ clienteEmail: email });
        if (borrado) res.json({ success: true, message: "Reserva cancelada" });
        else res.status(404).json({ error: "Correo no encontrado." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor Online en puerto ${PORT}`));
