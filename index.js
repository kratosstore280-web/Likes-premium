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
const NUMERO_CONEXAO = '556993543234' 
const NomeDoBot = 'KRATOS-STORE'

const API_URL_LIKE = 'https://likesff.online/api/LIKE?key=LIKESFF-KLFF-KRATOSLIKESEPASSES&id='
const API_CHECK = 'https://likesff-info.squareweb.app/check_basic?id='
const API_URL_PASS = 'https://americanhub.com.br/api/v1/send-pass'
const API_KEY_PASS = 'Kratosbotpasses123'

const DONOS = ['556993543234', '5551995588124', '44930357551239', '25701671538894']

// ================= DATABASE (SISTEMA ANTI-ERRO) =================
const initialDB = {
    grupos: {},
    vips: {},
    passes: {},
    config: { publico: true },
    stats: { likes_sent: 0, likes_failed: 0 }
}

const getDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2))
            return initialDB
        }
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
        // Merge profundo para garantir que 'config' e outras chaves existam
        return {
            ...initialDB,
            ...data,
            config: data.config ? { ...initialDB.config, ...data.config } : initialDB.config
        }
    } catch (e) {
        return initialDB
    }
}
const saveDB = (db) => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))

// ================= TEMAS =================
const TEMAS = {
    kratos: { nome: 'KRATOS', emoji: '⚔️', foto: './kratos.jpg', menu: `⚔️ *KRATOS STORE*\n\n🔥 /like [id]\n🎟️ /pass [id]\n🔍 /check [id]\n👤 /perfil\n👑 /vip\n💰 /saldo\n🎨 /tema\n🚫 /ban\n📋 /menu` },
    princesa: { nome: 'PRINCESA', emoji: '👑', foto: './princesa.jpg', menu: `👑 *PRINCESA STORE*\n\n🔥 /like [id]\n🎟️ /pass [id]\n🔍 /check [id]\n👤 /perfil\n👑 /vip\n💰 /saldo\n🎨 /tema\n🚫 /ban\n📋 /menu` },
    zxguild: { nome: 'ZXGUILD', emoji: '⚡', foto: './logo.jpg', menu: `⚡ *ZXGUILD STORE*\n\n🔥 /like [id]\n🎟️ /pass [id]\n🔍 /check [id]\n👤 /perfil\n👑 /vip\n💰 /saldo\n🎨 /tema\n🚫 /ban\n📋 /menu` }
}

// ================= BOT CORE =================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        auth: state,
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['Kratos-Store', 'Safari', '3.0']
    })

    if (!sock.authState.creds.registered) {
        const numero = NUMERO_CONEXAO.replace(/\D/g, '')
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(numero)
                code = code?.match(/.{1,4}/g)?.join('-') || code
                console.log(`\nCÓDIGO DE PAREAMENTO: ${code}\n`)
            } catch { console.log('Erro ao gerar código.') }
        }, 6000)
    }

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'open') console.log(`✅ ${NomeDoBot} ONLINE`)
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true
            if (shouldReconnect) startBot()
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0]
            if (!msg.message || msg.key.fromMe) return

            const from = msg.key.remoteJid
            const isGroup = from.endsWith('@g.us')
            const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '').trim()
            
            if (!body.startsWith('/')) return

            const args = body.slice(1).split(/ +/)
            const cmd = args.shift().toLowerCase()
            const sender = (isGroup ? msg.key.participant : from).replace(/[^0-9]/g, '')
            
            const db = getDB()
            const isDono = DONOS.includes(sender)
            const vipInfo = db.vips[sender]
            const isVip = isDono || (vipInfo && vipInfo.ids_restantes > 0) // Dono é VIP infinito
            const isPublico = db.config.publico

            // Funções Auxiliares
            async function reply(text) {
                const mentions = text.match(/@(\d+)/g)?.map(v => v.replace('@', '') + '@s.whatsapp.net') || []
                await sock.sendMessage(from, { text, mentions }, { quoted: msg })
            }

            // Lógica de Bloqueio (Público/Privado)
            if (!isPublico && !isDono && !isVip) {
                if (cmd === 'menu' || cmd === 'perfil') return reply("🔒 *MODO PRIVADO*\nAcesso restrito a Donos e VIPs.")
                return 
            }

            if (isGroup && !db.grupos[from]) {
                db.grupos[from] = { tema: 'kratos' }
                saveDB(db)
            }

            const temaAtual = TEMAS[isGroup ? (db.grupos[from]?.tema || 'kratos') : 'kratos'] || TEMAS.kratos

            switch (cmd) {
                case 'menu':
                    const adminSufix = isDono ? `\n\n👑 *ADMIN*\n/publico | /privado\n/addvip | /delvip\n/addpass | /info` : ''
                    if (fs.existsSync(temaAtual.foto)) {
                        await sock.sendMessage(from, { image: fs.readFileSync(temaAtual.foto), caption: `${temaAtual.menu}${adminSufix}` }, { quoted: msg })
                    } else { reply(`${temaAtual.menu}${adminSufix}`) }
                    break

                case 'perfil':
                    const cargo = isDono ? 'DONO 👑' : (isVip ? 'VIP ⭐' : 'USUÁRIO 👤')
                    const idsL = isDono ? 'INFINITO' : (isVip ? vipInfo.ids_restantes : '0')
                    reply(`👤 *PERFIL*\n\n📞 @${sender}\n🎖️ Cargo: ${cargo}\n🔥 IDs VIP: ${idsL}\n🎟️ Passes: ${db.passes[sender] || 0}`)
                    break

                case 'publico':
                case 'privado':
                    if (!isDono) return reply('❌ Apenas donos.')
                    db.config.publico = (cmd === 'publico')
                    saveDB(db)
                    reply(`⚙️ Modo de acesso alterado para: *${cmd.toUpperCase()}*`)
                    break

                case 'like':
                    const idL = args[0]
                    if (!idL) return reply('❌ Use: /like [id]')
                    if (!isDono && !isVip && (db.passes[sender] || 0) <= 0) return reply('❌ Saldo insuficiente.')

                    reply(`⏳ Processando likes para ${idL}...`)
                    try {
                        const { data } = await axios.get(`${API_URL_LIKE}${idL}`)
                        if (!isDono) {
                            if (isVip) {
                                db.vips[sender].ids_restantes--
                                if (db.vips[sender].ids_restantes <= 0) delete db.vips[sender]
                            } else { db.passes[sender]-- }
                            saveDB(db)
                        }
                        reply(`✅ LIKES ENVIADOS!\n👤 Nick: ${data.nickname || 'N/A'}\n❤️ Final: ${data.likes_end || 'Sucesso'}`)
                    } catch { reply('❌ Erro na API ou ID inválido.') }
                    break

                case 'ban':
                    if (!isGroup) return reply('❌ Apenas em grupos.')
                    const bTargetJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                                      msg.message.extendedTextMessage?.contextInfo?.participant || 
                                      (args[0] ? args[0].replace(/\D/g, '') + '@s.whatsapp.net' : null)

                    if (!bTargetJid) return reply('❌ Marque o usuário ou responda à mensagem dele.')
                    
                    try {
                        const res = await sock.groupParticipantsUpdate(from, [bTargetJid], 'remove')
                        if (res[0].status === '403') {
                            reply('❌ Erro: O usuário é admin ou eu não sou admin.')
                        } else {
                            reply(`🚫 @${bTargetJid.split('@')[0]} removido.`)
                        }
                    } catch { reply('❌ Falha ao remover.') }
                    break

                case 'tema':
                    if (!isGroup) return
                    const tName = args[0]?.toLowerCase()
                    if (!TEMAS[tName]) return reply('🎨 Escolha: kratos, princesa ou zxguild')
                    db.grupos[from].tema = tName
                    saveDB(db); reply(`✅ Tema alterado para ${tName.toUpperCase()}`)
                    break

                case 'addvip':
                    if (!isDono) return
                    const targetV = (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0] || '').replace(/[^0-9]/g, '')
                    const qtdV = parseInt(args[1]) || 10
                    if (!targetV) return reply('❌ Mencione o usuário.')
                    db.vips[targetV] = { ids_restantes: qtdV }
                    saveDB(db); reply(`⭐ VIP @${targetV} adicionado com ${qtdV} IDs.`)
                    break

                case 'addpass':
                    if (!isDono) return
                    const targetP = (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0] || '').replace(/[^0-9]/g, '')
                    const qtdP = parseInt(args[1]) || 1
                    if (!targetP) return reply('❌ Mencione o usuário.')
                    db.passes[targetP] = (db.passes[targetP] || 0) + qtdP
                    saveDB(db); reply(`🎟️ +${qtdP} passes para @${targetP}`)
                    break

                case 'info':
                    if (!isDono) return
                    reply(`📊 *ESTATÍSTICAS*\n\n🔓 Acesso: ${db.config.publico ? 'Público' : 'Privado'}\n👥 Grupos: ${Object.keys(db.grupos).length}\n👑 VIPs: ${Object.keys(db.vips).length}`)
                    break
            }
        } catch (e) { console.log("Erro Mensagem:", e) }
    })
}

startBot()
