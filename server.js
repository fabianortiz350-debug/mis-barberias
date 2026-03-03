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

// Esquema de Cita
const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    clienteEmail: String,
    barbero: String,
    fecha: String,
    hora: String,
    codigoCancelacion: String
});

// --- CONFIGURACIÓN DE CORREO ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'fabianortiz350@gmail.com',
        pass: 'gscs leli fiva kzdp' // <--- PEGA AQUÍ TUS 16 LETRAS DE GOOGLE
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

// --- API: RESERVAR (Bloquea duplicados y genera código) ---
app.post('/reservar', async (req, res) => {
    try {
        const { fecha, hora, barbero, clienteEmail, clienteNombre } = req.body;

        // 1. Verificar si la hora ya se ocupó
        const existe = await Cita.findOne({ fecha, hora, barbero });
        if (existe) return res.status(400).json({ error: "Esta hora ya fue reservada por alguien más." });

        // 2. Generar código R-XXXX
        const codigo = "R-" + Math.floor(1000 + Math.random() * 9000);
        
        const nuevaCita = new Cita({ ...req.body, codigoCancelacion: codigo });
        await nuevaCita.save();

        // 3. Enviar Correo a Cliente y Barbero
        const mailOptions = {
            from: '"Master Barber VIP" <fabianortiz350@gmail.com>',
            to: `${clienteEmail}, fabianortiz350@gmail.com`,
            subject: `✅ Cita Confirmada [${codigo}]`,
            html: `
                <div style="font-family: sans-serif; border: 2px solid #d4af37; padding: 20px; border-radius: 10px; background: #fafafa;">
                    <h2 style="color: #d4af37; text-align: center;">¡Reserva Exitosa!</h2>
                    <p>Hola <b>${clienteNombre}</b>, tu cita ha sido agendada con éxito.</p>
                    <p><b>Barbero:</b> ${barbero}</p>
                    <p><b>Fecha:</b> ${fecha} | <b>Hora:</b> ${hora}</p>
                    <div style="background: #000; color: #d4af37; padding: 10px; text-align: center; font-weight: bold; border-radius: 5px;">
                        CÓDIGO DE CANCELACIÓN: ${codigo}
                    </div>
                    <p style="font-size: 11px; margin-top: 15px;">Si necesitas cancelar, usa este código en nuestra página web.</p>
                </div>`
        };

        transporter.sendMail(mailOptions);
        res.json({ success: true, codigo });

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- API: CANCELAR ---
app.post('/cancelar', async (req, res) => {
    try {
        const { codigo } = req.body;
        const borrado = await Cita.findOneAndDelete({ codigoCancelacion: codigo });
        if (borrado) {
            res.json({ success: true, message: "Cita cancelada correctamente." });
        } else {
            res.status(404).json({ error: "Código no encontrado." });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- API: VER AGENDA ---
app.get('/ver-agenda', async (req, res) => {
    const { barbero } = req.query;
    const filtro = barbero ? { barbero } : {};
    const citas = await Cita.find(filtro).sort({ fecha: 1, hora: 1 });
    res.json(citas);
});

app.listen(10000, () => console.log("🚀 Servidor VIP Online"));
