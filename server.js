const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// CONEXIÓN A MONGODB
const mongoURI = 'mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/?appName=BarberAPP'; 

mongoose.connect(mongoURI)
  .then(() => console.log("✅ Base de Datos Conectada"))
  .catch(err => console.error("❌ Error DB:", err));

// MOTOR DE CORREOS PROFESIONAL
// PEGA TU API KEY DE RESEND ABAJO
const resend = new Resend('re_TU_CLAVE_AQUI'); 

const CitaSchema = new mongoose.Schema({
  clienteNombre: String,
  clienteEmail: String,
  clienteTelefono: String,
  barberiaNombre: String,
  barbero: String,
  fecha: String,
  hora: String,
  creadoEn: { type: Date, default: Date.now }
});
const Cita = mongoose.model('Cita', CitaSchema);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/reservar', async (req, res) => {
  try {
    const { clienteNombre, clienteEmail, clienteTelefono, barberiaNombre, barbero, fecha, hora } = req.body;

    const nuevaCita = new Cita({
      clienteNombre, clienteEmail, clienteTelefono, barberiaNombre, barbero, fecha, hora
    });
    await nuevaCita.save();
    console.log(`📍 Cita guardada: ${clienteNombre}`);

    // Respuesta inmediata para que la web no se quede "Procesando"
    res.status(200).json({ mensaje: "Reserva recibida" });

    // Envío de correo profesional
    await resend.emails.send({
      from: 'BarberApp <onboarding@resend.dev>',
      to: ['fabianortiz350@gmail.com', clienteEmail],
      subject: `💈 Nueva Cita: ${clienteNombre}`,
      html: `
        <div style="font-family: Arial, sans-serif; border: 2px solid #d4af37; padding: 20px; border-radius: 10px;">
          <h2 style="color: #d4af37; text-align: center;">¡Cita Confirmada!</h2>
          <p>Hola <b>${clienteNombre}</b>, estos son los datos de tu reserva:</p>
          <hr>
          <p><b>🤵 Barbero:</b> ${barbero}</p>
          <p><b>✂️ Servicio:</b> ${barberiaNombre}</p>
          <p><b>📅 Fecha:</b> ${fecha} | <b>⏰ Hora:</b> ${hora}</p>
          <p><b>📱 WhatsApp:</b> +57 ${clienteTelefono}</p>
          <hr>
          <p style="text-align: center;">¡Te esperamos para tu cambio de look!</p>
        </div>`
    });

  } catch (error) {
    console.error("❌ Error:", error);
    if (!res.headersSent) res.status(500).json({ error: "Error interno" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
