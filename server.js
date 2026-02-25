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
  .then(() => console.log("✅ Conectado a la Base de Datos"))
  .catch(err => console.error("❌ Error de conexión:", err));

// ESQUEMA DE LA CITA
const CitaSchema = new mongoose.Schema({
  barberiaNombre: String, // Aquí se guarda el Servicio
  clienteNombre: String,
  clienteEmail: String,
  barbero: String,
  fecha: String,
  hora: String,
  creadoEn: { type: Date, default: Date.now }
});
const Cita = mongoose.model('Cita', CitaSchema);

// MOSTRAR PÁGINA PRINCIPAL
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// CONFIGURACIÓN DE GMAIL (Nodemailer)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Usamos TLS para puerto 587
  auth: {
    user: 'fabianortiz350@gmail.com',
    pass: 'ndsirrxxjqgggssj'
  },
  tls: {
    // Esto es clave para que Render no bloquee la salida
    rejectUnauthorized: false
  },
  connectionTimeout: 10000, // 10 segundos de espera
  greetingTimeout: 5000
});

// RUTA PARA RESERVAR
app.post('/reservar', async (req, res) => {
  try {
    const { clienteNombre, clienteEmail, barberiaNombre, barbero, fecha, hora } = req.body;

    // 1. Guardar en MongoDB
    const nuevaCita = new Cita({
      clienteNombre,
      clienteEmail,
      barberiaNombre,
      barbero,
      fecha,
      hora
    });
    await nuevaCita.save();
    console.log("📍 Cita guardada en base de datos");

    // 2. Configurar el Correo
    const mailOptions = {
      from: '"BarberApp Pro 💈" <fabianortiz350@gmail.com>',
      to: `${clienteEmail}, fabianortiz350@gmail.com`, 
      subject: `✅ Cita Confirmada con ${barbero}`,
      html: `
        <div style="font-family: sans-serif; border: 2px solid #d4af37; padding: 20px; border-radius: 10px; max-width: 500px;">
          <h2 style="color: #1a1a1a; text-align: center;">¡Reserva Confirmada!</h2>
          <p>Hola <b>${clienteNombre}</b>, tu cita en <b>BarberApp Pro</b> ha sido agendada con éxito.</p>
          <hr style="border: 0; border-top: 1px solid #eee;">
          <p><b>🤵 Barbero:</b> ${barbero}</p>
          <p><b>✂️ Servicio:</b> ${barberiaNombre}</p>
          <p><b>📅 Fecha:</b> ${fecha}</p>
          <p><b>⏰ Hora:</b> ${hora}</p>
          <hr style="border: 0; border-top: 1px solid #eee;">
          <p style="text-align: center; color: #777; font-size: 0.9rem;">Te esperamos para darte el mejor estilo.</p>
        </div>
      `
    };

    // 3. Enviar el Correo
    await transporter.sendMail(mailOptions);
    console.log("📧 Correo enviado correctamente");

    // 4. Responder a la página web (Importante para que no se quede "Procesando")
    res.status(200).json({ mensaje: "Cita confirmada con éxito" });

  } catch (error) {
    console.error("❌ Error en el servidor:", error);
    res.status(500).json({ error: "Error al procesar la reserva" });
  }
});

// PUERTO DE RENDER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));


