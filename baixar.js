const axios = require('axios');
const fs = require('fs');
const path = require('path');

const pastaImagens = path.join(__dirname, 'imagens_miniaturas');
if (!fs.existsSync(pastaImagens)) {
    fs.mkdirSync(pastaImagens);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function baixarImagens() {
    try {
        console.log("Lendo o banco de dados...");
        // ⚠️ ATENÇÃO: Confirme se o nome do arquivo aqui está lendo o arquivo Premium correto!
        const rawData = fs.readFileSync('catalogo_premium.json', 'utf-8'); 
        const catalogo = JSON.parse(rawData);

        console.log(`Iniciando o download de ${catalogo.length} imagens...\n`);

        for (let i = 0; i < catalogo.length; i++) {
            const carro = catalogo[i];
            
            if (!carro.image || carro.image === "") {
                console.log(`[${i + 1}/${catalogo.length}] ⚠️ Sem imagem para: ${carro.name}`);
                continue;
            }

            // 🎯 A CORREÇÃO ESTÁ AQUI: Removemos barras do ano e limpamos espaços adicionais
            const anoSeguro = String(carro.year).replace(/\//g, ''); // Transforma "N/A" em "NA"
            const nomeLimpo = String(carro.name).replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
            const partSegura = String(carro.part).replace(/[^a-zA-Z0-9]/g, '');
            
            const nomeArquivo = `${anoSeguro}_${partSegura}_${nomeLimpo}.jpg`;
            const caminhoCompleto = path.join(pastaImagens, nomeArquivo);

            if (fs.existsSync(caminhoCompleto)) {
                console.log(`[${i + 1}/${catalogo.length}] ⏭️ Já existe: ${nomeArquivo}`);
                continue;
            }

            console.log(`[${i + 1}/${catalogo.length}] ⬇️ Baixando: ${nomeArquivo}`);

            try {
                const response = await axios({
                    url: carro.image,
                    method: 'GET',
                    responseType: 'stream',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
                    }
                });

                const writer = fs.createWriteStream(caminhoCompleto);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

            } catch (err) {
                console.log(`  ❌ Erro ao baixar ${nomeArquivo}: ${err.message}`);
            }

            await delay(1000);
        }

        console.log('\n========================================');
        console.log('✅ TODOS OS DOWNLOADS FORAM CONCLUÍDOS!');
        console.log('📂 Verifique a pasta "imagens_miniaturas".');
        console.log('========================================\n');

    } catch (erro) {
        console.error("❌ Erro ao iniciar:", erro.message);
    }
}

baixarImagens();