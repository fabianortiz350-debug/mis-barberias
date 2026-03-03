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
    codigoReserva: String
});

// --- CONFIGURACIÓN DE CORREO (Gmail Profesional) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'fabianortiz350@gmail.com',
        pass: 'gscslelifivakzdp' // <-- Las 16 letras que generaste en Google
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

// --- API: RESERVAR (Envía correo a Fabian y Cliente) ---
app.post('/reservar', async (req, res) => {
    try {
        const { fecha, hora, barbero, clienteEmail, clienteNombre } = req.body;

        const existe = await Cita.findOne({ fecha, hora, barbero });
        if (existe) return res.status(400).json({ error: "Esta hora ya fue reservada." });

        const codigo = "R-" + Math.floor(1000 + Math.random() * 9000);
        const nuevaCita = new Cita({ ...req.body, codigoReserva: codigo });
        await nuevaCita.save();

        // Configuración del Correo
        const mailOptions = {
            from: '"Master Barber VIP" <fabianortiz350@gmail.com>',
            to: `${clienteEmail}, fabianortiz350@gmail.com`, // Se envía a ambos
            subject: `Reserva Confirmada [${codigo}]`,
            html: `
                <div style="font-family: Arial, sans-serif; border: 2px solid #d4af37; padding: 20px; text-align: center; background-color: #000; color: #fff; border-radius: 15px;">
                    <h1 style="color: #d4af37;">MASTER BARBER VIP</h1>
                    <p>¡Hola <b>${clienteNombre.toUpperCase()}</b>!</p>
                    <p>Tu cita ha sido agendada correctamente.</p>
                    <div style="background: #1a1a1a; border: 1px solid #d4af37; padding: 15px; margin: 20px auto; width: 80%; border-radius: 10px;">
                        <p style="margin: 5px 0;"><b>Código:</b> <span style="color:#d4af37;">${codigo}</span></p>
                        <p style="margin: 5px 0;"><b>Barbero:</b> ${barbero}</p>
                        <p style="margin: 5px 0;"><b>Fecha:</b> ${fecha}</p>
                        <p style="margin: 5px 0;"><b>Hora:</b> ${hora}</p>
                    </div>
                    <p style="font-size: 12px; color: #888;">Para cancelar, usa tu correo en nuestra web.</p>
                </div>`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) console.log("❌ Error enviando correo:", error);
            else console.log("📧 Correo enviado con éxito");
        });

        res.json({ success: true, codigo });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- API: CANCELAR (Ahora por Correo) ---
app.post('/cancelar', async (req, res) => {
    try {
        const { email } = req.body;
        const borrado = await Cita.findOneAndDelete({ clienteEmail: email });
        
        if (borrado) {
            res.json({ success: true, message: "Reserva cancelada" });
        } else {
            res.status(404).json({ error: "No se encontró ninguna reserva activa con este correo." });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- API: VER AGENDA (Panel del Barbero) ---
app.get('/ver-agenda', async (req, res) => {
    const { barbero } = req.query;
    const filtro = barbero ? { barbero } : {};
    const citas = await Cita.find(filtro).sort({ fecha: 1, hora: 1 });
    res.json(citas);
});

app.listen(10000, () => console.log("🚀 Servidor VIP Online"));
