const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos
app.use(express.static(__dirname));

// CONEXIÓN A MONGODB
const mongoURI = 'mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/?appName=BarberAPP'; 

mongoose.connect(mongoURI)
  .then(() => console.log("✅ Conectado a la Base de Datos en la Nube"))
  .catch(err => console.error("❌ Error de conexión:", err));

// ESQUEMA DE LA CITA
const CitaSchema = new mongoose.Schema({
  barberiaNombre: String,
  clienteNombre: String,
  clienteEmail: String,
  fecha: String,
  hora: String,
  creadoEn: { type: Date, default: Date.now }
});
const Cita = mongoose.model('Cita', CitaSchema);

// MOSTRAR TU PÁGINA PRINCIPAL
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// CONFIGURACIÓN DE GMAIL (Nodemailer)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'fabianortiz350@gmail.com',
    pass: 'ndsirrxxjqgggssj' // Tu contraseña de aplicación de 16 letras
  }
});

// RUTA ÚNICA PARA RESERVAR
app.post('/reservar', async (req, res) => {
  try {
    const { clienteNombre, clienteEmail, barberiaNombre, fecha, hora } = req.body;

    // 1. Guardar en la Base de Datos
    const nuevaCita = new Cita({
      clienteNombre,
      clienteEmail,
      barberiaNombre,
      fecha,
      hora
    });
    await nuevaCita.save();
    console.log("📍 Cita guardada en Mongo");

    // 2. Enviar Correo al Cliente y a ti mismo (Copia)
    const mailOptions = {
      from: '"BarberApp Pro 💈" <fabianortiz350@gmail.com>',
      to: `${clienteEmail}, fabianortiz350@gmail.com`, // Se envía al cliente y te llega una copia a ti
      subject: `✅ Cita Confirmada - ${barberiaNombre}`,
      html: `
        <div style="font-family: sans-serif; border: 1px solid #d4af37; padding: 20px; border-radius: 10px;">
          <h1 style="color: #d4af37;">¡Hola ${clienteNombre}!</h1>
          <p>Tu reserva ha sido confirmada con éxito.</p>
          <hr>
          <p><b>Servicio:</b> ${barberiaNombre}</p>
          <p><b>Fecha:</b> ${fecha}</p>
          <p><b>Hora:</b> ${hora}</p>
          <hr>
          <p>Te esperamos en nuestra barbería. ¡Gracias por confiar en nosotros!</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log("📧 Correos enviados con éxito");

    res.status(200).send("Reserva completada con éxito");

  } catch (error) {
    console.error("❌ Error en el proceso:", error);
    res.status(500).send("Error interno del servidor");
  }
});

// PUERTO (Render usa process.env.PORT)
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));


