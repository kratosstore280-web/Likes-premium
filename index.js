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
const DONOS = ['72950405451812','556993543234','277936125034703', '5551995588124', '44930357551239', '25701671538894']

const API_URL_LIKE = 'https://likesff.online/api/LIKE?key=LIKESFF-KLFF-KRATOSLIKESEPASSES&id='
const API_URL_PASS = 'https://likesff.online/api/PASS?key=LIKESFF-KLFF-KRATOSLIKESEPASSES&id=' 
const API_CHECK = 'https://likesff-info.squareweb.app/check_basic?id='

const TEMAS = {
    kratos: { nome: 'KRATOS', emoji: '⚔️', foto: './kratos.jpg' },
    princesa: { nome: 'PRINCESA', emoji: '👑', foto: './princesa.jpg' },
    zxguild: { nome: 'ZXGUILD', emoji: '⚡', foto: './logo.jpg' },
    dark: { nome: 'DARK7X VENDAS', emoji: '🙅🏻‍♂️', foto: './dark.jpg' }
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
    // Usando a pasta estável que definimos para a Discloud
    const { state, saveCreds } = await useMultiFileAuthState('./auth_sessao')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        auth: state,
        version,
        logger: P({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        printQRInTerminal: true
    })

    // Gerenciador de Pareamento por Código
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

    // CORREÇÃO ESSENCIAL: Impede o bot de morrer silenciosamente
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        
        if (connection === 'connecting') {
            console.log(`📡 Conectando ao WhatsApp...`)
        }
        
        if (connection === 'open') {
            console.log(`✅ ${NomeDoBot} CONECTADO COM SUCESSO E ONLINE!`)
        }
        
        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 0
            console.log(`❌ Conexão fechada. Código: ${statusCode}. Reiniciando...`)
            
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 5000)
            } else {
                console.log(`⚠️ Sessão encerrada permanentemente. Apague a pasta auth_sessao e conecte de novo.`)
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

            // Se você quiser que o bot dê o aviso no privado MESMO se a pessoa NÃO digitar a barra (/),
            // apague ou comente a linha abaixo. Se preferir avisar só quem tenta usar comandos, deixe ela aqui:
            if (!body.startsWith('/')) return

            const args = body.slice(1).split(/ +/)
            const cmd = args.shift().toLowerCase()
            const sender = (isGroup ? (msg.key.participant || from) : from).replace(/\D/g, '')

            const db = getDB()
            const isDono = DONOS.includes(sender)
            const isVip = isDono || (db.vips[sender] && (db.vips[sender].ids || 0) > 0)

            // 🟢 COLE A TRAVA EXATAMENTE AQUI (ABAIXO DO ISDONO):
            if (!isGroup && !isDono) {
                await sock.sendMessage(from, { text: "⚠️ *Aviso:* Olá! As interações e comandos deste bot estão desativadas no privado.\n\n📌 Para utilizá-lo, por favor, acesse o nosso grupo oficial da Kratos Store!" }, { quoted: msg });
                return; // Para o código aqui e impede o bot de responder o comando
            }

            if (isGroup && !db.grupos[from]) {
                db.grupos[from] = { tema: 'kratos', publico: true }
                saveDB(db)
            }
            const grupo = isGroup ? db.grupos[from] : { tema: 'kratos', publico: true }
            const T = TEMAS[grupo.tema] || TEMAS.kratos

            const reply = async (text) => {
                const mentions = text.match(/@(\d+)/g)?.map(v => v.replace('@', '') + '@s.whatsapp.net')
                await sock.sendMessage(from, { text, mentions }, { quoted: msg })
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
                    
                    if (!grupo.publico && !isVip) {
                        return reply("🔒 *ENVIO RESTRITO*\nApenas usuários VIP podem usar o comando de likes neste grupo privado.")
                    }
                    
                    reply('⏳ Processando Likes...')
                    try {
                        const { data } = await axios.get(`${API_URL_LIKE}${idL}`)
                        
                        let exibirVip = "GRÁTIS (MODO PÚBLICO)"
                        if (isDono) exibirVip = "INFINITO"
                        else if (isVip) exibirVip = (db.vips[sender].ids - 1)

                        if (data.status === "success" && !grupo.publico && !isDono && isVip) {
                            db.vips[sender].ids--
                            saveDB(db)
                        }
                        reply(`⚔️ *PAINEL LIKES*\n\n👤 Nick: ${data.nickname}\n🆔 ID: ${data.id}\n❤️ Ganhou: ${data.likes_added}\n🏆 Total: ${data.likes_end}\n⭐ Limite VIP: ${exibirVip}\n📡 Status: ${data.message}`)
                    } catch { reply('❌ Erro na API de Likes.') }
                    break
                }

                case 'pass': {
                    const idP = args[0]
                    if (!idP) return reply('❌ Informe o ID.')
                    
                    if (!grupo.publico && !isVip) {
                        return reply("🔒 *ENVIO RESTRITO*\nApenas usuários VIP podem enviar passes neste grupo privado.")
                    }

                    const saldoAtual = db.passes[sender] || 0
                    if (!isDono && saldoAtual <= 0) {
                        return reply('❌ Sem saldo de passes. Faça uma recarga!')
                    }

                    reply('⏳ Processando Passes...')
                    try {
                        const { data } = await axios.get(`${API_URL_PASS}${idP}`)
                        let saldoRestante = isDono ? "INFINITO" : (saldoAtual - 1)

                        if (data.status === "success" && !isDono) {
                            db.passes[sender]--
                            saveDB(db)
                        }
                        reply(`🎟️ *PAINEL PASSES*\n\n👤 Nick: ${data.nickname}\n🆔 ID: ${data.id}\n📦 Saldo de Passes: ${saldoRestante}\n📡 Status: ${data.message || 'Sucesso'}`)
                    } catch { reply('❌ Erro na API de Passes.') }
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

                case 'addvip': {
                    if (!isDono) return

                    // Pega o JID puro da primeira menção ou usa o texto digitado
                    let uV = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0] || ''
                    // Limpa para deixar só os números (ex: 556993543234)
                    uV = uV.replace('@s.whatsapp.net', '').replace(/\D/g, '')

                    if (!uV) return reply('❌ Marque o usuário ou informe o ID para adicionar como VIP.')

                    // Define a quantidade de ids/likes (padrão 10 se não digitar nada)
                    const qtdIds = parseInt(args[1]) || 10

                    db.vips[uV] = { ids: qtdIds }
                    saveDB(db)

                    reply(`⭐ *VIP ADICIONADO*\n\n👤 Usuário: @${uV}\n🔥 Limite de Envios: ${qtdIds}`)
                    break
                }

                case 'delvip': {
                    if (!isDono) return

                    // Pega o JID puro da primeira menção ou usa o texto digitado
                    let uD = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0] || ''
                    uD = uD.replace('@s.whatsapp.net', '').replace(/\D/g, '')

                    if (!uD) return reply('❌ Marque o usuário ou informe o ID para remover.')

                    if (!db.vips[uD]) {
                        return reply(`💡 O usuário @${uD} não está cadastrado na lista VIP.`)
                    }

                    delete db.vips[uD]
                    saveDB(db)

                    reply(`✅ *VIP REMOVIDO*\n\n👤 Usuário: @${uD}\nVoltou a ser usuário Free!`)
                    break
                }
                
                case 'perfil': {
                    const cargo = isDono ? 'DONO 👑' : (isVip ? 'VIP ⭐' : 'USUÁRIO FREE 👤');
                    const saldoVip = isDono ? 'INFINITO' : (db.vips[sender]?.ids || 0);
                    const saldoPasses = db.passes[sender] || 0;

                    const textoPerfil = `👤 *SEU PERFIL - ${T.nome}* 👤\n\n` +
                                      `📞 *Contato:* @${sender}\n` +
                                      `🎖️ *Cargo:* ${cargo}\n\n` +
                                      `━━━━━━━━━━━━━━━\n\n` +
                                      `🔥 *Envios VIP (Likes):* ${saldoVip}\n` +
                                      `🎟️ *Saldo de Passes:* ${saldoPasses}\n\n` +
                                      `💡 _Use seu saldo para enviar likes ou fazer consultas via /like e /check._`;
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
                }

                case 'vip': {
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
                        await sock.sendMessage(from, { image: fs.readFileSync('./tabela.jpg'), caption: tabelaPrecos }, { quoted: msg });
                    } else { reply(tabelaPrecos); }
                    break;
                }

                case 'clearlist': {
                    if (!isDono) return reply('❌ Apenas o dono pode resetar a lista.')
                    db.vips = {}
                    saveDB(db)
                    reply('⚠️ *LISTA VIP RESETADA!* ⚠️\nTodos os usuários VIP foram removidos.')
                    break
	       }

            case 'vips': {
                // Pega a lista de chaves (os números de telefone) que estão no objeto vips
                const listaVips = Object.keys(db.vips || {});

                // Filtra para garantir que só vai listar quem realmente tem IDs cadastrados maior que 0
                const vipsAtivos = listaVips.filter(num => (db.vips[num].ids || 0) > 0);

                if (vipsAtivos.length === 0) {
                    return reply("❌ *Nenhum usuário VIP cadastrado até o momento!*");
                }

                let textoVips = `⭐ *LISTA DE USUÁRIOS VIP - KRATOS STORE* ⭐\n\n`;
                textoVips += `Total de VIPs ativos: *${vipsAtivos.length}*\n\n`;

                // Monta a lista com menção (@) para cada um
                vipsAtivos.forEach((num, index) => {
                    // db.vips[num].ids guarda a quantidade de dias ou créditos que você configurou para eles
                    const creditos = db.vips[num].ids || 0;
                    textoVips += `${index + 1}. @${num} — *${creditos} IDs/Créditos*\n`;
                });

                textoVips += `\n📌 _Para adquirir VIP ou consultar planos, fale com o suporte._`;

                // Envia a resposta final para o grupo/chat
                return reply(textoVips);

                }
            }
        } catch (e) { console.log(e) }
    })
}

// Executa o bot garantindo que o processo permaneça ativo
startBot().catch(err => console.log("Erro crítico na inicialização:", err))
