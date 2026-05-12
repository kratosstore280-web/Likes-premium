require('dotenv').config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    delay
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

    // ================= KRATOS =================

    kratos: {

        nome: "KRATOS",
        emoji: "⚔️",
        foto: "./kratos.jpg",

        titulo: "🔥 KRATOS STORE",
        vipMsg: "🛡️ *VIP KRATOS ATIVO*",

        tabelaVip:
`🛡️ *PLANOS KRATOS STORE*

🔥 VIP SEMANAL: R$ 10
🔥 VIP MENSAL: R$ 25

📞 Comprar:
wa.me/${CONTATO_COMPRA}`,

        menu:
`🛡️ *KRATOS STORE*

🔥 /like [id]
🎟️ /pass [id]
🔍 /check [id]
👑 /vip
💰 /saldo
🛒 /comprar
🎨 /tema
📋 /menu`,

        loading: "⚔️ Processando...",
        erro: "❌ Erro no sistema.",
        negado: "🚫 Sem permissão."
    },

    // ================= PRINCESA =================

    princesa: {

        nome: "PRINCESA",
        emoji: "👑",
        foto: "./princesa.jpg",

        titulo: "💖 PRINCESA STORE",
        vipMsg: "🌸 *VIP PRINCESA ATIVO*",

        tabelaVip:
`👑 *PLANOS PRINCESA STORE*

💎 VIP SEMANAL: R$ 12
💎 VIP MENSAL: R$ 30

📞 Comprar:
wa.me/${CONTATO_COMPRA}`,

        menu:
`👑 *PRINCESA STORE*

💖 /like [id]
🎟️ /pass [id]
🔍 /check [id]
👑 /vip
💰 /saldo
🛒 /comprar
🎨 /tema
📋 /menu`,

        loading: "🌸 Processando...",
        erro: "❌ Erro no sistema.",
        negado: "🚫 Sem permissão."
    },

    // ================= ZXGUILD =================

    zxguild: {

        nome: "ZXGUILD",
        emoji: "⚡",
        foto: "./logo.jpg",

        titulo: "⚡ ZXGUILD STORE",
        vipMsg: "🔥 *VIP ZXGUILD ATIVO*",

        tabelaVip:
`⚡ *PLANOS ZXGUILD*

💥 VIP SEMANAL: R$ 15
💥 VIP MENSAL: R$ 35

📞 Comprar:
wa.me/${CONTATO_COMPRA}`,

        menu:
`⚡ *ZXGUILD STORE*

🔥 /like [id]
🎟️ /pass [id]
🔍 /check [id]
👑 /vip
💰 /saldo
🛒 /comprar
🎨 /tema
📋 /menu`,

        loading: "⚡ Processando...",
        erro: "❌ Erro no sistema.",
        negado: "🚫 Sem permissão."
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

        browser: ["Ubuntu", "Chrome", "20.0.04"],

        printQRInTerminal: false
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
║  CÓDIGO GERADO   ║
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

            // ================= PEGAR ALVO =================

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

            // ================= COMANDOS =================

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
/info
/publico
/privado
`
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

                // ================= INFO =================

                case 'info': {

                    if (!isDono)
                        return reply(tema.negado);

                    reply(
`📊 *INFO BOT*

🤖 Nome:
${NomeDoBot}

👥 VIPs:
${Object.keys(db.vips).length}

🎟️ Passes:
${Object.keys(db.passes).length}

🏠 Grupos:
${Object.keys(db.grupos).length}`
                    );

                    break;
                }

                // ================= TEMA =================

                case 'tema': {

                    if (!isGroup)
                        return reply("❌ Apenas em grupos.");

                    if (!isDono)
                        return reply(tema.negado);

                    const temaNovo =
                        q.toLowerCase();

                    if (!TEMAS[temaNovo]) {

                        return reply(
`❌ Tema inexistente.

🎨 Temas disponíveis:
• kratos
• princesa
• zxguild`
                        );
                    }

                    if (!db.grupos[from]) {
                        db.grupos[from] = {};
                    }

                    db.grupos[from].tema =
                        temaNovo;

                    saveDB(db);

                    reply(
`✅ Tema alterado para:

🎨 ${TEMAS[temaNovo].nome}`
                    );

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
                        return reply(tema.negado);

                    const target =
                        getTarget();

                    const qtd =
                        Number(args[1]) || 10;

                    if (!target)
                        return reply("❌ Informe o número.");

                    db.vips[target] = {
                        ids_restantes: qtd
                    };

                    saveDB(db);

                    reply(
`✅ VIP adicionado

👤 @${target}

🔥 Quantidade:
${qtd}`
                    );

                    break;
                }

                // ================= DELVIP =================

                case 'delvip': {

                    if (!isDono)
                        return reply(tema.negado);

                    const target =
                        getTarget();

                    if (!target)
                        return reply("❌ Informe alguém.");

                    if (!db.vips[target]) {
                        return reply("❌ Não é VIP.");
                    }

                    delete db.vips[target];

                    saveDB(db);

                    reply(
`🗑️ VIP removido

👤 @${target}`
                    );

                    break;
                }

                // ================= VIPS =================

                case 'vips': {

                    if (!isDono)
                        return reply(tema.negado);

                    let txt =
`📋 *LISTA VIPS*

`;

                    const lista =
                        Object.keys(db.vips);

                    if (lista.length < 1) {
                        return reply("❌ Nenhum VIP.");
                    }

                    for (const numero of lista) {

                        txt +=
`👤 @${numero}
🔥 Restante: ${db.vips[numero].ids_restantes}

`;
                    }

                    reply(txt);

                    break;
                }

                // ================= LIKE =================

                case 'like': {

                    const modoGrp =
                        db.grupos[from]?.modo || 'privado';

                    if (
                        modoGrp === 'privado' &&
                        !isDono &&
                        !db.vips[sender]
                    ) {

                        return reply(tema.negado);
                    }

                    if (!q)
                        return reply("❌ Digite o ID.");

                    try {

                        await reply(tema.loading);

                        const res =
                            await axios.get(
`https://likesff.online/api/LIKE?key=LIKESFF-KLFF-KRATOSLIKESEPASSES&id=`
                            );

                        const data = res.data;

                        if (
                            data.status === "success" &&
                            data.likes_added > 0 &&
                            !isDono &&
                            db.vips[sender]
                        ) {

                            db.vips[sender].ids_restantes -= 1;

                            if (
                                db.vips[sender].ids_restantes <= 0
                            ) {

                                delete db.vips[sender];
                            }

                            saveDB(db);
                        }

                        reply(
`${tema.emoji} *STATUS COMPLETO*

👤 Nick:
${data.nickname}

🆔 ID:
${data.id}

🌎 Região:
${data.region}

📊 Nível:
${data.level}

✨ XP:
${data.xp}

❤️ Likes antes:
${data.likes_before}

🔥 Likes enviados:
${data.likes_added}

❤️ Likes agora:
${data.likes_end}

🕒 Último login:
${data.login_end_formatted}`
                        );

                    } catch (e) {

                        console.log(e.response?.data || e);

                        reply("❌ Erro ao enviar likes.");
                    }

                    break;
                }

                // ================= PASS =================

                case 'pass': {

                    if (
                        !isDono &&
                        (
                            !db.passes[sender] ||
                            db.passes[sender] <= 0
                        )
                    ) {

                        return reply(
                            "🚫 Você não possui passes."
                        );
                    }

                    if (!q)
                        return reply("❌ Digite o ID.");

                    try {

                        await reply(tema.loading);

                        const res =
                            await axios.post(API_URL_HUB, {

                                key: API_KEY_HUB,
                                uid: q,
                                mensagem: "Kratos Store",
                                type: "admin"
                            });

                        if (res.status === 200) {

                            if (!isDono) {

                                db.passes[sender] -= 1;

                                saveDB(db);
                            }

                            reply(
`🎟️ *PASS ENVIADO*

👤 Nick:
${res.data.Nickname || "Desconhecido"}

🆔 ID:
${q}

🎟️ Restante:
${isDono ? '∞' : db.passes[sender]}`
                            );
                        }

                    } catch (e) {

                        console.log(
                            e.response?.data || e
                        );

                        reply(
                            "❌ Erro ao enviar passe."
                        );
                    }

                    break;
                }

                // ================= ADDPASS =================

                case 'addpass': {

                    if (!isDono)
                        return reply(tema.negado);

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
`✅ Passes adicionados

👤 @${target}

🎟️ Quantidade:
${qtd}`
                    );

                    break;
                }

                // ================= SALDO =================

                case 'saldo': {

                    const saldo =
                        db.passes[sender] || 0;

                    reply(
`🎟️ *SEU SALDO*

${isDono
? '♾️ INFINITO'
: saldo + ' passes'}`
                    );

                    break;
                }

                // ================= PUBLICO =================

                case 'publico': {

                    if (!isDono)
                        return reply(tema.negado);

                    if (!db.grupos[from]) {
                        db.grupos[from] = {};
                    }

                    db.grupos[from].modo =
                        'publico';

                    saveDB(db);

                    reply(
                        "🔓 Grupo liberado."
                    );

                    break;
                }

                // ================= PRIVADO =================

                case 'privado': {

                    if (!isDono)
                        return reply(tema.negado);

                    if (!db.grupos[from]) {
                        db.grupos[from] = {};
                    }

                    db.grupos[from].modo =
                        'privado';

                    saveDB(db);

                    reply(
                        "🔒 Apenas VIPs agora."
                    );

                    break;
                }

                // ================= CHECK =================

                case 'check': {

                    if (!q)
                        return reply(
                            "❌ Digite o ID."
                        );

                    try {

                        await reply(
                            tema.loading
                        );

                        const res =
                            await axios.get(
`https://likesff-info.squareweb.app/check_basic?id=${q}`
                            );

                        reply(
`🔍 *INFO JOGADOR*

👤 Nick:
${res.data.nickname}

🆔 ID:
${q}

📊 Nível:
${res.data.level}

🌎 Região:
${res.data.region}`
                        );

                    } catch {

                        reply(
                            "❌ ID inválido."
                        );
                    }

                    break;
                }

                // ================= COMPRAR =================

                case 'comprar': {

                    reply(
`🛒 *TABELA KRATOS STORE*

🔥 LIKE:
R$ 0,25

🎟️ PASS:
R$ 7,00

📞 Comprar:
wa.me/${CONTATO_COMPRA}`
                    );

                    break;
                }

                // ================= DEFAULT =================

                default: {

                    reply(
                        "❌ Comando inexistente."
                    );
                }
            }

        } catch (e) {

            console.log(e);
        }
    });
}

startBot();
