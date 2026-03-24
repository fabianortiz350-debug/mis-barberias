const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis'); 
const Brevo = require('@getbrevo/brevo'); 
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";
mongoose.connect(mongoURI)
    .then(() => {
        console.log("✅ Conectado a la Base de Datos en la Nube");
        cargarDatosIniciales(); // <--- Activa la creación de categorías
    })
    .catch(err => console.error("❌ Error de conexión:", err));

// --- 🏗️ MODELOS DE DATOS ---

const Negocio = mongoose.model('Negocio', {
    idSlug: String,      
    nombre: String,
    ubicacion: String,
    imagen: String,
    categoria: String    
});

const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    clienteEmail: String, 
    barbero: String,
    fecha: String,
    hora: String,
    reservaId: String,
    estado: { type: String, default: 'confirmada' } 
});

const Usuario = mongoose.model('Usuario', {
    correo: String,
    codigoVerificacion: String,
    fechaExpiracion: Date, 
    verificado: { type: Boolean, default: false }
});

// --- ⚙️ CONFIGURACIONES EXTERNAS ---

const calendar = google.calendar({
    version: 'v3',
    auth: process.env.GOOGLE_CALENDAR_API_KEY
});

let apiInstance = new Brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_KEY; 

// --- 🚀 RUTAS DEL SISTEMA ---

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// RUTA: Obtener un negocio específico
app.get('/api/negocios/:id', async (req, res) => {
    try {
        const negocio = await Negocio.findOne({ idSlug: req.params.id });
        if (negocio) {
            res.json(negocio);
        } else {
            res.status(404).json({ mensaje: "Negocio no encontrado" });
        }
    } catch (error) {
        res.status(500).json({ mensaje: "Error al buscar el negocio" });
    }
});

// RUTA: Listar negocios por categoría
app.get('/api/categorias/:cat', async (req, res) => {
    try {
        const lista = await Negocio.find({ categoria: req.params.cat });
        res.json(lista);
    } catch (error) {
        res.status(500).json({ mensaje: "Error al filtrar categorías" });
    }
});

// --- ✅ RUTAS DE AUTENTICACIÓN ---

app.post('/api/auth/enviar-codigo', async (req, res) => {
    const { correo, htmlCustom } = req.body;
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 5 * 60 * 1000); 

    try {
        await Usuario.findOneAndUpdate(
            { correo }, 
            { codigoVerificacion: codigo, fechaExpiracion: expiracion }, 
            { upsert: true }
        );

        const disenioFinal = htmlCustom 
            ? htmlCustom.replace('{{CODIGO}}', codigo) 
            : `<h3>Bienvenido</h3><p>Tu código es: <b>${codigo}</b></p>`;

        let sendSmtpEmail = new Brevo.SendSmtpEmail();
        sendSmtpEmail.subject = "Tu código de seguridad - Agendate Live";
        sendSmtpEmail.htmlContent = disenioFinal;
        sendSmtpEmail.sender = { "name": "Agendate Live", "email": "fabianortiz350@gmail.com" };
        sendSmtpEmail.to = [{ "email": correo }];

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.json({ mensaje: "Código enviado" });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al enviar el correo" });
    }
});

app.post('/api/auth/verificar', async (req, res) => {
    const { correo, codigo } = req.body;
    try {
        const usuario = await Usuario.findOne({ correo });
        if (!usuario || !usuario.codigoVerificacion) return res.status(400).json({ success: false, mensaje: "No hay código activo" });
        if (new Date() > usuario.fechaExpiracion) return res.status(400).json({ success: false, mensaje: "Código expirado" });
        
        if (usuario.codigoVerificacion === codigo) {
            await Usuario.findOneAndUpdate({ correo }, { codigoVerificacion: null }); 
            res.json({ success: true, mensaje: "Acceso concedido" });
        } else {
            res.status(400).json({ success: false, mensaje: "Código incorrecto" });
        }
    } catch (error) {
        res.status(500).json({ success: false, mensaje: "Error servidor" });
    }
});

// --- ✅ RUTAS DE CITAS Y DISPONIBILIDAD ---

app.get('/disponibilidad', async (req, res) => {
    try {
        const { fecha, barbero } = req.query;
        const citas = await Cita.find({ fecha, barbero, estado: 'confirmada' });
        res.json({ ocupadas: citas.map(c => c.hora), bloqueadas: [] });
    } catch (error) {
        res.status(500).json({ error: "Error cargando horas" });
    }
});

app.get('/mis-citas', async (req, res) => {
    try {
        const { email } = req.query;
        const citas = await Cita.find({ clienteEmail: email })
                               .sort({ fecha: -1, hora: -1 })
                               .limit(10);
        res.json(citas);
    } catch (error) {
        res.status(500).json({ error: "Error historial" });
    }
});

app.post('/cancelar-cita', async (req, res) => {
    try {
        const { id, email } = req.body;
        const citaInfo = await Cita.findOneAndUpdate(
            { _id: id, clienteEmail: email },
            { estado: 'cancelada' },
            { new: true }
        );

        if (!citaInfo) return res.status(404).json({ success: false, mensaje: "Cita no encontrada" });

        let emailCancel = new Brevo.SendSmtpEmail();
        emailCancel.subject = `🚫 Cita Cancelada - Agendate Live`;
        emailCancel.htmlContent = `<p>Hola <b>${citaInfo.clienteNombre}</b>, tu cita ha sido cancelada exitosamente.</p>`;
        emailCancel.sender = { "name": "Agendate Live", "email": "fabianortiz350@gmail.com" };
        emailCancel.to = [{ "email": email }];
        await apiInstance.sendTransacEmail(emailCancel);

        res.json({ success: true, mensaje: "Cita marcada como cancelada" });
    } catch (error) {
        res.status(500).json({ error: "Error al cancelar" });
    }
});

app.post('/reservar', async (req, res) => {
    try {
        const { clienteNombre, clienteTelefono, clienteEmail, barbero, fecha, hora, reservaId } = req.body;
        const nuevaCita = new Cita({ 
            clienteNombre, clienteTelefono, clienteEmail, barbero, fecha, hora, reservaId, estado: 'confirmada' 
        });
        await nuevaCita.save();

        let emailConfirm = new Brevo.SendSmtpEmail();
        emailConfirm.subject = `✨ Confirmación #${reservaId} - Agendate Live`;
        emailConfirm.htmlContent = `<p>Tu cita se ha agendado con el código: <b>${reservaId}</b>.</p>`;
        emailConfirm.sender = { "name": "Agendate Live", "email": "fabianortiz350@gmail.com" };
        emailConfirm.to = [{ "email": clienteEmail }];

        await apiInstance.sendTransacEmail(emailConfirm);
        res.status(200).json({ message: "Cita guardada", reservaId });
    } catch (e) {
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// --- 💾 FUNCIÓN DE CARGA DE CATEGORÍAS ---
async function cargarDatosIniciales() {
    try {
        const conteo = await Negocio.countDocuments();
        if (conteo === 0) {
            await Negocio.insertMany([
                { idSlug: 'barberia-1', nombre: 'Barbería Pro', ubicacion: 'Calle 1', imagen: 'https://via.placeholder.com/500', categoria: 'barberia' },
                { idSlug: 'spa-1', nombre: 'Spa Relax', ubicacion: 'Calle 2', imagen: 'https://via.placeholder.com/500', categoria: 'spa' },
                { idSlug: 'odontologia-1', nombre: 'Odonto Salud', ubicacion: 'Calle 3', imagen: 'https://via.placeholder.com/500', categoria: 'odontologia' },
                { idSlug: 'veterinaria-1', nombre: 'Vet Care', ubicacion: 'Calle 4', imagen: 'https://via.placeholder.com/500', categoria: 'veterinaria' },
                { idSlug: 'gastronomia-1', nombre: 'Restaurante Gourmet', ubicacion: 'Calle 5', imagen: 'https://via.placeholder.com/500', categoria: 'gastronomia' },
                { idSlug: 'turismo-1', nombre: 'Tour Aventura', ubicacion: 'Calle 6', imagen: 'https://via.placeholder.com/500', categoria: 'turismo' },
                { idSlug: 'automotriz-1', nombre: 'Taller Motor', ubicacion: 'Calle 7', imagen: 'https://via.placeholder.com/500', categoria: 'automotriz' },
                { idSlug: 'otros-1', nombre: 'Servicio General', ubicacion: 'Calle 8', imagen: 'https://via.placeholder.com/500', categoria: 'otros' }
            ]);
            console.log("✅ Categorías iniciales creadas");
        }
    } catch (error) {
        console.error("❌ Error al cargar datos:", error);
    }
}

const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));