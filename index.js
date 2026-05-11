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

const PREFIX = '/';
const DB_PATH = './database.json';

const NomeDoBot = 'KRATOS-STORE';
const CONTATO_COMPRA = '555195588124';
const NUMERO_CONEXAO = '556993543234';

const API_KEY_HUB = 'Kratosbotpasses123';
const API_URL_HUB = 'https://americanhub.com.br/api/v1/send-pass';

const LIKE_API =
'https://likesff.online/api/LIKE?key=LIKESFF-KLFF-KRATOSLIKESEPASSES&id=';

const DONOS = [
    '556993543234',
    '5551995588124',
    '25701671538894'
];

// ================= DATABASE =================

if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
        DB_PATH,
        JSON.stringify({
            grupos: {},
            vips: {},
            passes: {}
        }, null, 2)
    );
}

const getDB = () => {
    return JSON.parse(fs.readFileSync(DB_PATH));
};

const saveDB = (db) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
};

// ================= TEMAS =================

const TEMAS = {

    kratos: {
        nome: 'KRATOS',
        emoji: '⚔️',
        foto: './kratos.jpg',

        titulo: '🔥 LIKES ENVIADOS, GAROTO!',

        vipMsg:
`🛡️ *KRATOS VIP ATIVO*`,

        tabelaVip:
`🛡️ *PLANOS KRATOS STORE*

🔥 VIP SEMANAL: R$10
🔥 VIP MENSAL: R$25

📞 wa.me/${CONTATO_COMPRA}`,

        menu:
`🛡️ *KRATOS STORE*

⚔️ /like id
🔍 /check id
🎟️ /pass id
💰 /saldo
👑 /vip
🛒 /comprar
🤺 /vemx1`,

        loading: '⚔️ Processando...',
        sucesso: '🏆 Vitória.',
        erro: '💀 Erro.',
        negado: '🚫 Sem permissão.'
    },

    princesa: {
        nome: 'PRINCESA',
        emoji: '🎀',
        foto: './princesa.jpg',

        titulo: '✨ LIKES ENVIADOS!',

        vipMsg:
`👑 *PRINCESA VIP*`,

        tabelaVip:
`🎀 *VIP PRINCESA*

💖 SEMANAL: R$10
💖 MENSAL: R$25

📞 wa.me/${CONTATO_COMPRA}`,

        menu:
`🎀 *PRINCESA STORE*

💖 /like id
🔍 /check id
🎟️ /pass id
💰 /saldo
👑 /vip
🛒 /comprar
🤺 /vemx1`,

        loading: '✨ Enviando magia...',
        sucesso: '💖 Sucesso!',
        erro: '😢 Erro.',
        negado: '🚫 Apenas VIP.'
    },

    zxguild: {
        nome: 'ZX-GUILD',
        emoji: '☣️',
        foto: './logo.jpg',

        titulo: '☣️ PROTOCOLO EXECUTADO',

        vipMsg:
`🔐 *ACESSO VIP CONFIRMADO*`,

        tabelaVip:
`☣️ *ZX-GUILD ACCESS*

🔥 WEEK: R$10
🔥 MONTH: R$25

📞 wa.me/${CONTATO_COMPRA}`,

        menu:
`☣️ *ZX-GUILD SYSTEM*

🩸 /like id
🔍 /check id
🎟️ /pass id
💰 /saldo
👑 /vip
🛒 /comprar
🤺 /vemx1`,

        loading: '⚙️ Executando...',
        sucesso: '✅ Finalizado.',
        erro: '❌ Erro.',
        negado: '🔒 Restrito.'
    }
};

// ================= START BOT =================

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

        browser: [
            'Ubuntu',
            'Chrome',
            '20.0.04'
        ]
    });

    // ================= PAREAMENTO =================

    if (!sock.authState.creds.registered) {

        console.log(
            `📲 Gerando código para ${NUMERO_CONEXAO}`
        );

        setTimeout(async () => {

            try {

                let code =
                await sock.requestPairingCode(NUMERO_CONEXAO);

                code =
                code?.match(/.{1,4}/g)?.join('-') || code;

                console.log(
                    `\n🔗 CÓDIGO:\n${code}\n`
                );

            } catch (e) {
                console.log('❌ Erro no pairing.');
            }

        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);

    // ================= CONEXÃO =================

    sock.ev.on('connection.update', async (update) => {

        const {
            connection,
            lastDisconnect
        } = update;

        if (connection === 'open') {

            console.log(
                `✅ ${NomeDoBot} ONLINE`
            );
        }

        if (connection === 'close') {

            const shouldReconnect =
            (lastDisconnect.error instanceof Boom)?.output?.statusCode
            !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                startBot();
            }
        }
    });

    // ================= BOAS VINDAS =================

    sock.ev.on('group-participants.update', async (anu) => {

        try {

            if (anu.action !== 'add') return;

            const db = getDB();

            const temaNome =
            db.grupos[anu.id]?.tema || 'kratos';

            const tema = TEMAS[temaNome];

            const metadata =
            await sock.groupMetadata(anu.id);

            for (const jid of anu.participants) {

                const user =
                jid.split('@')[0];

                const texto =
`👋 Bem-vindo @${user}

🏛️ ${metadata.subject}

${tema.emoji} Tema atual:
${tema.nome}

📜 Use /menu`;

                if (fs.existsSync(tema.foto)) {

                    await sock.sendMessage(
                        anu.id,
                        {
                            image: {
                                url: tema.foto
                            },
                            caption: texto,
                            mentions: [jid]
                        }
                    );

                } else {

                    await sock.sendMessage(
                        anu.id,
                        {
                            text: texto,
                            mentions: [jid]
                        }
                    );
                }
            }

        } catch (e) {
            console.log(e);
        }
    });

    // ================= MENSAGENS =================

    sock.ev.on('messages.upsert', async ({ messages }) => {

        const msg = messages[0];

        if (!msg.message) return;
        if (msg.key.fromMe) return;

        const from = msg.key.remoteJid;

        const isGroup =
        from.endsWith('@g.us');

        const body =
        (
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            ''
        ).trim();

        if (!body.startsWith(PREFIX)) return;

        const args =
        body.slice(1).split(/ +/);

        const cmd =
        args.shift().toLowerCase();

        const q = args.join(' ');

        const sender =
        (
            isGroup
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

        const tema =
        TEMAS[temaNome];

        const reply = (txt) =>
        sock.sendMessage(
            from,
            { text: txt },
            { quoted: msg }
        );

        const getTarget = () => {

            let mencionado =
            msg.message.extendedTextMessage
            ?.contextInfo
            ?.mentionedJid?.[0];

            if (mencionado) {
                return mencionado.replace(/[^0-9]/g, '');
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
? `

👑 *OLIMPO*

/addvip
/delvip
/addpass
/settema
/publico
/privado
/vips
/info`
: '';

                if (fs.existsSync(tema.foto)) {

                    await sock.sendMessage(
                        from,
                        {
                            image: {
                                url: tema.foto
                            },
                            caption:
                            tema.menu + adm
                        },
                        {
                            quoted: msg
                        }
                    );

                } else {

                    reply(
                        tema.menu + adm
                    );
                }

            }
            break;

            // ================= CHECK =================

            case 'check': {

                if (!q)
                return reply('❌ Digite o ID.');

                try {

                    await reply(tema.loading);

                    const response =
                    await axios.get(
                        LIKE_API + q
                    );

                    const res =
                    response.data;

                    if (
                        res.status !== 'success'
                    ) {
                        return reply(
                            '❌ Jogador não encontrado.'
                        );
                    }

                    reply(
`🔍 *CONSULTA*

👤 Nick: ${res.nickname}
🆔 ID: ${res.id}

🌎 Região: ${res.region}
⭐ Nível: ${res.level}
✨ XP: ${res.xp}

❤️ Likes: ${res.likes_before}
📈 Após envio: ${res.likes_end}

📝 Bio:
${res.bio || 'Sem bio'}

⏰ Último login:
${res.login_end_formatted}`
                    );

                } catch (e) {

                    console.log(e);

                    reply(
                        '❌ Erro na consulta.'
                    );
                }
            }
            break;

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
                return reply('❌ Digite o ID.');

                try {

                    await reply(tema.loading);

                    const response =
                    await axios.get(
                        LIKE_API + q
                    );

                    const res =
                    response.data;

                    if (
                        res.status !== 'success'
                    ) {
                        return reply(
                            '❌ API OFFLINE.'
                        );
                    }

                    // ===== SUCESSO =====

                    if (
                        res.message === 'LIKES_SUCCESS'
                    ) {

                        if (
                            !isDono &&
                            db.vips[sender]
                        ) {

                            db.vips[sender]
                            .ids_restantes -= 1;

                            if (
                                db.vips[sender]
                                .ids_restantes <= 0
                            ) {
                                delete db.vips[sender];
                            }

                            saveDB(db);
                        }

                        return reply(
`${tema.emoji} ${tema.titulo}

👤 ${res.nickname}
🆔 ${res.id}

❤️ Antes: ${res.likes_before}
🔥 Enviados: ${res.likes_added}
📈 Agora: ${res.likes_end}

🌎 ${res.region}
⭐ Lv.${res.level}

🔑 ${res.key}
🎁 ${res.key_message}`
                        );
                    }

                    // ===== LIMITE =====

                    if (
                        res.message === 'LIKES_LIMIT'
                    ) {

                        return reply(
`⚠️ LIMITE ATINGIDO

👤 ${res.nickname}
🆔 ${res.id}

❤️ Likes atuais:
${res.likes_before}

⏰ Aguarde reset diário.`
                        );
                    }

                    reply('❌ Não foi possível.');

                } catch (e) {

                    console.log(e);

                    reply(tema.erro);
                }
            }
            break;

            // ================= PASS =================

            case 'pass': {

                if (
                    !isDono &&
                    (db.passes[sender] || 0) <= 0
                ) {
                    return reply(
                        '🚫 Sem passes.'
                    );
                }

                if (!q)
                return reply('❌ Digite o ID.');

                try {

                    await reply(tema.loading);

                    const res =
                    await axios.post(
                        API_URL_HUB,
                        {
                            key: API_KEY_HUB,
                            uid: q,
                            mensagem: NomeDoBot
                        }
                    );

                    if (res.status === 200) {

                        if (!isDono) {

                            db.passes[sender] -= 1;

                            saveDB(db);
                        }

                        reply(
`🎟️ PASSES ENVIADOS

👤 ${res.data.Nickname}

💰 Saldo:
${isDono ? '∞' : db.passes[sender]}`
                        );
                    }

                } catch (e) {

                    console.log(e);

                    reply(
                        '❌ Falha no envio.'
                    );
                }
            }
            break;

            // ================= VIP =================

            case 'vip': {

                if (isDono) {
                    return reply(
                        '👑 DONO'
                    );
                }

                const userVip =
                db.vips[sender];

                if (!userVip) {
                    return reply(
                        tema.tabelaVip
                    );
                }

                reply(
`${tema.vipMsg}

🔥 Restantes:
${userVip.ids_restantes}`
                );
            }
            break;

            // ================= SALDO =================

            case 'saldo': {

                reply(
`🎟️ SALDO

${db.passes[sender] || 0} passes`
                );
            }
            break;

            // ================= COMPRAR =================

            case 'comprar': {

                reply(
`🛒 TABELA

🔥 LIKE = R$0,25
🎟️ PASSE = R$7

📞 wa.me/${CONTATO_COMPRA}`
                );
            }
            break;

            // ================= VEM X1 =================
case 'vemx1': {
    if (!isGroup) return reply('❌ Apenas em grupos.');

    try {
        const metadata = await sock.groupMetadata(from);
        
        // Garante que o sender seja o JID completo (ex: 551199999999@s.whatsapp.net)
        const senderJid = sender.includes('@') ? sender : `${sender}@s.whatsapp.net`;
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        // Filtra membros (exclui o bot e quem enviou o comando)
        const membros = metadata.participants.filter(p => {
            const jid = p.id || p.jid;
            return jid !== senderJid && jid !== botNumber;
        });

        if (membros.length < 1) return reply('❌ Não há membros suficientes para um desafio.');

        // Escolhe o oponente
        const escolhido = membros[Math.floor(Math.random() * membros.length)];
        const alvoJid = escolhido.id || escolhido.jid;

        // Monta o texto
        // O WhatsApp transforma o @número automaticamente no nome do contato
        const textoX1 = `⚔️ *DESAFIO DE X1* ⚔️\n\n@${senderJid.split('@')[0]} desafiou @${alvoJid.split('@')[0]} para uma batalha real! 🔥`;

        await sock.sendMessage(from, {
            text: textoX1,
            mentions: [senderJid, alvoJid] // Ambos IDs completos aqui
        }, { quoted: msg });

    } catch (e) {
        console.error(e);
        reply('❌ Erro ao iniciar X1. Certifique-se de que o bot está no grupo.');
    }
}
break;


            // ================= SETTEMA =================

            case 'settema': {

                if (!isDono)
                return reply(tema.negado);

                const novo =
                q.toLowerCase();

                if (!TEMAS[novo]) {

                    return reply(
                        '⚠️ Temas:\nkratos\nprincesa\nzxguild'
                    );
                }

                if (!db.grupos[from]) {
                    db.grupos[from] = {};
                }

                db.grupos[from].tema =
                novo;

                saveDB(db);

                reply(
                    `✅ Tema alterado para ${novo}`
                );
            }
            break;

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
                    '🔓 Grupo público.'
                );
            }
            break;

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
                    '🔒 Apenas VIP.'
                );
            }
            break;

            // ================= ADDVIP =================

            case 'addvip': {

                if (!isDono)
                return reply(tema.negado);

                const alvo =
                getTarget();

                const qtd =
                Number(args[1]);

                if (!alvo || isNaN(qtd)) {

                    return reply(
                        '❌ /addvip @user 10'
                    );
                }

                db.vips[alvo] = {
                    ids_restantes: qtd
                };

                saveDB(db);

                reply(
                    `✅ VIP adicionado para ${alvo}`
                );
            }
            break;

            // ================= DELVIP =================

            case 'delvip': {

                if (!isDono)
                return reply(tema.negado);

                const alvo =
                getTarget();

                if (!alvo) {
                    return reply(
                        '❌ Marque alguém.'
                    );
                }

                delete db.vips[alvo];

                saveDB(db);

                reply(
                    `✅ VIP removido.`
                );
            }
            break;

            // ================= ADDPASS =================

            case 'addpass': {

                if (!isDono)
                return reply(tema.negado);

                const alvo =
                getTarget();

                const qtd =
                Number(args[1]);

                if (!alvo || isNaN(qtd)) {

                    return reply(
                        '❌ /addpass @user 10'
                    );
                }

                db.passes[alvo] =
                (db.passes[alvo] || 0) + qtd;

                saveDB(db);

                reply(
                    `✅ ${qtd} passes adicionados.`
                );
            }
            break;

            // ================= VIPS =================

            case 'vips': {

                if (!isDono)
                return reply(tema.negado);

                const lista =
                Object.entries(db.vips);

                if (lista.length <= 0) {
                    return reply(
                        '❌ Sem VIPS.'
                    );
                }

                let texto =
                '👑 LISTA VIPS\n\n';

                for (const [num, dados] of lista) {

                    texto +=
`📞 ${num}
🔥 ${dados.ids_restantes}

`;
                }

                reply(texto);
            }
            break;

            // ================= INFO =================

            case 'info': {

                reply(
`🤖 ${NomeDoBot}

👑 Donos:
${DONOS.length}

👥 VIPS:
${Object.keys(db.vips).length}

🎟️ Usuários com passes:
${Object.keys(db.passes).length}`
                );
            }
            break;
        }
    });
}

startBot();
