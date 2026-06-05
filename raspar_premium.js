const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin()); 

const cheerio = require('cheerio');
const fs = require('fs');

const delay = ms => new Promise(res => setTimeout(res, ms));

// ==========================================
// 1. GERADOR AUTOMÁTICO DE URLs (A MÁGICA)
// ==========================================
const colecoesTarget = [];

function adicionarColecao(nome, anoInicio, anoFim, urlTemplate) {
    for (let ano = anoInicio; ano <= anoFim; ano++) {
        colecoesTarget.push({
            nome: nome,
            anoFabricacao: ano,
            cas: 'Premium', // Linhas Premium geralmente não usam Cases como a Mainline
            url: urlTemplate.replace('{ano}', ano)
        });
    }
}




adicionarColecao('Pop Culture', 2022, 2026, 'https://hotwheels.fandom.com/wiki/{ano}_Pop_Culture');
adicionarColecao('Fast & Furious Premium', 2019, 2026, 'https://hotwheels.fandom.com/wiki/{ano}_Fast_%26_Furious_Premium_Series');

// Mario Kart (É uma página única, então adicionamos manualmente no final)
colecoesTarget.push({
    nome: 'Mario Kart',
    anoFabricacao: 'N/A', // O ano costuma vir no nome do mix na página
    cas: 'Mario Kart',
    url: 'https://hotwheels.fandom.com/wiki/Mario_Kart'
});

// ==========================================
// 2. O MOTOR DO CRAWLER
// ==========================================
async function varrerCatologoPremium() {
    console.log(`🚀 Iniciando varredura PREMIUM de ${colecoesTarget.length} páginas...\n`);
    let browser;
    
    try {
        browser = await puppeteer.launch({ 
            headless: false, // Mantém visível para o Cloudflare
            defaultViewport: null,
            args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        let catalogoFinal = [];

        for (let i = 0; i < colecoesTarget.length; i++) {
            const serieTarget = colecoesTarget[i];
            console.log(`[${i + 1}/${colecoesTarget.length}] Buscando: ${serieTarget.nome} (${serieTarget.anoFabricacao})...`);

            try {
                await page.goto(serieTarget.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                
                try {
                    await page.waitForSelector('table', { timeout: 45000 });
                } catch (e) {
                    console.log(`  ⚠️ Tabela não carregou a tempo ou página não existe.`);
                }

                const tituloPagina = await page.title();
                // Algumas coleções falharam em anos específicos (ex: Boulevard não lançou em 2014-2019). O script pula sozinho!
                if (tituloPagina.includes('Bad title') || tituloPagina.includes('Search') || tituloPagina.includes('Not Found')) {
                    console.log(`  ⏭️ URL não encontrada no Fandom. Pulando...`);
                    continue;
                }

                const html = await page.content();
                const $ = cheerio.load(html);
                let carrosExtraidos = 0;

                $('table').each((tabelaIndex, tabelaElemento) => {
                    let idx = { series: -1, toy: -1, name: -1, color: -1 }; 
                    let cabeçalhoMapeado = false;

                    $(tabelaElemento).find('tr').each((linhaIndex, linhaElemento) => {
                        const ths = $(linhaElemento).find('th');
                        
                        // LÓGICA DE DETECÇÃO AMPLIADA PARA PÁGINAS ANTIGAS
                        if (ths.length > 2 && !cabeçalhoMapeado) {
                            ths.each((i, th) => {
                                const textoHeader = $(th).text().toLowerCase().trim();
                                if (textoHeader.includes('series') || textoHeader === '#' || textoHeader.includes('number') || textoHeader.includes('col')) idx.series = i;
                                if (textoHeader.includes('toy') || textoHeader.includes('part')) idx.toy = i;
                                if (textoHeader.includes('name') || textoHeader.includes('casting') || textoHeader.includes('vehicle') || textoHeader.includes('model')) idx.name = i;
                                if (textoHeader === 'color' || textoHeader === 'colour') idx.color = i;
                            });
                            cabeçalhoMapeado = true;
                            return; 
                        }

                        const colunas = $(linhaElemento).find('td');
                        if (colunas.length < 3) return;

                        const serieTexto = idx.series !== -1 && colunas[idx.series] ? $(colunas[idx.series]).text().trim() : "";
                        const partCode = idx.toy !== -1 && colunas[idx.toy] ? $(colunas[idx.toy]).text().trim() : "";
                        const nomeModelo = idx.name !== -1 && colunas[idx.name] ? $(colunas[idx.name]).text().trim() : "";
                        const corModelo = idx.color !== -1 && colunas[idx.color] ? $(colunas[idx.color]).text().trim() : "";

                        // Flexibilizando o filtro para pegar a página do Mario Kart que não tem "Toy #" nas tabelas
                        if (!nomeModelo || nomeModelo.length < 2) return;
                        if (serieTarget.nome !== 'Mario Kart' && (!partCode || partCode.length < 3 || partCode.length > 8)) return;

                        let imgSrc = '';
                        const imgElemento = $(linhaElemento).find('img').last(); 
                        if (imgElemento.length > 0) {
                            imgSrc = imgElemento.attr('data-src') || imgElemento.attr('src') || '';
                            imgSrc = imgSrc.split('/revision/')[0]; 
                        }

                        let hwNum = serieTexto.split('/')[0] || "000";
                        if (hwNum === "") hwNum = "000";

                        let serieFormatada = `${serieTarget.nome} (${serieTexto})`;
                        if (serieTexto === "") serieFormatada = serieTarget.nome;

                        catalogoFinal.push({
                            year: serieTarget.anoFabricacao, // Puxa o ano direto da nossa lista gerada
                            name: nomeModelo,
                            series: serieFormatada,
                            color: corModelo,
                            part: partCode || "N/A", // Salva N/A se a coluna Toy não existir (ex: Mario Kart)
                            hw: hwNum,
                            cas: serieTarget.cas,
                            image: imgSrc
                        });
                        carrosExtraidos++;
                    });
                });

                if (carrosExtraidos > 0) {
                    console.log(`  ✔️ Sucesso! ${carrosExtraidos} carros adicionados.`);
                } else {
                    console.log(`  ⚠️ Nenhum carro extraído.`);
                }

            } catch (erroPagina) {
                console.log(`  ❌ Erro ao ler a página: ${erroPagina.message}`);
            }

            await delay(3000);
        }

        console.log(`\n========================================`);
        console.log(`🎉 VARREDURA PREMIUM CONCLUÍDA!`);
        console.log(`🚗 Total de veículos de luxo extraídos: ${catalogoFinal.length}`);
        console.log(`========================================\n`);

        // Salva em um arquivo diferente para não sobrescrever a sua lista de Silver Series
        const nomeArquivo = 'catalogo_premium.json';
        fs.writeFileSync(nomeArquivo, JSON.stringify(catalogoFinal, null, 4));
        console.log(`📂 O arquivo '${nomeArquivo}' foi gerado!`);

    } catch (erroGeral) {
        console.error("❌ Erro fatal no Puppeteer:", erroGeral.message);
    } finally {
        if (browser) await browser.close();
    }
}

varrerCatologoPremium();