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

// --- CONFIGURACIÓN DE CORREO (Asegúrate de las 16 letras) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'fabianortiz350@gmail.com',
        pass: 'gscslelifivakzdp' // <--- TU CÓDIGO DE 16 LETRAS SIN ESPACIOS
    }
});

app.get('/disponibilidad', async (req, res) => {
    try {
        const { fecha, barbero } = req.query;
        const ocupadas = await Cita.find({ fecha, barbero });
        res.json({ ocupadas: ocupadas.map(c => c.hora) });
    } catch (e) { res.status(500).send(e); }
});

app.post('/reservar', async (req, res) => {
    try {
        const { fecha, hora, barbero, clienteEmail, clienteNombre } = req.body;
        const existe = await Cita.findOne({ fecha, hora, barbero });
        if (existe) return res.status(400).json({ error: "Esta hora ya fue reservada." });

        const codigo = "R-" + Math.floor(1000 + Math.random() * 9000);
        const nuevaCita = new Cita({ ...req.body, codigoReserva: codigo });
        await nuevaCita.save();

        // Enviar Correo
        const mailOptions = {
            from: '"Master Barber VIP" <fabianortiz350@gmail.com>',
            to: `${clienteEmail}, fabianortiz350@gmail.com`,
            subject: `Reserva Confirmada [${codigo}]`,
            html: `
                <div style="font-family: Arial; border: 2px solid #d4af37; padding: 20px; text-align: center; background: #000; color: #fff;">
                    <h1 style="color: #d4af37;">MASTER BARBER</h1>
                    <p>¡Hola ${clienteNombre}!</p>
                    <p>Tu cita con <b>${barbero}</b> está lista.</p>
                    <p>FECHA: ${fecha} | HORA: ${hora}</p>
                    <p style="background:#d4af37; color:#000; padding:10px; font-weight:bold;">CÓDIGO: ${codigo}</p>
                </div>`
        };

        transporter.sendMail(mailOptions, (err) => {
            if(err) console.log("❌ Error de correo:", err.message);
            else console.log("📧 Correo enviado");
        });

        res.json({ success: true, codigo });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/cancelar', async (req, res) => {
    try {
        const { email } = req.body;
        const borrado = await Cita.findOneAndDelete({ clienteEmail: email });
        if (borrado) res.json({ success: true, message: "Reserva cancelada" });
        else res.status(404).json({ error: "No hay reserva con ese correo." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(10000, () => console.log("🚀 Servidor Online"));
