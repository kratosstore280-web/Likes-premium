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

const API_URL_LIKE = 'https://likesff.online/api/LIKE?key=LIKESFF-KLFF-KRATOSLIKESEPASSES&id='
const API_CHECK = 'https://likesff-info.squareweb.app/check_basic?id='
const DONOS = ['556993543234', '5551995588124', '44930357551239', '25701671538894']

// ================= DATABASE =================
const initialDB = {
    grupos: {},
    vips: {},
    passes: {},
    config: { publico: true }
}

const getDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) return initialDB
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    } catch { return initialDB }
}
const saveDB = (db) => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))

// ================= TEMAS =================
const TEMAS = {
    kratos: { nome: 'KRATOS', emoji: '⚔️', foto: './kratos.jpg' },
    princesa: { nome: 'PRINCESA', emoji: '👑', foto: './princesa.jpg' },
    zxguild: { nome: 'ZXGUILD', emoji: '⚡', foto: './logo.jpg' }
}

// ================= BOT CORE =================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        auth: state,
        version,
        logger: P({ level: 'silent' }),
        browser: ['Kratos-Store', 'Safari', '3.0']
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'open') console.log(`✅ ${NomeDoBot} CONECTADO COM SUCESSO!`)
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
            const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim()
            
            if (!body.startsWith('/')) return

            const args = body.slice(1).split(/ +/)
            const cmd = args.shift().toLowerCase()
            const sender = (isGroup ? msg.key.participant : from).replace(/\D/g, '')
            
            const db = getDB()
            const isDono = DONOS.includes(sender)
            const isVip = isDono || (db.vips[sender] && db.vips[sender].ids > 0)

            // Registro de Grupo e Tema
            if (isGroup && !db.grupos[from]) db.grupos[from] = { tema: 'kratos' }
            const currentTema = isGroup ? (db.grupos[from].tema || 'kratos') : 'kratos'
            const T = TEMAS[currentTema] || TEMAS.kratos

            const reply = async (text) => {
                const mentions = text.match(/@(\d+)/g)?.map(v => v.replace('@', '') + '@s.whatsapp.net') || []
                await sock.sendMessage(from, { text, mentions }, { quoted: msg })
            }

            // Controle de Acesso
            if (!db.config.publico && !isDono && !isVip) {
                if (['menu', 'perfil', 'like', 'check', 'saldo'].includes(cmd)) {
                    return reply("🔒 *MODO PRIVADO*\nAcesso restrito apenas para VIPs ou Donos.")
                }
            }

            switch (cmd) {
                case 'menu':
                    const menuStr = `${T.emoji} *${T.nome} STORE*\n\n🔥 /like [id]\n🎟️ /pass [id]\n🔍 /check [id]\n👤 /perfil\n👑 /vip\n💰 /saldo\n🎨 /tema\n🚫 /ban\n📋 /menu`
                    const adminStr = `\n\n👑 *ADMIN*\n/publico | /privado\n/addvip | /delvip\n/addpass | /vips\n/info`
                    const finalMenu = isDono ? menuStr + adminStr : menuStr

                    if (fs.existsSync(T.foto)) {
                        await sock.sendMessage(from, { image: fs.readFileSync(T.foto), caption: finalMenu }, { quoted: msg })
                    } else { reply(finalMenu) }
                    break

                case 'tema':
                    if (!isGroup) return reply('❌ Apenas grupos podem trocar temas.')
                    const choice = args[0]?.toLowerCase()
                    if (!TEMAS[choice]) return reply(`🎨 Escolha um tema válido: kratos, princesa ou zxguild`)
                    db.grupos[from].tema = choice
                    saveDB(db)
                    reply(`${TEMAS[choice].emoji} *PERFEITO!*\nTema alterado para: ${choice.toUpperCase()}\nDigite /menu para ver o novo visual.`)
                    break

                case 'perfil':
                case 'saldo':
                case 'vip':
                    const cargo = isDono ? 'DONO 👑' : (isVip ? 'VIP ⭐' : 'USUÁRIO 👤')
                    const idsVip = isDono ? 'INFINITO' : (db.vips[sender]?.ids || 0)
                    const passes = db.passes[sender] || 0
                    reply(`👤 *PERFIL DE USUÁRIO*\n\n📞 Contato: @${sender}\n🎖️ Cargo: ${cargo}\n🔥 IDs VIP: ${idsVip}\n🎟️ Saldo Passes: ${passes}`)
                    break

case 'like':
    const idL = args[0]
    if (!idL) return reply('❌ Use: /like [id]')
    
    if (!isDono && !isVip && (db.passes[sender] || 0) <= 0) {
        return reply('❌ Você não possui saldo (Keys) para enviar likes.')
    }

    reply(`⏳ Processando envio para o ID ${idL}...`)

    try {
        const { data } = await axios.get(`${API_URL_LIKE}${idL}`)
        
        // Lógica de saldo (Só desconta se a API reportar sucesso no envio)
        let keysBot = isDono ? "INFINITO" : (isVip ? db.vips[sender].ids - 1 : (db.passes[sender] || 0) - 1)
        
        if (data.status === "success" && data.likes_added > 0 && !isDono) {
            if (isVip) db.vips[sender].ids-- 
            else db.passes[sender]--
            saveDB(db)
        }

        const painelLike = `⚔️ *PAINEL FREE FIRE*

👤 Nick:
${data.nickname || '---'}

🆔 UID:
${data.id || idL}

❤️ Likes iniciais: ${data.likes_before || '0'}
✨ Adicionados: ${data.likes_added || '0'}
🏆 Likes finais: ${data.likes_end || '0'}

━━━━━━━━━━━━━━━

🔑 Key:
${data.key || '1/1'}

📦 Keys restantes (Bot):
${keysBot}

📥 Key adicionada:
${data.key_added ? 'SIM' : 'NÃO'}

📢 Status:
${data.key_message || 'Processado'}

🎯 Likes mínimos:
${data.likes_required || '100'}

━━━━━━━━━━━━━━━

📡 Resultado:
${data.message === 'LIKES_SUCCESS' ? '✅ Likes enviados com sucesso!' : '⚠️ ' + data.message}

🔐 Modo:
${db.config.publico ? 'PÚBLICO' : 'PRIVADO'}`

        await reply(painelLike)

    } catch (error) {
        reply(`❌ Erro na conexão com a API. Tente novamente mais tarde.`)
    }
    break

case 'check':
    const idC = args[0]
    if (!idC) return reply('❌ Use: /check [id]')

    reply(`🔍 Consultando ID ${idC}...`)

    try {
        const { data } = await axios.get(`${API_CHECK}${idC}`)
        
        const painelCheck = `⚔️ *PAINEL FREE FIRE*

👤 Nick:
${data.nickname || '---'}

🆔 UID:
${data.id || idC}

🌎 Região: ${data.region || 'BR'}
📊 Nível: ${data.level || '0'}
⭐ XP: ${data.xp || '0'}

📝 Bio:
${data.bio || 'Sem bio'}

━━━━━━━━━━━━━━━

❤️ Likes atuais:
${data.likes_end || data.likes_before || '0'}

━━━━━━━━━━━━━━━

⏰ Último login:
${data.login_end_formatted || 'Não disponível'}

🕰️ Primeira vez online:
${data.login_primary_formatted || 'Não disponível'}

━━━━━━━━━━━━━━━

📡 Resultado:
✅ Consulta realizada com sucesso

🔐 Modo:
${db.config.publico ? 'PÚBLICO' : 'PRIVADO'}`

        await reply(painelCheck)

    } catch (error) {
        reply('❌ Erro ao consultar ID ou API offline.')
    }
    break

                case 'addvip':
                    if (!isDono) return
                    const vUser = (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0] || '').replace(/\D/g, '')
                    const vQty = parseInt(args[1]) || 10
                    if (!vUser) return reply('❌ Mencione alguém.')
                    db.vips[vUser] = { ids: vQty }
                    saveDB(db); reply(`⭐ VIP ADICIONADO\nUsuário: @${vUser}\nCota: ${vQty} IDs.`)
                    break

                case 'delvip':
                    if (!isDono) return
                    const dvUser = (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0] || '').replace(/\D/g, '')
                    if (db.vips[dvUser]) {
                        delete db.vips[dvUser]
                        saveDB(db); reply(`🚫 VIP removido de @${dvUser}`)
                    } else { reply('❌ Usuário não era VIP.') }
                    break

                case 'vips':
                    if (!isDono) return
                    const vList = Object.keys(db.vips).map(v => `• @${v} (${db.vips[v].ids} IDs)`).join('\n') || 'Sem VIPs ativos.'
                    reply(`👑 *VIPS ATIVOS*\n\n${vList}`)
                    break

                case 'addpass':
                    if (!isDono) return
                    const pUser = (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0] || '').replace(/\D/g, '')
                    const pQty = parseInt(args[1]) || 1
                    db.passes[pUser] = (db.passes[pUser] || 0) + pQty
                    saveDB(db); reply(`🎟️ +${pQty} passes para @${pUser}`)
                    break

                case 'publico':
                    if (!isDono) return
                    db.config.publico = true; saveDB(db); reply('⚙️ Modo: *PÚBLICO* (Todos usam)')
                    break

                case 'privado':
                    if (!isDono) return
                    db.config.publico = false; saveDB(db); reply('⚙️ Modo: *PRIVADO* (Apenas VIPs/Dono)')
                    break

                case 'ban':
                    if (!isGroup) return
                    const bTarget = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant
                    if (!bTarget) return reply('❌ Marque ou responda a alguém.')
                    await sock.groupParticipantsUpdate(from, [bTarget], 'remove')
                    reply('🚫 Usuário banido com sucesso.')
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
