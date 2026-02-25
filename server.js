const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// CONEXIÓN A MONGODB (Tu base de datos actual)
const mongoURI = 'mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/?appName=BarberAPP'; 

mongoose.connect(mongoURI)
  .then(() => console.log("✅ Base de Datos Conectada"))
  .catch(err => console.error("❌ Error DB:", err));

// CONFIGURACIÓN DE CORREO PROFESIONAL (Resend)
// IMPORTANTE: Crea tu cuenta en resend.com y pega aquí tu API Key
const resend = new Resend('TU_API_KEY_DE_RESEND_AQUÍ'); 

// ESQUEMA DE LA CITA ACTUALIZADO
const CitaSchema = new mongoose.Schema({
  clienteNombre: String,
  clienteEmail: String,
  clienteTelefono: String, // Nuevo campo para Colombia
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

// RUTA DE RESERVAS PROFESIONAL
app.post('/reservar', async (req, res) => {
  try {
    const { clienteNombre, clienteEmail, clienteTelefono, barberiaNombre, barbero, fecha, hora } = req.body;

    // 1. Guardar en Base de Datos
    const nuevaCita = new Cita({
      clienteNombre, clienteEmail, clienteTelefono, barberiaNombre, barbero, fecha, hora
    });
    await nuevaCita.save();
    console.log(`📍 Cita guardada: ${clienteNombre} - WhatsApp: ${clienteTelefono}`);

    // 2. Respuesta Inmediata (Evita el "Procesando" infinito)
    res.status(200).json({ mensaje: "Reserva recibida" });

    // 3. Envío de Correo vía Resend (En segundo plano)
    // Nota: Mientras no tengas dominio propio, usa 'onboarding@resend.dev'
    await resend.emails.send({
      from: 'BarberApp <onboarding@resend.dev>',
      to: ['fabianortiz350@gmail.com', clienteEmail],
      subject: `💈 Cita Confirmada - ${barberiaNombre}`,
      html: `
        <div style="font-family: Arial, sans-serif; border: 1px solid #d4af37; padding: 20px; border-radius: 10px;">
          <h2 style="color: #d4af37;">¡Hola ${clienteNombre}!</h2>
          <p>Tu cita para <strong>${barberiaNombre}</strong> ha sido agendada con éxito.</p>
          <hr>
          <p><strong>🤵 Barbero:</strong> ${barbero}</p>
          <p><strong>📅 Fecha:</strong> ${fecha}</p>
          <p><strong>⏰ Hora:</strong> ${hora}</p>
          <p><strong>📱 WhatsApp:</strong> +57 ${clienteTelefono}</p>
          <hr>
          <p style="font-size: 0.8em; color: #666;">Si necesitas cancelar, contáctanos por WhatsApp.</p>
        </div>
      `
    });

  } catch (error) {
    console.error("❌ Error en el servidor:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error interno" });
    }
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Plataforma Profesional en puerto ${PORT}`));

