const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// CONEXIÓN A MONGODB (Tu base de datos que ya funciona)
const mongoURI = 'mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/?appName=BarberAPP'; 

mongoose.connect(mongoURI)
  .then(() => console.log("✅ Base de Datos Conectada"))
  .catch(err => console.error("❌ Error DB:", err));

// ESQUEMA DE LA CITA
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

// CONFIGURACIÓN GMAIL - PUERTO 465 (MÁS SEGURO)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // true para puerto 465
  auth: {
    user: 'fabianortiz350@gmail.com',
    pass: 'ndsirrxxjqgggssj' // Tu contraseña de aplicación
  },
  tls: {
    rejectUnauthorized: false // Permite que Render conecte sin problemas
  }
});

// RUTA PARA RESERVAR
app.post('/reservar', async (req, res) => {
  try {
    const { clienteNombre, clienteEmail, barberiaNombre, barbero, fecha, hora } = req.body;

    // 1. Guardar en Base de Datos (Esto ya te funciona perfecto)
    const nuevaCita = new Cita({
      clienteNombre,
      clienteEmail,
      barberiaNombre,
      barbero,
      fecha,
      hora
    });
    await nuevaCita.save();
    console.log("📍 Cita guardada en DB");

    // 2. Responder de inmediato a la web (Para que no se quede "Procesando")
    res.status(200).json({ mensaje: "Reserva exitosa" });

    // 3. Intentar enviar el correo en segundo plano
    const mailOptions = {
      from: '"BarberApp Pro 💈" <fabianortiz350@gmail.com>',
      to: `${clienteEmail}, fabianortiz350@gmail.com`, 
      subject: `✅ Confirmación: Cita con ${barbero}`,
      html: `
        <div style="font-family: sans-serif; border: 2px solid #d4af37; padding: 20px; border-radius: 10px; max-width: 500px;">
          <h2 style="color: #1a1a1a; text-align: center;">¡Cita Agendada!</h2>
          <p>Hola <b>${clienteNombre}</b>, tu cita ha sido confirmada.</p>
          <hr style="border: 0; border-top: 1px solid #eee;">
          <p><b>🤵 Barbero:</b> ${barbero}</p>
          <p><b>✂️ Servicio:</b> ${barberiaNombre}</p>
          <p><b>📅 Fecha:</b> ${fecha}</p>
          <p><b>⏰ Hora:</b> ${hora}</p>
          <hr style="border: 0; border-top: 1px solid #eee;">
          <p style="text-align: center; color: #888;">¡Te esperamos!</p>
        </div>`
    };

    // Usamos un callback para que el error no tumbe el servidor
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("❌ Error de envío de correo:", error.message);
      } else {
        console.log("📧 Correo enviado con éxito: " + info.response);
      }
    });

  } catch (error) {
    console.error("❌ Error en el proceso:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error interno" });
    }
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor activo en puerto ${PORT}`));
