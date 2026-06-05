const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { MercadoPagoConfig, Preference } = require("mercadopago");

// Inicializa o SDK Admin para conseguir ler o Firestore pelo backend
initializeApp();
const db = getFirestore();

setGlobalOptions({ maxInstances: 10 });

exports.apiCheckout = onRequest({ cors: true }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Método não permitido.");
        return;
    }

    try {
        const { pedidoId, valor, clienteId, lojaId } = req.body;

        if (!pedidoId || !valor || !lojaId) {
            res.status(400).json({ error: "Dados obrigatórios ausentes." });
            return;
        }

        // 🔍 PASSO CHAVE: Busca as credenciais da loja dona do pedido no Firestore
        const lojaRef = db.collection("lojas").doc(lojaId);
        const lojaSnap = await lojaRef.get();

        if (!lojaSnap.exists) {
            res.status(404).json({ error: `Loja [${lojaId}] não encontrada no sistema.` });
            return;
        }

        const lojaData = lojaSnap.data();
        const tokenEspecificoLoja = lojaData.mpAccessToken;

        if (!tokenEspecificoLoja) {
            res.status(400).json({ error: `A loja [${lojaId}] ainda não configurou o token de recebimento Pix.` });
            return;
        }

        logger.info(`Gerando checkout dinâmico para Loja: ${lojaId} | Pedido: ${pedidoId}`);

        // Inicializa o Mercado Pago usando o token PRIVADO desta loja específica
        const client = new MercadoPagoConfig({ accessToken: tokenEspecificoLoja });
        const preference = new Preference(client);
        
        const response = await preference.create({
            body: {
                items: [
                    {
                        id: pedidoId,
                        title: `Reserva de Miniatura - Garagem (${lojaId})`,
                        quantity: 1,
                        unit_price: Number(valor),
                        currency_id: "BRL"
                    }
                ],
                external_reference: JSON.stringify({
                    pedidoId: pedidoId,
                    clienteId: clienteId,
                    lojaId: lojaId // Guardamos para o Webhook saber quem recebeu
                }),
                back_urls: {
                    success: "https://seusite.com/app.html?type=encomendas",
                    pending: "https://seusite.com/app.html?type=encomendas",
                    failure: "https://seusite.com/app.html?type=encomendas"
                },
                auto_return: "approved"
            }
        });

        // Devolve o link gerado na conta do lojista correto
        res.status(200).json({ init_point: response.init_point });

    } catch (error) {
        logger.error("Erro no checkout dinâmico:", error);
        res.status(500).json({ error: "Erro interno ao gerar o checkout." });
    }
});