const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const Brevo = require('@getbrevo/brevo'); 
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";
mongoose.connect(mongoURI)
    .then(() => {
        console.log("✅ Conectado a MongoDB");
        cargarDatosIniciales(); 
    })
    .catch(err => console.error("❌ Error de conexión:", err));

// --- 🏗️ MODELOS DE DATOS ACTUALIZADOS ---

const Negocio = mongoose.model('Negocio', {
    idSlug: { type: String, unique: true },
    nombre: String,
    ubicacion: String,
    imagen: String,
    categoria: String,
    // NUEVO: Para ser profesional estilo Booksy
    servicios: [{ nombre: String, precio: Number }], 
    horario: {
        inicio: { type: String, default: "08:00" },
        fin: { type: String, default: "18:00" }
    }
});

const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    clienteEmail: String, 
    barbero: String, // Este campo actúa como el ID del negocio o profesional
    servicio: String, // NUEVO: Qué se va a hacer el cliente
    precio: Number,   // NUEVO: Cuánto va a pagar
    fecha: String,
    hora: String,
    reservaId: String,
    estado: { type: String, default: 'confirmada' } 
});

const Usuario = mongoose.model('Usuario', {
    correo: String,
    codigoVerificacion: String,
    fechaExpiracion: Date
});

// --- ⚙️ CONFIGURACIONES EXTERNAS ---

let apiInstance = new Brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_KEY; 

// --- 🛠️ FUNCIONES DE APOYO ---

function generarSlug(texto) {
    return texto.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

// --- 🚀 RUTAS ---

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

app.get('/admin-control-777', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Guardar negocio con servicios básicos por defecto
app.post('/api/negocios', async (req, res) => {
    try {
        const { nombre, ubicacion, imagen, categoria } = req.body;
        let slugBase = generarSlug(nombre);
        const existe = await Negocio.findOne({ idSlug: slugBase });
        const slugFinal = existe ? `${slugBase}-${Math.floor(1000 + Math.random() * 9000)}` : slugBase;

        const nuevoNegocio = new Negocio({
            idSlug: slugFinal,
            nombre,
            ubicacion,
            imagen,
            categoria,
            servicios: [{ nombre: "Servicio General", precio: 0 }] // Servicio base
        });

        await nuevoNegocio.save();
        res.status(201).json({ success: true, slug: slugFinal });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al guardar" });
    }
});

app.get('/api/negocios/:id', async (req, res) => {
    const negocio = await Negocio.findOne({ idSlug: req.params.id });
    negocio ? res.json(negocio) : res.status(404).send();
});

app.get('/api/categorias/:cat', async (req, res) => {
    const lista = await Negocio.find({ categoria: req.params.cat });
    res.json(lista);
});

// --- ✅ AUTH ---

app.post('/api/auth/enviar-codigo', async (req, res) => {
    const { correo } = req.body;
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 5 * 60 * 1000); 

    try {
        await Usuario.findOneAndUpdate({ correo }, { codigoVerificacion: codigo, fechaExpiracion: expiracion }, { upsert: true });
        let sendSmtpEmail = new Brevo.SendSmtpEmail();
        sendSmtpEmail.subject = "Código Agendate Live";
        sendSmtpEmail.htmlContent = `<h3>Tu código es: ${codigo}</h3>`;
        sendSmtpEmail.sender = { "name": "Agendate Live", "email": "fabianortiz350@gmail.com" };
        sendSmtpEmail.to = [{ "email": correo }];
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.json({ mensaje: "Enviado" });
    } catch (e) { res.status(500).send(); }
});

app.post('/api/auth/verificar', async (req, res) => {
    const { correo, codigo } = req.body;
    const usuario = await Usuario.findOne({ correo });
    if (usuario && usuario.codigoVerificacion === codigo && new Date() < usuario.fechaExpiracion) {
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, mensaje: "Código inválido o expirado" });
    }
});

// --- ✅ RESERVAS CON VALIDACIÓN PROFESIONAL ---

app.get('/disponibilidad', async (req, res) => {
    const { fecha, barbero } = req.query;
    // Buscamos solo citas confirmadas para esa fecha y negocio
    const ocupadas = await Cita.find({ fecha, barbero, estado: 'confirmada' });
    res.json({ ocupadas: ocupadas.map(c => c.hora) });
});

app.post('/reservar', async (req, res) => {
    try {
        const { clienteNombre, clienteTelefono, clienteEmail, barbero, fecha, hora, reservaId, servicio, precio } = req.body;

        // CRÍTICO: Verificar si alguien más ganó la hora en el último segundo
        const choque = await Cita.findOne({ fecha, hora, barbero, estado: 'confirmada' });
        if (choque) return res.status(400).json({ error: "Esta hora ya no está disponible" });

        const nuevaCita = new Cita({ 
            clienteNombre, clienteTelefono, clienteEmail, barbero, fecha, hora, reservaId, servicio, precio 
        });
        await nuevaCita.save();

        // Email de confirmación
        let emailConfirm = new Brevo.SendSmtpEmail();
        emailConfirm.subject = `Confirmación Cita #${reservaId}`;
        emailConfirm.htmlContent = `<p>Hola ${clienteNombre}, cita confirmada para el ${fecha} a las ${hora}.</p>`;
        emailConfirm.sender = { "name": "Agendate Live", "email": "fabianortiz350@gmail.com" };
        emailConfirm.to = [{ "email": clienteEmail }];
        await apiInstance.sendTransacEmail(emailConfirm);

        res.json({ success: true, reservaId });
    } catch (e) { res.status(500).send(); }
});

app.get('/mis-citas', async (req, res) => {
    const citas = await Cita.find({ clienteEmail: req.query.email }).sort({ fecha: -1 });
    res.json(citas);
});

async function cargarDatosIniciales() {
    const conteo = await Negocio.countDocuments();
    if (conteo === 0) {
        await Negocio.insertMany([
            { idSlug: 'barberia-pro', nombre: 'Barbería Pro', ubicacion: 'Centro', categoria: 'barberia', servicios: [{nombre: "Corte Caballero", precio: 15000}] }
        ]);
    }
}

const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => console.log(`🚀 Puerto ${PORT}`));