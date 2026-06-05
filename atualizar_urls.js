const fs = require('fs');

// 🌐 A URL base pública do seu bucket R2 no Cloudflare
const baseUrlR2 = 'https://pub-0cdcb80ac9eb425cade74a8a804cef22.r2.dev';

try {
    console.log("Lendo o catálogo original...");
    const rawData = fs.readFileSync('catalogo_premium.json', 'utf-8');
    const catalogo = JSON.parse(rawData);

    console.log("Atualizando os caminhos das imagens para o Cloudflare R2...");

    const catalogoAtualizado = catalogo.map(carro => {
        // Se o carro não tinha imagem no scraping original, mantemos o campo vazio
        if (!carro.image || carro.image === "") {
            return carro;
        }

        // Recria a exata mesma lógica de nomenclatura que usamos para salvar as fotos
        const anoSeguro = String(carro.year).replace(/\//g, '');
        const nomeLimpo = String(carro.name).replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
        const partSegura = String(carro.part).replace(/[^a-zA-Z0-9]/g, '');
        const nomeArquivo = `${anoSeguro}_${partSegura}_${nomeLimpo}.jpg`;
        // Substitui o link do Fandom pelo link do seu bucket em nuvem
        carro.image = `${baseUrlR2}/${nomeArquivo}`;

        return carro;
    });

    // Salva tudo em um NOVO arquivo para preservarmos o RAW original por segurança
    const nomeNovoArquivo = 'catalogo_nuvem_2026.json';
    fs.writeFileSync(nomeNovoArquivo, JSON.stringify(catalogoAtualizado, null, 4));

    console.log(`\n========================================`);
    console.log(`✅ SUCESSO! LINKS ATUALIZADOS.`);
    console.log(`📂 O banco de dados final foi salvo como '${nomeNovoArquivo}'`);
    console.log(`========================================\n`);

} catch (erro) {
    console.error("❌ Erro ao atualizar o arquivo:", erro.message);
}