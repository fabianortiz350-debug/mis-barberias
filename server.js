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
mongoose.connect(mongoURI).then(() => console.log("✅ DB Conectada")).catch(err => console.log(err));

// ESQUEMA MEJORADO
const CitaSchema = new mongoose.Schema({
  clienteNombre: String,
  clienteEmail: String,
  barberiaNombre: String, // Servicio
  barbero: String,        // Barbero seleccionado
  fecha: String,
  hora: String,
  creadoEn: { type: Date, default: Date.now }
});
const Cita = mongoose.model('Cita', CitaSchema);

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

// CONFIGURACIÓN DE GMAIL
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'fabianortiz350@gmail.com',
    pass: 'ndsirrxxjqgggssj' // Asegúrate que sean las 16 letras sin espacios
  }
});

app.post('/reservar', async (req, res) => {
  try {
    const { clienteNombre, clienteEmail, barberiaNombre, barbero, fecha, hora } = req.body;

    const nuevaCita = new Cita({ clienteNombre, clienteEmail, barberiaNombre, barbero, fecha, hora });
    await nuevaCita.save();

    const mailOptions = {
      // Usamos comillas simples afuera y dobles adentro para el nombre
      from: '"BarberApp Pro 💈" <fabianortiz350@gmail.com>',
      to: `${clienteEmail}, fabianortiz350@gmail.com`, 
      subject: `✅ Cita Confirmada con ${barbero}`,
      html: `
        <div style="font-family: sans-serif; border: 2px solid #d4af37; padding: 20px; border-radius: 10px;">
          <h2 style="color: #1a1a1a;">¡Reserva Confirmada!</h2>
          <p>Hola <b>${clienteNombre}</b>, tu cita ha sido agendada con éxito.</p>
          <hr>
          <p><b>Barbero:</b> ${barbero}</p>
          <p><b>Servicio:</b> ${barberiaNombre}</p>
          <p><b>Fecha:</b> ${fecha}</p>
          <p><b>Hora:</b> ${hora}</p>
          <hr>
          <p>Te esperamos para darte el mejor estilo.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).send("OK");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Puerto ${PORT}`));




