const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos (para que cargue tus fotos o estilos si tienes)
app.use(express.static(__dirname));

const mongoURI = 'mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/?appName=BarberAPP'; 

mongoose.connect(mongoURI)
  .then(() => console.log("✅ Conectado a la Base de Datos en la Nube"))
  .catch(err => console.error("❌ Error de conexión:", err));

// Esquema para guardar las citas
const CitaSchema = new mongoose.Schema({
  barberiaNombre: String,
  clienteNombre: String,
  clienteEmail: String,
  fecha: String,
  hora: String,
  creadoEn: { type: Date, default: Date.now }
});
const Cita = mongoose.model('Cita', CitaSchema);

// --- ESTO ES LO NUEVO: MOSTRAR TU PÁGINA ---
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// CONFIGURACIÓN DE TU GMAIL
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'fabianortiz350@gmail.com',
    pass: 'lcpfyayysewetkoy' 
  }
});

app.post('/reservar', async (req, res) => {
  try {
    const nuevaCita = new Cita(req.body);
    await nuevaCita.save();

    const { clienteEmail, barberoEmail, clienteNombre, fecha, hora, barberiaNombre } = req.body;
    await transporter.sendMail({
      from: '"BarberApp Pro" <fabianortiz350@gmail.com>',
      to: `${clienteEmail}, ${barberoEmail}`,
      subject: `💈 Cita Confirmada - ${barberiaNombre}`,
      html: `<h1>¡Hola ${clienteNombre}!</h1><p>Tu cita en <b>${barberiaNombre}</b> está lista para el ${fecha} a las ${hora}.</p>`
    });

    res.status(200).send("Cita guardada y correos enviados");
  } catch (error) {
    console.log(error);
    res.status(500).send("Error en el servidor");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));
