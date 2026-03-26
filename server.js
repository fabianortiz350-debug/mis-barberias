const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const Brevo = require('@getbrevo/brevo'); 
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- 🔌 CONEXIÓN BASE DE DATOS ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";
mongoose.connect(mongoURI)
    .then(() => {
        console.log("✅ Conectado a MongoDB");
        cargarDatosIniciales(); 
    })
    .catch(err => console.error("❌ Error de conexión:", err));

// --- 🏗️ MODELOS DE DATOS ---

const Negocio = mongoose.model('Negocio', {
    idSlug: { type: String, unique: true },
    nombre: String,
    ubicacion: String,
    imagen: String,
    categoria: String,
    adminEmail: String,
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
    correo: { type: String, unique: true },
    password: { type: String },
    rol: { type: String, enum: ['ADMIN', 'STAFF'], default: 'STAFF' },
    nombreEmpleado: String,
    codigoVerificacion: String,
    fechaExpiracion: Date
});

// --- ⚙️ CONFIGURACIÓN BREVO ---
let apiInstance = new Brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_KEY; 

// --- 🚀 RUTAS DE AUTENTICACIÓN ---

app.post('/api/login', async (req, res) => {
    const { correo, password } = req.body;
    try {
        const user = await Usuario.findOne({ correo, password });
        if (user) {
            res.json({ 
                success: true, 
                rol: user.rol, 
                nombre: user.nombreEmpleado,
                correo: user.correo 
            });
        } else {
            res.status(401).json({ success: false, mensaje: "Credenciales incorrectas" });
        }
    } catch (e) { res.status(500).json({ error: "Error en login" }); }
});

// --- 💇 RUTAS PARA EMPLEADOS (STAFF) ---

app.get('/api/citas/empleado/:nombre', async (req, res) => {
    const { fecha } = req.query;
    const citas = await Cita.find({ barbero: req.params.nombre, fecha: fecha }).sort({ hora: 1 });
    res.json(citas);
});

// --- 👑 RUTAS PARA EL DUEÑO (ADMIN) ---

// Ver TODOS los negocios de un dueño
app.get('/api/propios/:email', async (req, res) => {
    const negocios = await Negocio.find({ adminEmail: req.params.email });
    res.json(negocios);
});

// Ver TODAS las citas del día (Global)
app.get('/api/admin/citas-global', async (req, res) => {
    const { fecha, barbero } = req.query;
    let filtro = { fecha: fecha };
    if (barbero && barbero !== 'todos') filtro.barbero = barbero;
    const citas = await Cita.find(filtro).sort({ hora: 1 });
    res.json(citas);
});

// CANCELAR/BORRAR CITA (Solo Admin)
app.delete('/api/admin/cancelar/:id', async (req, res) => {
    try {
        await Cita.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "No se pudo eliminar" }); }
});

// Actualizar Negocio (Servicios y Horarios)
app.put('/api/negocios/:slug', async (req, res) => {
    try {
        const { servicios, horario } = req.body;
        await Negocio.findOneAndUpdate({ idSlug: req.params.slug }, { servicios, horario });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Error al actualizar" }); }
});

// --- ✅ GESTIÓN DE CITAS (GENERAL) ---

app.put('/api/citas/atender/:id', async (req, res) => {
    await Cita.findByIdAndUpdate(req.params.id, { estado: 'atendido' });
    res.json({ success: true });
});

app.put('/api/citas/reprogramar/:id', async (req, res) => {
    const { hora } = req.body;
    const cita = await Cita.findByIdAndUpdate(req.params.id, { hora: hora }, { new: true });
    
    // Notificar por Email
    try {
        let emailRepro = new Brevo.SendSmtpEmail();
        emailRepro.subject = "Cita Reprogramada";
        emailRepro.htmlContent = `<p>Tu cita ha sido movida a las ${hora}.</p>`;
        emailRepro.sender = { "name": "Agendate Live", "email": "fabianortiz350@gmail.com" };
        emailRepro.to = [{ "email": cita.clienteEmail }];
        await apiInstance.sendTransacEmail(emailRepro);
    } catch (e) { console.log("Error email"); }
    res.json({ success: true });
});

// --- 📅 DISPONIBILIDAD Y RESERVAS ---

app.get('/disponibilidad', async (req, res) => {
    const { fecha, barbero } = req.query;
    const ocupadas = await Cita.find({ fecha, barbero, estado: 'confirmada' });
    res.json({ ocupadas: ocupadas.map(c => c.hora) });
});

app.post('/reservar', async (req, res) => {
    const { clienteNombre, clienteTelefono, clienteEmail, barbero, fecha, hora, reservaId, servicio, precio } = req.body;
    const nuevaCita = new Cita({ clienteNombre, clienteTelefono, clienteEmail, barbero, fecha, hora, reservaId, servicio, precio });
    await nuevaCita.save();
    res.json({ success: true });
});

// --- 🛠️ INICIALIZACIÓN ---

async function cargarDatosIniciales() {
    const conteoUser = await Usuario.countDocuments();
    if (conteoUser === 0) {
        await Usuario.insertMany([
            { correo: "dueno@test.com", password: "123", rol: "ADMIN", nombreEmpleado: "Dueño" },
            { correo: "juan@test.com", password: "123", rol: "STAFF", nombreEmpleado: "Juan" }
        ]);
        console.log("👥 Usuarios de prueba listos");
    }
}

const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => console.log(`🚀 Corriendo en puerto ${PORT}`));