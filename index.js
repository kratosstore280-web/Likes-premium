require('dotenv').config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const P = require('pino');
const fs = require('fs');
const axios = require('axios');

// ================= CONFIG =================

const DB_PATH = './database.json';

const API_KEY_HUB = "Kratosbotpasses123";
const API_URL_HUB = "https://americanhub.com.br/api/v1/send-pass";

const DONOS = [
    "556993543234",
    "5551995588124",
    "44930357551239",
    "25701671538894"
];

const NomeDoBot = "KRATOS-STORE";
const CONTATO_COMPRA = "5551995588124";
const NUMERO_CONEXAO = "556993543234";

// ================= DATABASE =================

if (!fs.existsSync(DB_PATH)) {

    fs.writeFileSync(DB_PATH, JSON.stringify({
        grupos: {},
        vips: {},
        passes: {}
    }, null, 2));
}

const getDB = () =>
    JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

const saveDB = (db) =>
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

// ================= TEMAS =================

const TEMAS = {

    kratos: {

        nome: "KRATOS",
        emoji: "⚔️",
        foto: "./kratos.jpg",

        vipMsg: "🛡️ VIP KRATOS",

        tabelaVip:
`🛡️ *PLANOS KRATOS*

🔥 VIP SEMANAL: R$10
🔥 VIP MENSAL: R$25

📞 wa.me/${CONTATO_COMPRA}`,

        menu:
`⚔️ *KRATOS STORE*

🔥 /like [id]
🎟️ /pass [id]
👑 /vip
💰 /saldo
🚫 /ban
🎨 /tema
📋 /menu`
    },

    princesa: {

        nome: "PRINCESA",
        emoji: "👑",
        foto: "./princesa.jpg",

        vipMsg: "🌸 VIP PRINCESA",

        tabelaVip:
`👑 *PLANOS PRINCESA*

💎 VIP SEMANAL: R$12
💎 VIP MENSAL: R$30

📞 wa.me/${CONTATO_COMPRA}`,

        menu:
`👑 *PRINCESA STORE*

🔥 /like [id]
🎟️ /pass [id]
👑 /vip
💰 /saldo
🚫 /ban
🎨 /tema
📋 /menu`
    },

    zxguild: {

        nome: "ZXGUILD",
        emoji: "⚡",
        foto: "./logo.jpg",

        vipMsg: "🔥 VIP ZXGUILD",

        tabelaVip:
`⚡ *PLANOS ZXGUILD*

💥 VIP SEMANAL: R$15
💥 VIP MENSAL: R$35

📞 wa.me/${CONTATO_COMPRA}`,

        menu:
`⚡ *ZXGUILD STORE*

🔥 /like [id]
🎟️ /pass [id]
👑 /vip
💰 /saldo
🚫 /ban
🎨 /tema
📋 /menu`
    }
};

// ================= START =================

async function startBot() {

    const { state, saveCreds } =
        await useMultiFileAuthState('auth');

    const { version } =
        await fetchLatestBaileysVersion();

    const sock = makeWASocket({

        auth: state,
        version,

        logger: P({
            level: 'silent'
        }),

        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    // ================= PAIR CODE =================

    if (!sock.authState.creds.registered) {

        console.log(`📲 Gerando código para ${NUMERO_CONEXAO}`);

        setTimeout(async () => {

            try {

                let code =
                    await sock.requestPairingCode(NUMERO_CONEXAO);

                code =
                    code?.match(/.{1,4}/g)?.join("-") || code;

                console.log(`
╔══════════════════╗
║   CÓDIGO LOGIN   ║
╚══════════════════╝

🔗 ${code}
`);

            } catch {

                console.log("❌ Erro ao gerar código.");
            }

        }, 5000);
    }

    // ================= CREDS =================

    sock.ev.on('creds.update', saveCreds);

    // ================= CONNECTION =================

    sock.ev.on('connection.update', async (update) => {

        const {
            connection,
            lastDisconnect
        } = update;

        if (connection === 'open') {

            console.log(`✅ ${NomeDoBot} ONLINE`);
        }

        if (connection === 'close') {

            console.log("⚠️ Conexão encerrada.");

            const shouldReconnect =
                (lastDisconnect?.error instanceof Boom)
                    ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                    : true;

            if (shouldReconnect) {
                startBot();
            }
        }
    });

    // ================= MESSAGES =================

    sock.ev.on('messages.upsert', async ({ messages }) => {

        try {

            const msg = messages[0];

            if (!msg.message) return;
            if (msg.key.fromMe) return;

            const from = msg.key.remoteJid;

            const isGroup =
                from.endsWith('@g.us');

            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                '';

            if (!body.startsWith('/')) return;

            const args =
                body.slice(1).trim().split(/ +/);

            const cmd =
                args.shift().toLowerCase();

            const q =
                args.join(' ');

            const sender =
                (isGroup
                    ? msg.key.participant
                    : from
                ).replace(/[^0-9]/g, '');

            const isDono =
                DONOS.includes(sender);

            const db = getDB();

            // ================= GRUPOS =================

            if (isGroup && !db.grupos[from]) {

                db.grupos[from] = {
                    tema: 'kratos',
                    modo: 'privado'
                };

                saveDB(db);
            }

            const temaNome =
                isGroup
                    ? (db.grupos[from]?.tema || 'kratos')
                    : 'kratos';

            const tema = TEMAS[temaNome];

            // ================= REPLY =================

            const reply = async (txt) => {

                const mentions =
                    txt.match(/@(\d+)/g)?.map(
                        v =>
                            v.replace('@', '') +
                            '@s.whatsapp.net'
                    ) || [];

                await sock.sendMessage(from, {

                    text: txt,
                    mentions

                }, {
                    quoted: msg
                });
            };

            // ================= GET TARGET =================

            const getTarget = () => {

                const mentioned =
                    msg.message.extendedTextMessage
                        ?.contextInfo
                        ?.mentionedJid?.[0];

                if (mentioned) {
                    return mentioned.replace(/[^0-9]/g, '');
                }

                if (args[0]) {
                    return args[0].replace(/[^0-9]/g, '');
                }

                return null;
            };

            // ================= SWITCH =================

            switch (cmd) {

                // ================= MENU =================

                case 'menu': {

                    const adm =
                        isDono
                            ?
`

👑 *ADMIN*

/addvip
/delvip
/vips
/addpass
/publico
/privado
/info`
                            : '';

                    if (fs.existsSync(tema.foto)) {

                        await sock.sendMessage(from, {

                            image: fs.readFileSync(tema.foto),

                            caption:
`${tema.menu}
${adm}`

                        }, {
                            quoted: msg
                        });

                    } else {

                        reply(`${tema.menu}${adm}`);
                    }

                    break;
                }

                // ================= SALDO =================

                case 'saldo': {

                    const passes =
                        db.passes[sender] || 0;

                    const vip =
                        db.vips[sender];

                    reply(
`💰 *SEU SALDO*

🎟️ Passes:
${passes}

👑 VIP:
${vip ? 'ATIVO' : 'NÃO POSSUI'}

${vip ? `🔥 IDs restantes:\n${vip.ids_restantes}` : ''}`
                    );

                    break;
                }

                // ================= BAN =================

                case 'ban': {

                    if (!isGroup)
                        return reply("❌ Apenas em grupos.");

                    const groupData =
                        await sock.groupMetadata(from);

                    const admins =
                        groupData.participants
                            .filter(p => p.admin)
                            .map(p =>
                                p.id.replace(/[^0-9]/g, '')
                            );

                    const isAdmin =
                        admins.includes(sender);

                    if (!isAdmin)
                        return reply("🚫 Apenas ADMs podem usar.");

                    const target =
                        getTarget();

                    if (!target)
                        return reply(
                            "❌ Marque alguém."
                        );

                    if (admins.includes(target))
                        return reply(
                            "🚫 Não pode remover ADM."
                        );

                    try {

                        await sock.groupParticipantsUpdate(
                            from,
                            [`${target}@s.whatsapp.net`],
                            'remove'
                        );

                        reply(
`🚫 MEMBRO REMOVIDO

👤 @${target}`
                        );

                    } catch {

                        reply(
                            "❌ Não consegui remover."
                        );
                    }

                    break;
                }

                // ================= VIP =================

                case 'vip': {

                    if (isDono) {

                        return reply(
`👑 *DONO DETECTADO*

♾️ Acesso infinito`
                        );
                    }

                    const vip =
                        db.vips[sender];

                    if (!vip) {

                        return reply(
                            tema.tabelaVip
                        );
                    }

                    reply(
`${tema.vipMsg}

🔥 IDs restantes:
${vip.ids_restantes}`
                    );

                    break;
                }

                // ================= ADDVIP =================

                case 'addvip': {

                    if (!isDono)
                        return reply("🚫 Sem permissão.");

                    const target =
                        getTarget();

                    const qtd =
                        Number(args[1]) || 10;

                    if (!target)
                        return reply("❌ Informe alguém.");

                    db.vips[target] = {
                        ids_restantes: qtd
                    };

                    saveDB(db);

                    reply(
`✅ VIP ADICIONADO

👤 @${target}

🔥 Quantidade:
${qtd}`
                    );

                    break;
                }

                // ================= DELVIP =================

                case 'delvip': {

                    if (!isDono)
                        return reply("🚫 Sem permissão.");

                    const target =
                        getTarget();

                    if (!target)
                        return reply("❌ Informe alguém.");

                    delete db.vips[target];

                    saveDB(db);

                    reply(
`🗑️ VIP REMOVIDO

👤 @${target}`
                    );

                    break;
                }

                // ================= ADDPASS =================

                case 'addpass': {

                    if (!isDono)
                        return reply("🚫 Sem permissão.");

                    const target =
                        getTarget();

                    const qtd =
                        Number(args[1]) || 1;

                    if (!target)
                        return reply("❌ Informe alguém.");

                    db.passes[target] =
                        (db.passes[target] || 0) + qtd;

                    saveDB(db);

                    reply(
`✅ PASS ADICIONADO

👤 @${target}

🎟️ Quantidade:
${qtd}

🎟️ Total:
${db.passes[target]}`
                    );

                    break;
                }

            }

        } catch (err) {

            console.log(err);

        }

    });

}

startBot();
