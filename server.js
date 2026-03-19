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
    .then(() => console.log("✅ Conectado a la Base de Datos en la Nube"))
    .catch(err => console.error("❌ Error de conexión:", err));

// MODELO
const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    clienteEmail: String, 
    barbero: String,
    fecha: String,
    hora: String,
    reservaId: String 
});

const Usuario = mongoose.model('Usuario', {
    correo: String,
    codigoVerificacion: String,
    fechaExpiracion: Date, 
    verificado: { type: Boolean, default: false }
});

const calendar = google.calendar({
    version: 'v3',
    auth: process.env.GOOGLE_CALENDAR_API_KEY
});

let apiInstance = new Brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_KEY; 

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- ✅ RUTA: ENVIAR CÓDIGO ---
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

// --- ✅ RUTA: VERIFICAR CÓDIGO ---
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

// --- ✅ RUTA: DISPONIBILIDAD ---
app.get('/disponibilidad', async (req, res) => {
    try {
        const { fecha, barbero } = req.query;
        const citas = await Cita.find({ fecha, barbero });
        res.json({ ocupadas: citas.map(c => c.hora), bloqueadas: [] });
    } catch (error) {
        res.status(500).json({ error: "Error cargando horas" });
    }
});

// --- ✅ RUTA: MIS CITAS ---
app.get('/mis-citas', async (req, res) => {
    try {
        const { email } = req.query;
        const citas = await Cita.find({ clienteEmail: email }).sort({ fecha: 1, hora: 1 });
        res.json(citas);
    } catch (error) {
        res.status(500).json({ error: "Error historial" });
    }
});

// --- ✅ RUTA: CANCELAR CITA ---
app.post('/cancelar-cita', async (req, res) => {
    try {
        const { id, email } = req.body;
        const citaInfo = await Cita.findOne({ _id: id, clienteEmail: email });
        if (!citaInfo) return res.status(404).json({ success: false, mensaje: "Cita no encontrada" });

        await Cita.findByIdAndDelete(id);

        let emailCancel = new Brevo.SendSmtpEmail();
        emailCancel.subject = `🚫 Cita Cancelada - Agendate Live`;
        emailCancel.htmlContent = `
            <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #ff4d4d;border-radius:20px;padding:20px;background:#fff;">
                <div style="text-align:center;background:#1a1a1a;padding:15px;border-radius:15px 15px 0 0;">
                    <h2 style="color:#ff4d4d;margin:0;">Cita Cancelada</h2>
                </div>
                <div style="padding:20px;color:#333;">
                    <p>Hola <b>${citaInfo.clienteNombre}</b>,</p>
                    <p>Confirmamos que tu cita ha sido <b>cancelada exitosamente</b>.</p>
                </div>
            </div>`;
        emailCancel.sender = { "name": "Agendate Live", "email": "fabianortiz350@gmail.com" };
        emailCancel.to = [{ "email": email }];
        await apiInstance.sendTransacEmail(emailCancel);

        res.json({ success: true, mensaje: "Cita eliminada" });
    } catch (error) {
        res.status(500).json({ error: "Error al cancelar" });
    }
});

// --- ✅ RUTA: RESERVAR CITA (Mensaje de 12 horas actualizado) ---
app.post('/reservar', async (req, res) => {
    try {
        const { clienteNombre, clienteTelefono, clienteEmail, barbero, fecha, hora, reservaId } = req.body;
        
        const nuevaCita = new Cita({ clienteNombre, clienteTelefono, clienteEmail, barbero, fecha, hora, reservaId });
        await nuevaCita.save();

        let emailConfirm = new Brevo.SendSmtpEmail();
        emailConfirm.subject = `✨ Confirmación #${reservaId} - Agendate Live`;
        emailConfirm.htmlContent = `
            <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #d4af37;border-radius:20px;padding:20px;background:#fff;">
                <div style="text-align:center;background:#1a1a1a;padding:15px;border-radius:15px 15px 0 0;">
                    <h2 style="color:#d4af37;margin:0;">Reserva Confirmada</h2>
                </div>
                <div style="padding:20px;color:#333;">
                    <p>Hola <b>${clienteNombre}</b>,</p>
                    <p>Tu cita se ha agendado con el código: <b>${reservaId}</b>.</p>
                    <div style="background:#f9f9f9;padding:15px;border-radius:10px;margin-bottom:20px;border-left:4px solid #d4af37;">
                        <p style="margin:5px 0;">📅 <b>Fecha:</b> ${fecha}</p>
                        <p style="margin:5px 0;">⏰ <b>Hora:</b> ${hora}</p>
                        <p style="margin:5px 0;">📍 <b>Lugar:</b> ${barbero}</p>
                    </div>
                    
                    <div style="background:#fff5f5; padding:15px; border-radius:10px; border:1px solid #feb2b2; text-align:center;">
                        <p style="margin:0; color:#c53030; font-size:14px; font-weight:bold;">⚠️ INFORMACIÓN IMPORTANTE</p>
                        <p style="margin:8px 0 0; color:#4a5568; font-size:13px; line-height:1.4;">
                            Para cancelar o reprogramar, debes hacerlo desde la sección <b>"Mis Citas"</b> en nuestra aplicación con un mínimo de <b>12 horas de antelación</b>.
                        </p>
                    </div>

                    <p style="font-size:12px; color:#999; margin-top:25px; text-align:center;">Gracias por confiar en Agendate Live.</p>
                </div>
            </div>`;
        emailConfirm.sender = { "name": "Agendate Live", "email": "fabianortiz350@gmail.com" };
        emailConfirm.to = [{ "email": clienteEmail }];

        await apiInstance.sendTransacEmail(emailConfirm);
        res.status(200).json({ message: "Cita guardada", reservaId });

    } catch (e) {
        res.status(500).json({ error: "Error en el servidor" });
    }
});

const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));