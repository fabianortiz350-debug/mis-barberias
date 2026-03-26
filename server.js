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

// MODELO USUARIO ACTUALIZADO CON ROLES Y PASSWORD
const Usuario = mongoose.model('Usuario', {
    correo: { type: String, unique: true },
    password: { type: String }, // Contraseña simple para este ejemplo
    rol: { type: String, enum: ['ADMIN', 'STAFF'], default: 'STAFF' },
    nombreEmpleado: String, // Nombre tal cual aparece en las citas (ej: "Juan")
    codigoVerificacion: String,
    fechaExpiracion: Date
});

// --- ⚙️ CONFIGURACIONES EXTERNAS ---
let apiInstance = new Brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_KEY; 

// --- 🚀 RUTAS DE AUTENTICACIÓN (LOGIN) ---

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
            res.status(401).json({ success: false, mensaje: "Correo o contraseña incorrectos" });
        }
    } catch (e) { res.status(500).send(); }
});

// --- ✅ RUTAS PARA EL STAFF (EMPLEADOS) ---

// Obtener solo las citas de UN empleado específico
app.get('/api/citas/empleado/:nombre', async (req, res) => {
    const { fecha } = req.query;
    const citas = await Cita.find({ 
        barbero: req.params.nombre, 
        fecha: fecha 
    }).sort({ hora: 1 });
    res.json(citas);
});

// Marcar como atendido
app.put('/api/citas/atender/:id', async (req, res) => {
    await Cita.findByIdAndUpdate(req.params.id, { estado: 'atendido' });
    res.json({ success: true });
});

// Reprogramar Y Notificar (WhatsApp se hace en el front, aquí hacemos el Email)
app.put('/api/citas/reprogramar/:id', async (req, res) => {
    const { hora } = req.body;
    const cita = await Cita.findByIdAndUpdate(req.params.id, { hora: hora }, { new: true });
    
    // Notificar por Correo vía Brevo
    try {
        let emailRepro = new Brevo.SendSmtpEmail();
        emailRepro.subject = "Cita Reprogramada - Agendate Live";
        emailRepro.htmlContent = `<h3>Hola ${cita.clienteNombre}</h3><p>Tu cita ha sido movida a las <b>${hora}</b> el día ${cita.fecha}.</p>`;
        emailRepro.sender = { "name": "Agendate Live", "email": "fabianortiz350@gmail.com" };
        emailRepro.to = [{ "email": cita.clienteEmail }];
        await apiInstance.sendTransacEmail(emailRepro);
    } catch (e) { console.log("Error enviando correo de reprogramación"); }

    res.json({ success: true });
});

// --- 👑 RUTAS PARA EL DUEÑO (ADMIN) ---

// Ver TODAS las citas de un negocio (puede filtrar por empleado si se desea)
app.get('/api/admin/citas-global', async (req, res) => {
    const { fecha, empleado } = req.query;
    let query = { fecha: fecha };
    if (empleado && empleado !== 'todos') query.barbero = empleado;
    
    const citas = await Cita.find(query).sort({ hora: 1 });
    res.json(citas);
});

// CANCELAR CITA (Solo el dueño usará esta ruta)
app.delete('/api/admin/cancelar/:id', async (req, res) => {
    await Cita.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// --- 🛠️ RUTAS ORIGINALES MANTENIDAS ---

app.get('/api/negocios/:id', async (req, res) => {
    const negocio = await Negocio.findOne({ idSlug: req.params.id });
    negocio ? res.json(negocio) : res.status(404).send();
});

app.post('/reservar', async (req, res) => {
    try {
        const { clienteNombre, clienteTelefono, clienteEmail, barbero, fecha, hora, reservaId, servicio, precio } = req.body;
        const nuevaCita = new Cita({ clienteNombre, clienteTelefono, clienteEmail, barbero, fecha, hora, reservaId, servicio, precio });
        await nuevaCita.save();
        res.json({ success: true });
    } catch (e) { res.status(500).send(); }
});

// Función para crear usuarios de prueba iniciales
async function cargarDatosIniciales() {
    const conteoUser = await Usuario.countDocuments();
    if (conteoUser === 0) {
        await Usuario.insertMany([
            { correo: "dueno@test.com", password: "123", rol: "ADMIN", nombreEmpleado: "Dueño" },
            { correo: "juan@test.com", password: "123", rol: "STAFF", nombreEmpleado: "Juan" },
            { correo: "pedro@test.com", password: "123", rol: "STAFF", nombreEmpleado: "Pedro" }
        ]);
        console.log("👥 Usuarios de prueba creados");
    }
}

const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));