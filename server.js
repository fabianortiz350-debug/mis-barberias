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

// --- TRANSPORTADOR SIN FILTROS ---
// Usamos directamente el host de Gmail con el puerto 465 (Seguridad Total)
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, 
    auth: {
        user: 'fabianortiz350@gmail.com',
        pass: 'veiuhqgfqtbbtzyt' // <--- ASEGÚRATE QUE SEA LA NUEVA SIN ESPACIOS
    },
    debug: true, // Esto nos dirá exactamente qué pasa en el log
    logger: true // Esto mostrará toda la conversación con Gmail
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

        const mailOptions = {
            from: 'fabianortiz350@gmail.com',
            to: `fabianortiz350@gmail.com, ${clienteEmail}`,
            subject: `Cita Confirmada: ${fecha}`,
            text: `Nueva reserva en Master Barber:\n\nCliente: ${clienteNombre}\nBarbero: ${barbero}\nHora: ${hora}\nFecha: ${fecha}\nCódigo: ${codigo}\n\nPara cancelar, usa tu correo en la web.`
        };

        // Enviamos y capturamos el log detallado
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log("❌ DETALLE DEL ERROR:", error);
            } else {
                console.log("📧 ¡LOGRADO! Respuesta de Gmail:", info.response);
            }
        });

        res.json({ success: true, codigo });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/cancelar', async (req, res) => {
    try {
        const { email } = req.body;
        const borrado = await Cita.findOneAndDelete({ clienteEmail: email });
        if (borrado) res.json({ success: true, message: "Reserva cancelada" });
        else res.status(404).json({ error: "No se encontró la reserva." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor VIP Online`));
