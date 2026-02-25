const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// CONEXIÓN A MONGODB
const mongoURI = 'mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/?appName=BarberAPP'; 

mongoose.connect(mongoURI)
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch(err => console.error("❌ Error DB:", err));

// ESQUEMA
const CitaSchema = new mongoose.Schema({
  barberiaNombre: String,
  clienteNombre: String,
  clienteEmail: String,
  barbero: String,
  fecha: String,
  hora: String,
  creadoEn: { type: Date, default: Date.now }
});
const Cita = mongoose.model('Cita', CitaSchema);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// CONFIGURACIÓN GMAIL
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'fabianortiz350@gmail.com',
    pass: 'ndsirrxxjqgggssj'
  }
});

// RUTA RESERVAR (Corregida para no bloquearse)
app.post('/reservar', async (req, res) => {
  try {
    const { clienteNombre, clienteEmail, barberiaNombre, barbero, fecha, hora } = req.body;

    // 1. Guardar primero en la Base de Datos
    const nuevaCita = new Cita({
      clienteNombre,
      clienteEmail,
      barberiaNombre,
      barbero,
      fecha,
      hora
    });
    await nuevaCita.save();
    console.log("📍 Cita guardada en DB con éxito");

    // 2. ENVIAR RESPUESTA INMEDIATA AL CLIENTE (Para quitar el "Procesando")
    res.status(200).json({ mensaje: "OK" });

    // 3. Intentar enviar el correo en segundo plano
    const mailOptions = {
      from: '"BarberApp Pro 💈" <fabianortiz350@gmail.com>',
      to: `${clienteEmail}, fabianortiz350@gmail.com`, 
      subject: `✅ Cita Confirmada con ${barbero}`,
      html: `
        <div style="font-family: sans-serif; border: 2px solid #d4af37; padding: 20px; border-radius: 10px;">
          <h2 style="color: #1a1a1a;">¡Reserva Confirmada!</h2>
          <p>Hola <b>${clienteNombre}</b>, tu cita ha sido agendada.</p>
          <hr>
          <p><b>Barbero:</b> ${barbero}</p>
          <p><b>Servicio:</b> ${barberiaNombre}</p>
          <p><b>Fecha:</b> ${fecha} | <b>Hora:</b> ${hora}</p>
        </div>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("❌ Error enviando correo (pero la cita se guardó):", error.message);
      } else {
        console.log("📧 Correo enviado: " + info.response);
      }
    });

  } catch (error) {
    console.error("❌ Error general:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error en el servidor" });
    }
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
