const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const Brevo = require('@getbrevo/brevo');
const path = require('path'); 
const app = express();

app.use(cors());
app.use(express.json());

// ✅ Servir archivos estáticos (HTML, CSS, JS del navegador)
app.use(express.static(path.join(__dirname))); 

// ✅ Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 🔌 CONEXIÓN MONGO ---
const mongoURI = "mongodb+srv://fabianortiz350_db_user:WDhJIsmj0UDbpoV7@barberapp.9qsaddh.mongodb.net/barberia?retryWrites=true&w=majority&appName=BarberAPP";
mongoose.connect(mongoURI)
    .then(() => console.log("✅ DB Conectada con éxito"))
    .catch(e => console.log("❌ Error fatal en DB:", e));

// --- 🏗️ MODELOS (Sin cambios, están perfectos) ---
const Usuario = mongoose.model('Usuario', {
    correo: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    rol: { type: String, enum: ['SUPER', 'ADMIN', 'STAFF', 'CLIENTE'], default: 'CLIENTE' },
    nombre: String,
    negocioId: String, 
    codigoVerificacion: String,
    fechaExpiracion: Date
});

const Negocio = mongoose.model('Negocio', {
    nombre: String,
    categoria: String,
    img: String,
    ubicacion: String,
    intervalo: { type: Number, default: 60 },
    adminEmail: String,
    creadoEn: { type: Date, default: Date.now }
});

const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    clienteEmail: String,
    barbero: String,
    fecha: String,
    hora: String,
    estado: { type: String, enum: ['pendiente', 'confirmada', 'realizada', 'cancelada'], default: 'confirmada' },
    reservaId: String,
    negocioId: String
});

// --- ⚙️ CONFIG BREVO ---
// Borra las líneas que daban error y usa estas:
const apiInstance = new Brevo.TransactionalEmailsApi();

// Así se pone la API KEY de forma segura
apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_KEY || 'TU_API_KEY_AQUI');

const apiInstance = new Brevo.TransactionalEmailsApi();

// --- 🔐 SISTEMA AUTH 2 PASOS ---

app.post('/api/auth/login', async (req, res) => {
    const { correo, password } = req.body;
    try {
        const user = await Usuario.findOne({ correo });
        if (!user) return res.status(404).json({ mensaje: "Este correo no está registrado" });

        const passValida = await bcrypt.compare(password, user.password);
        if (!passValida) return res.status(401).json({ mensaje: "La contraseña es incorrecta" });

        // Generar código de 6 dígitos
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        user.codigoVerificacion = codigo;
        user.fechaExpiracion = new Date(Date.now() + 10 * 60000); // 10 min
        await user.save();

        // Configurar el email
        let sendEmail = new Brevo.SendSmtpEmail();
        sendEmail.subject = `Tu código de acceso: ${codigo}`;
        sendEmail.htmlContent = `
            <div style="font-family: sans-serif; text-align: center; padding: 20px;">
                <h2>Verificación Agendate Live</h2>
                <p>Usa este código para ingresar al panel:</p>
                <h1 style="color: #d4af37; letter-spacing: 5px;">${codigo}</h1>
                <p>Expira en 10 minutos.</p>
            </div>`;
        sendEmail.sender = { name: "Agendate Live", email: "fabianortiz350@gmail.com" };
        sendEmail.to = [{ email: correo }];
        
        await apiInstance.sendTransacEmail(sendEmail);
        res.json({ success: true, mensaje: "Código enviado al correo" });

    } catch (e) { 
        console.error("Error en Login:", e);
        res.status(500).json({ error: "No se pudo enviar el correo. Revisa tu configuración de Brevo." }); 
    }
});

app.post('/api/auth/verificar', async (req, res) => {
    const { correo, codigo } = req.body;
    try {
        const user = await Usuario.findOne({ 
            correo, 
            codigoVerificacion: codigo, 
            fechaExpiracion: { $gt: new Date() } 
        });

        if (user) {
            user.codigoVerificacion = null; // Limpiar código tras éxito
            await user.save();
            res.json({ 
                success: true, 
                rol: user.rol, 
                nombre: user.nombre, 
                correo: user.correo,
                negocioId: user.negocioId 
            });
        } else {
            res.status(401).json({ success: false, mensaje: "Código inválido o expirado" });
        }
    } catch (e) {
        res.status(500).json({ error: "Error al verificar" });
    }
});

// --- 🚀 REGISTRO INTERNO (Para crear tu primer SUPER ADMIN) ---
app.post('/api/auth/registrar-interno', async (req, res) => {
    const { correo, password, rol, nombre } = req.body;
    try {
        const existe = await Usuario.findOne({ correo });
        if (existe) return res.status(400).json({ error: "El usuario ya existe" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const nuevoUser = new Usuario({ correo, password: hashedPassword, rol: rol || 'ADMIN', nombre });
        await nuevoUser.save();
        res.json({ success: true, mensaje: "Usuario creado correctamente" });
    } catch (e) { 
        res.status(500).json({ error: "Error en el registro: " + e.message }); 
    }
});

// (Aquí irían el resto de tus rutas de citas y negocios que ya tienes)

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));