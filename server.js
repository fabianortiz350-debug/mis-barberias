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

// Esquema con Código de Cancelación
const CitaSchema = new mongoose.Schema({
    clienteNombre: String,
    clienteTelefono: String,
    clienteEmail: String,
    barbero: String,
    fecha: String,
    hora: String,
    codigoCancelacion: String
});
const Cita = mongoose.model('Cita', CitaSchema);

// --- CONFIGURACIÓN DE CORREO ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'fabianortiz350@gmail.com',
        pass: 'TU_CODIGO_DE_16_LETRAS_AQUI' // <-- Asegúrate de que sea el código de 16 letras
    }
});

// --- API: DISPONIBILIDAD ---
app.get('/disponibilidad', async (req, res) => {
    const { fecha, barbero } = req.query;
    const ocupadas = await Cita.find({ fecha, barbero });
    res.json({ ocupadas: ocupadas.map(c => c.hora) });
});

// --- API: RESERVAR (Con bloqueo de duplicados) ---
app.post('/reservar', async (req, res) => {
    try {
        const { fecha, hora, barbero, clienteEmail, clienteNombre } = req.body;

        // 1. Verificar si la hora ya se ocupó mientras el cliente decidía
        const existe = await Cita.findOne({ fecha, hora, barbero });
        if (existe) {
            return res.status(400).json({ error: "Lo siento, esta hora acaba de ser reservada." });
        }

        // 2. Generar código de cancelación (ej: R-1234)
        const codigo = "R-" + Math.floor(1000 + Math.random() * 9000);
        
        const nuevaCita = new Cita({ ...req.body, codigoCancelacion: codigo });
        await nuevaCita.save();

        // 3. Enviar Correo a ambos
        const infoCita = `Fecha: ${fecha} | Hora: ${hora} | Barbero: ${barbero}`;
        const mailOptions = {
            from: '"Master Barber VIP" <fabianortiz350@gmail.com>',
            to: `${clienteEmail}, fabianortiz350@gmail.com`,
            subject: `✅ Cita Confirmada - ${codigo}`,
            html: `
                <div style="font-family: sans-serif; border: 2px solid #d4af37; padding: 20px;">
                    <h2 style="color: #d4af37;">¡Reserva Confirmada!</h2>
                    <p><b>Código de Cancelación:</b> ${codigo}</p>
                    <hr>
                    <p><b>Cliente:</b> ${clienteNombre}</p>
                    <p><b>Detalles:</b> ${infoCita}</p>
                    <p style="font-size: 12px; color: #666;">Si necesitas cancelar, usa el código ${codigo} en nuestra web.</p>
                </div>`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) console.log("❌ Error enviando correo:", error);
            else console.log("📧 Correo enviado a cliente y barbero");
        });

        res.json({ success: true, codigo });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- API: CANCELAR CITA ---
app.post('/cancelar', async (req, res) => {
    try {
        const { codigo } = req.body;
        const borrado = await Cita.findOneAndDelete({ codigoCancelacion: codigo });
        
        if (borrado) {
            res.json({ success: true, message: "Cita cancelada. La hora está disponible de nuevo." });
        } else {
            res.status(404).json({ error: "Código no encontrado." });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/ver-agenda', async (req, res) => {
    const { barbero } = req.query;
    const filtro = barbero ? { barbero } : {};
    const citas = await Cita.find(filtro).sort({ fecha: 1, hora: 1 });
    res.json(citas);
});

app.listen(10000, () => console.log("🚀 Servidor VIP Online"));
