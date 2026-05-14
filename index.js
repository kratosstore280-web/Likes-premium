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

                // ================= INFO =================

                case 'info': {

                    if (!isDono)
                        return reply("🚫 Sem permissão.");

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
                        return reply("❌ Informe o número.");

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

                // ================= VIPS =================

                case 'vips': {

                    if (!isDono)
                        return reply("🚫 Sem permissão.");

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

                // ================= PUBLICO =================

                case 'publico': {

                    if (!isGroup)
                        return reply("❌ Apenas em grupos.");

                    if (!isDono)
                        return reply("🚫 Sem permissão.");

                    db.grupos[from].modo = 'publico';

                    saveDB(db);

                    reply(
`✅ MODO ALTERADO

🌍 Grupo agora está:
PUBLICO

🔥 Todos podem usar /like`
                    );

                    break;
                }

                // ================= PRIVADO =================

                case 'privado': {

                    if (!isGroup)
                        return reply("❌ Apenas em grupos.");

                    if (!isDono)
                        return reply("🚫 Sem permissão.");

                    db.grupos[from].modo = 'privado';

                    saveDB(db);

                    reply(
`✅ MODO ALTERADO

🔒 Grupo agora está:
PRIVADO

👑 Apenas VIPs usam /like`
                    );

                    break;
                }

                // ================= TEMA =================

                case 'tema': {

                    if (!isGroup)
                        return reply("❌ Apenas em grupos.");

                    if (!isDono)
                        return reply("🚫 Sem permissão.");

                    const temaNovo =
                        q.toLowerCase();

                    if (!TEMAS[temaNovo]) {

                        return reply(
`❌ Tema inexistente.

🎨 Disponíveis:
• kratos
• princesa
• zxguild`
                        );
                    }

                    db.grupos[from].tema =
                        temaNovo;

                    saveDB(db);

                    reply(
`✅ Tema alterado:

🎨 ${TEMAS[temaNovo].nome}`
                    );

                    break;
                }

                // ================= LIKE =================

// ================= LIKE =================

case 'like': {

    const modoGrp =
        db.grupos[from]?.modo || 'privado';

    if (
        modoGrp === 'privado' &&
        !isDono &&
        !db.vips[sender]
    ) {

        return reply(
`🚫 ESTE GRUPO ESTÁ EM MODO VIP

👑 Apenas VIPs podem usar:
/like

💎 Use:
/vip`
        );
    }

    if (!q) {

        return reply(
`❌ Use corretamente:

/like 123456789`
        );
    }

    try {

        await reply("⏳ Puxando informações da conta...");

        // ================= API LIKE =================

        const likesRes =
            await axios.get(
                `https://likesff.online/api/LIKE?key=LIKESFF-KLFF-KRATOSLIKESEPASSES&id=${q}`
            );

        const likesData =
            likesRes.data;

        // ================= API PROFILE =================

        let perfil = {};

        try {

            const perfilRes =
                await axios.get(
                    `https://ff-info-api.vercel.app/profile?uid=${q}&region=br`
                );

            perfil =
                perfilRes.data || {};

        } catch {}

        // ================= DADOS =================

        const acc =
            perfil.AccountInfo || {};

        const social =
            perfil.socialinfo || {};

        const guild =
            perfil.GuildInfo || {};

        const pet =
            perfil.petInfo || {};

        // ================= STATUS =================

        let statusLikes = "✅ Likes enviados com sucesso";

        if (
            likesData.message === "LIKES_LIMIT"
        ) {

            statusLikes =
                "⚠️ Conta atingiu limite diário";
        }

        // ================= TAXA =================

        const enviados =
            Number(likesData.likes_added || 0);

        const falhados =
            Number(likesData.likes_failed || 0);

        const total =
            enviados + falhados;

        const taxa =
            total > 0
                ? ((enviados / total) * 100).toFixed(1)
                : "0";

        // ================= REMOVE VIP =================

        if (
            modoGrp === 'privado' &&
            likesData.status === "success" &&
            enviados >= 100 &&
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

        // ================= RESPOSTA =================

        reply(
`${tema.emoji} *PAINEL FREE FIRE*

👤 Nick:
${likesData.nickname || acc.AccountName || 'Desconhecido'}

🆔 UID:
${likesData.id || q}

🌎 Região:
${likesData.region || acc.AccountRegion || 'BR'}

📊 Nível:
${likesData.level || acc.AccountLevel || '0'}

⭐ XP:
${likesData.xp || '0'}

📝 Bio:
${likesData.bio || social.AccountSignature || 'Sem bio'}

━━━━━━━━━━━━━━━

❤️ Likes antes:
${likesData.likes_before || '0'}

🔥 Likes enviados:
${likesData.likes_added || '0'}

❌ Likes falhados:
${likesData.likes_failed || '0'}

❤️ Likes atuais:
${likesData.likes_end || '0'}

📈 Taxa sucesso:
${taxa}%

━━━━━━━━━━━━━━━

🏰 Guilda:
${guild.GuildName || 'Sem guilda'}

🐾 Pet:
${pet.name || 'Nenhum'}

━━━━━━━━━━━━━━━

⏰ Último login:
${likesData.login_end_formatted || 'Não encontrado'}

🕰️ Primeira vez online:
${likesData.login_primary_formatted || 'Não encontrado'}

━━━━━━━━━━━━━━━

🔑 Key:
${likesData.key || '0/0'}

📦 Keys restantes:
${likesData.key_remaining || '0'}

📥 Key adicionada:
${likesData.key_added ? 'SIM' : 'NÃO'}

📢 Status:
${likesData.key_message || 'Sem status'}

🎯 Likes mínimos:
${likesData.likes_required || '0'}

━━━━━━━━━━━━━━━

📡 Resultado:
${statusLikes}

🔐 Modo:
${modoGrp.toUpperCase()}`
        );

    } catch (e) {

        console.log(
            e.response?.data || e
        );

        reply(
`❌ ERRO AO PUXAR CONTA

• ID inválido
• API offline
• Região incorreta
• Conta inexistente`
        );
    }

    break;
}                // ================= PASS =================

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

                        await reply("⏳ Enviando passe...");

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
`🎟️ PASS ENVIADO

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
