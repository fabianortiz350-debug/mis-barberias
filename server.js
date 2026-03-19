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
    .then(() => console.log("✅ Conectado a la Base de Datos"))
    .catch(err => console.error("❌ Error de conexión:", err));

// --- 1. MODELO ACTUALIZADO CON ESTADO ---
const Cita = mongoose.model('Cita', {
    clienteNombre: String,
    clienteTelefono: String,
    clienteEmail: String, 
    barbero: String,
    fecha: String,
    hora: String,
    reservaId: String,
    estado: { type: String, default: 'confirmada' } // Nuevo: 'confirmada' o 'cancelada'
});

const Usuario = mongoose.model('Usuario', {
    correo: String,
    codigoVerificacion: String,
    fechaExpiracion: Date, 
    verificado: { type: Boolean, default: false }
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
        res.status(500).json({ mensaje: "Error al enviar" });
    }
});

// --- ✅ RUTA: VERIFICAR CÓDIGO ---
app.post('/api/auth/verificar', async (req, res) => {
    const { correo, codigo } = req.body;
    try {
        const usuario = await Usuario.findOne({ correo });
        if (!usuario || usuario.codigoVerificacion !== codigo) {
            return res.status(400).json({ success: false, mensaje: "Código incorrecto" });
        }
        await Usuario.findOneAndUpdate({ correo }, { codigoVerificacion: null });
        res.json({ success: true, mensaje: "Acceso concedido" });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// --- ✅ RUTA: DISPONIBILIDAD (Solo cuenta citas NO canceladas) ---
app.get('/disponibilidad', async (req, res) => {
    try {
        const { fecha, barbero } = req.query;
        // Importante: Solo buscamos las que NO estén canceladas para liberar el horario
        const citas = await Cita.find({ fecha, barbero, estado: 'confirmada' });
        res.json({ ocupadas: citas.map(c => c.hora), bloqueadas: [] });
    } catch (error) {
        res.status(500).json({ error: "Error" });
    }
});

// --- ✅ RUTA: MIS CITAS (Trae todas: confirmadas y canceladas) ---
app.get('/mis-citas', async (req, res) => {
    try {
        const { email } = req.query;
        const citas = await Cita.find({ clienteEmail: email }).sort({ fecha: -1, hora: 1 });
        res.json(citas);
    } catch (error) {
        res.status(500).json({ error: "Error historial" });
    }
});

// --- ✅ RUTA: CANCELAR CITA (Actualizada: No borra, solo cambia el estado) ---
app.post('/cancelar-cita', async (req, res) => {
    try {
        const { id, email } = req.body;
        
        // En lugar de borrar, actualizamos el estado a 'cancelada'
        const citaActualizada = await Cita.findOneAndUpdate(
            { _id: id, clienteEmail: email },
            { estado: 'cancelada' },
            { new: true }
        );

        if (!citaActualizada) return res.status(404).json({ success: false, mensaje: "Cita no encontrada" });

        // Enviar correo de confirmación de cancelación
        let emailCancel = new Brevo.SendSmtpEmail();
        emailCancel.subject = `🚫 Cita Cancelada - Agendate Live`;
        emailCancel.htmlContent = `
            <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #ff4d4d;border-radius:20px;padding:20px;background:#fff;">
                <div style="text-align:center;background:#1a1a1a;padding:15px;border-radius:15px 15px 0 0;">
                    <h2 style="color:#ff4d4d;margin:0;">Cita Cancelada</h2>
                </div>
                <p>Hola <b>${citaActualizada.clienteNombre}</b>, confirmamos que tu cita ha sido cancelada.</p>
            </div>`;
        emailCancel.sender = { "name": "Agendate Live", "email": "fabianortiz350@gmail.com" };
        emailCancel.to = [{ "email": email }];
        await apiInstance.sendTransacEmail(emailCancel);

        res.json({ success: true, mensaje: "Cita marcada como cancelada" });
    } catch (error) {
        res.status(500).json({ error: "Error al cancelar" });
    }
});

// --- ✅ RUTA: RESERVAR CITA ---
app.post('/reservar', async (req, res) => {
    try {
        const { clienteNombre, clienteTelefono, clienteEmail, barbero, fecha, hora, reservaId } = req.body;
        
        const nuevaCita = new Cita({ 
            clienteNombre, 
            clienteTelefono, 
            clienteEmail, 
            barbero, 
            fecha, 
            hora, 
            reservaId,
            estado: 'confirmada' // Estado inicial
        });
        await nuevaCita.save();

        let emailConfirm = new Brevo.SendSmtpEmail();
        emailConfirm.subject = `✨ Confirmación #${reservaId} - Agendate Live`;
        emailConfirm.htmlContent = `
            <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #d4af37;border-radius:20px;padding:20px;">
                <h2 style="text-align:center; color:#d4af37;">Reserva Confirmada</h2>
                <p>Tu código: <b>${reservaId}</b></p>
                <p>Fecha: ${fecha} | Hora: ${hora}</p>
                <hr>
                <p style="color:red; font-weight:bold;">⚠️ NOTA: Si necesitas cancelar, hazlo desde "Mis Citas" con al menos 12 horas de antelación.</p>
            </div>`;
        emailConfirm.sender = { "name": "Agendate Live", "email": "fabianortiz350@gmail.com" };
        emailConfirm.to = [{ "email": clienteEmail }];

        await apiInstance.sendTransacEmail(emailConfirm);
        res.status(200).json({ message: "Cita guardada", reservaId });
    } catch (e) {
        res.status(500).json({ error: "Error" });
    }
});

const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => console.log(`🚀 Servidor listo` ));