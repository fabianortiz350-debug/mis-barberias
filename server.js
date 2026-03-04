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

// --- CONFIGURACIÓN CLÁSICA (La que funcionó antes) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'fabianortiz350@gmail.com',
        pass: 'wnqezueeqqhryjcj' // <--- PEGA AQUÍ LA NUEVA QUE CREASTE
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

        const mailOptions = {
            from: 'Master Barber VIP <fabianortiz350@gmail.com>',
            to: `${clienteEmail}, fabianortiz350@gmail.com`,
            subject: `Reserva Confirmada [${codigo}]`,
            html: `
                <div style="font-family: sans-serif; border: 2px solid #d4af37; padding: 20px; text-align: center; background: #000; color: #fff; border-radius: 10px;">
                    <h1 style="color: #d4af37;">MASTER BARBER VIP</h1>
                    <p>¡Hola <b>${clienteNombre}</b>!</p>
                    <p>Tu cita con <b>${barbero}</b> ha sido confirmada.</p>
                    <div style="background: #1a1a1a; padding: 15px; border: 1px solid #d4af37; margin: 15px 0;">
                        <p>FECHA: ${fecha} | HORA: ${hora}</p>
                        <p style="font-size: 20px; font-weight: bold; color: #d4af37;">CÓDIGO: ${codigo}</p>
                    </div>
                    <p style="font-size: 11px; color: #888;">Para cancelar, ingresa tu correo en nuestra web.</p>
                </div>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.log("❌ Error de correo:", error.message);
            else console.log("📧 Correo enviado con éxito!");
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
        else res.status(404).json({ error: "Correo no encontrado." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor Online`));
