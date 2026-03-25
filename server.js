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
    adminEmail: String, // NUEVO: Correo del dueño/administrador del local
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
    barbero: String, 
    servicio: String, 
    precio: Number,   
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

// Servir el panel de Super Admin
app.get('/super-admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'super-admin.html'));
});

// Guardar negocio (Actualizado para capturar adminEmail)
app.post('/api/negocios', async (req, res) => {
    try {
        const { nombre, ubicacion, imagen, categoria, adminEmail } = req.body;
        let slugBase = generarSlug(nombre);
        const existe = await Negocio.findOne({ idSlug: slugBase });
        const slugFinal = existe ? `${slugBase}-${Math.floor(1000 + Math.random() * 9000)}` : slugBase;

        const nuevoNegocio = new Negocio({
            idSlug: slugFinal,
            nombre,
            ubicacion,
            imagen,
            categoria,
            adminEmail, // Se guarda el correo del dueño
            servicios: [{ nombre: "Servicio General", precio: 0 }] 
        });

        await nuevoNegocio.save();
        res.status(201).json({ success: true, slug: slugFinal });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al guardar" });
    }
});

// NUEVA RUTA: Para que el dueño actualice su negocio (servicios/horarios)
app.put('/api/negocios/:slug', async (req, res) => {
    try {
        const { servicios, horario } = req.body;
        await Negocio.findOneAndUpdate({ idSlug: req.params.slug }, { servicios, horario });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Error al actualizar" });
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

// --- ✅ RESERVAS ---

app.get('/disponibilidad', async (req, res) => {
    const { fecha, barbero } = req.query;
    const ocupadas = await Cita.find({ fecha, barbero, estado: 'confirmada' });
    res.json({ ocupadas: ocupadas.map(c => c.hora) });
});

app.post('/reservar', async (req, res) => {
    try {
        const { clienteNombre, clienteTelefono, clienteEmail, barbero, fecha, hora, reservaId, servicio, precio } = req.body;
        const choque = await Cita.findOne({ fecha, hora, barbero, estado: 'confirmada' });
        if (choque) return res.status(400).json({ error: "Esta hora ya no está disponible" });

        const nuevaCita = new Cita({ 
            clienteNombre, clienteTelefono, clienteEmail, barbero, fecha, hora, reservaId, servicio, precio 
        });
        await nuevaCita.save();

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

// NUEVA RUTA: Para obtener los negocios que pertenecen a un dueño específico
app.get('/api/propios/:email', async (req, res) => {
    const negocios = await Negocio.find({ adminEmail: req.params.email });
    res.json(negocios);
});

async function cargarDatosIniciales() {
    const conteo = await Negocio.countDocuments();
    if (conteo === 0) {
        await Negocio.insertMany([
            { idSlug: 'barberia-pro', nombre: 'Barbería Pro', ubicacion: 'Centro', categoria: 'barberia', adminEmail: 'admin@test.com', servicios: [{nombre: "Corte Caballero", precio: 15000}] }
        ]);
    }
}

const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => console.log(`🚀 Puerto ${PORT}`));