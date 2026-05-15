require('dotenv').config()
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const P = require('pino')
const fs = require('fs')
const axios = require('axios')

// ================= CONFIGURAÇÕES =================
const DB_PATH = './database.json'
const NomeDoBot = 'KRATOS-STORE'
const NUMERO_CONEXAO = '556993543234' 
const DONOS = ['556993543234', '5551995588124', '44930357551239', '25701671538894']

const API_URL_LIKE = 'https://likesff.online/api/LIKE?key=LIKESFF-KLFF-KRATOSLIKESEPASSES&id='
const API_CHECK = 'https://likesff-info.squareweb.app/check_basic?id='

const TEMAS = {
    kratos: { nome: 'KRATOS', emoji: '⚔️', foto: './kratos.jpg' },
    princesa: { nome: 'PRINCESA', emoji: '👑', foto: './princesa.jpg' },
    zxguild: { nome: 'ZXGUILD', emoji: '⚡', foto: './logo.jpg' }
}

// ================= DATABASE =================
const getDB = () => {
    const initial = { grupos: {}, vips: {}, passes: {} }
    try {
        return fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) : initial
    } catch { return initial }
}
const saveDB = (db) => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))

// ================= BOT CORE =================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        auth: state,
        version,
        logger: P({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Identificação estável
        printQRInTerminal: true
    })

    // Solicitação de Código de Pareamento
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(NUMERO_CONEXAO)
                code = code?.match(/.{1,4}/g)?.join('-') || code
                console.log(`\n====================================`)
                console.log(`🔥 SEU CÓDIGO DE CONEXÃO: ${code}`)
                console.log(`====================================\n`)
            } catch (err) { console.log('Erro ao gerar código:', err) }
        }, 6000)
    }

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'open') console.log(`✅ ${NomeDoBot} CONECTADO COM SUCESSO!`)
        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 0
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 5000)
            }
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0]
            if (!msg.message || msg.key.fromMe) return

            const from = msg.key.remoteJid
            const isGroup = from.endsWith('@g.us')
            const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim()
            
            if (!body.startsWith('/')) return

            const args = body.slice(1).split(/ +/)
            const cmd = args.shift().toLowerCase()
            const sender = (isGroup ? (msg.key.participant || from) : from).replace(/\D/g, '')
            
            const db = getDB()
            const isDono = DONOS.includes(sender)
            const isVip = isDono || (db.vips[sender] && db.vips[sender].ids > 0)

            // Configuração do Grupo
            if (isGroup && !db.grupos[from]) {
                db.grupos[from] = { tema: 'kratos', publico: true }
                saveDB(db)
            }
            const grupo = isGroup ? db.grupos[from] : { tema: 'kratos', publico: true }
            const T = TEMAS[grupo.tema] || TEMAS.kratos

            const reply = async (text) => {
                const mentions = text.match(/@(\d+)/g)?.map(v => v.replace('@', '') + '@s.whatsapp.net') || []
                await sock.sendMessage(from, { text, mentions }, { quoted: msg })
            }

// Comandos que funcionam para todos mesmo em grupo privado
const comandosLivres = ['menu', 'perfil', 'saldo', 'vip', 'check'];

if (isGroup && !grupo.publico && !isDono && !isVip) {
    // Se o comando digitado NÃO estiver na lista de livres, ele bloqueia
    if (!comandosLivres.includes(cmd)) {
        return reply("🔒 *COMANDO RESTRITO*\nApenas VIPs podem usar este comando em grupos privados.");
    }
}

            switch (cmd) {
                case 'menu': {
                    const menuStr = `${T.emoji} *${T.nome} STORE*\n\n🔥 /like [id]\n🎟️ /pass [id]\n🔍 /check [id]\n👤 /perfil\n💰 /saldo\n🎨 /tema\n🚫 /ban\n📋 /menu`
                    const adminStr = `\n\n👑 *ADMIN*\n/publico | /privado\n/addvip | /delvip\n/addpass | /info\n/vips\n/clearlist`
                    const finalMenu = isDono ? menuStr + adminStr : menuStr
                    if (fs.existsSync(T.foto)) {
                        await sock.sendMessage(from, { image: fs.readFileSync(T.foto), caption: finalMenu }, { quoted: msg })
                    } else { reply(finalMenu) }
                    break
                }

                case 'publico':
                    if (!isDono || !isGroup) return
                    db.grupos[from].publico = true; saveDB(db); reply('✅ Grupo PÚBLICO.')
                    break

                case 'privado':
                    if (!isDono || !isGroup) return
                    db.grupos[from].publico = false; saveDB(db); reply('🔒 Grupo PRIVADO.')
                    break

                case 'like': {
                    const idL = args[0]
                    if (!idL) return reply('❌ Informe o ID.')
                    if (!isDono && !isVip && (db.passes[sender] || 0) <= 0) return reply('❌ Sem saldo.')
                    reply('⏳ Processando...')
                    try {
                        const { data } = await axios.get(`${API_URL_LIKE}${idL}`)
                        let saldo = isDono ? "INFINITO" : (isVip ? db.vips[sender].ids - 1 : (db.passes[sender] || 0) - 1)
                        if (data.status === "success" && !isDono) {
                            if (isVip) db.vips[sender].ids-- 
                            else db.passes[sender]--
                            saveDB(db)
                        }
                        reply(`⚔️ *PAINEL LIKES*\n\n👤 Nick: ${data.nickname}\n🆔 ID: ${data.id}\n❤️ Ganhou: ${data.likes_added}\n🏆 Total: ${data.likes_end}\n📦 Saldo: ${saldo}\n📡 Status: ${data.message}`)
                    } catch { reply('❌ Erro na API.') }
                    break
                }

                case 'check': {
                    const idC = args[0]
                    if (!idC) return reply('❌ Informe o ID.')
                    try {
                        const { data } = await axios.get(`${API_CHECK}${idC}`)
                        reply(`⚔️ *PAINEL CONSULTA*\n\n👤 Nick: ${data.nickname}\n🆔 ID: ${data.id}\n📊 Nível: ${data.level}\n❤️ Likes: ${data.likes_end || data.likes_before}\n⏰ Login: ${data.login_end_formatted}`)
                    } catch { reply('❌ Erro.') }
                    break
                }

                case 'tema':
                    if (!isGroup) return
                    const choice = args[0]?.toLowerCase()
                    if (!TEMAS[choice]) return reply(`🎨 Opções: kratos, princesa, zxguild`)
                    db.grupos[from].tema = choice; saveDB(db); reply(`🎨 Tema: ${choice.toUpperCase()}`)
                    break

                case 'addvip':
                    if (!isDono) return
                    const uV = (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0] || '').replace(/\D/g, '')
                    db.vips[uV] = { ids: parseInt(args[1]) || 10 }
                    saveDB(db); reply(`⭐ VIP: @${uV}`)
                    break

                                case 'perfil': {
                    // Define o cargo do usuário para exibição
                    const cargo = isDono ? 'DONO 👑' : (isVip ? 'VIP ⭐' : 'USUÁRIO FREE 👤');
                    
                    // Pega o saldo de envios VIP (se não existir, é 0)
                    const saldoVip = isDono ? 'INFINITO' : (db.vips[sender]?.ids || 0);
                    
                    // Pega o saldo de passes unitários (se não existir, é 0)
                    const saldoPasses = db.passes[sender] || 0;

                    const textoPerfil = `👤 *SEU PERFIL - ${T.nome}* 👤\n\n` +
                                      `📞 *Contato:* @${sender}\n` +
                                      `🎖️ *Cargo:* ${cargo}\n\n` +
                                      `━━━━━━━━━━━━━━━\n\n` +
                                      `🔥 *Saldo VIP:* ${saldoVip}\n` +
                                      `🎟️ *Saldo Passes:* ${saldoPasses}\n\n` +
                                      `💡 _Use seu saldo para enviar likes ou fazer consultas via /like e /check._`;

                    // Envia o perfil apenas para quem usou o comando
                    reply(textoPerfil);
                    break;
                }


                case 'info': {
                    if (!isDono) return; 

                    const totalGrupos = Object.keys(db.grupos).length;
                    const totalVips = Object.keys(db.vips).length;
                    const modoAtual = isGroup ? (db.grupos[from].publico ? '🔓 PÚBLICO' : '🔒 PRIVADO') : 'N/A';

                    const textoInfo = `📊 *ESTATÍSTICAS DO SISTEMA*\n\n` +
                                     `⚔️ *Bot:* ${NomeDoBot}\n` +
                                     `👥 *Grupos Ativos:* ${totalGrupos}\n` +
                                     `👑 *Usuários VIP:* ${totalVips}\n\n` +
                                     `📍 *Este Grupo:*\n` +
                                     `🛠️ *Configuração:* ${modoAtual}\n` +
                                     `🎨 *Tema:* ${T.nome.toUpperCase()}\n\n` +
                                     `📡 *Status:* Online e Operante`;

                    reply(textoInfo);
                    break;
                } // <--- Esta chave fecha o bloco do INFO

                case 'vip': { // <--- Agora este CASE está dentro do switch
                    if (isVip || isDono) {
                        const statusVip = isDono ? 'DONO 👑' : 'CLIENTE ⭐';
                        const saldoVip = isDono ? 'INFINITO' : (db.vips[sender]?.ids || 0);

                        const txtVip = `🎟️ *STATUS - ${T.nome}*\n\n` +
                                     `👤 *Usuário:* @${sender.split('@')[0]}\n` +
                                     `📊 *Status:* ${statusVip}\n` +
                                     `🔥 *Envios Restantes:* ${saldoVip}\n\n` +
                                     `✅ Você ainda pode realizar ${saldoVip} envios de likes.`;
                        return reply(txtVip);
                    }

                    const tabelaPrecos = `⚔️ *RECARGAS DE LIKES - ${T.nome}* ⚔️\n\n` +
                                       `Adquira envios unitários para usar no bot agora mesmo!\n\n` +
                                       `🪙 *VALORES POR ENVIO:* \n\n` +
                                       `📌 *1 ENVIO UNITÁRIO*\n` +
                                       `• Valor: R$ 0,50\n\n` +
                                       `📌 *PACOTE 10 ENVIOS*\n` +
                                       `• Valor: R$ 4,00\n` +
                                       `• _(R$ 0,40 por envio)_\n\n` +
                                       `📌 *PACOTE 30 ENVIOS*\n` +
                                       `• Valor: R$ 10,00\n` +
                                       `• _(R$ 0,33 por envio)_\n\n` +
                                       `📌 *PACOTE 100 ENVIOS*\n` +
                                       `• Valor: R$ 25,00\n` +
                                       `• _(R$ 0,25 p/ envio)_\n\n` +
                                       `⚠️ *COMO RECARREGAR?*\n` +
                                       `📞 wa.me/5551995588124`;

                    if (fs.existsSync('./tabela.jpg')) {
                        await sock.sendMessage(from, {
                            image: fs.readFileSync('./tabela.jpg'),
                            caption: tabelaPrecos
                        }, { quoted: msg });
                    } else {
                        reply(tabelaPrecos);
                    }
                    break;
                }

                case 'clearlist': {
                    if (!isDono) return reply('❌ Apenas o dono pode resetar a lista.')
                    db.vips = {}
                    saveDB(db)
                    reply('⚠️ *LISTA VIP RESETADA!* ⚠️\nTodos os usuários VIP foram removidos.')
                    break
                }
            }
        } catch (e) {
            console.log(e)
        }
    })
}

startBot()
