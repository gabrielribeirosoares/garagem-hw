import os
from bs4 import BeautifulSoup
import json
import time
import cloudscraper # Biblioteca nova para evitar o erro 403!

# Configurações do robô
anos_para_buscar = range(2026, 1999, -1) 

# Estrutura de pastas
pasta_imagens = os.path.join("public", "assets", "img", "imagens_hw")
if not os.path.exists(pasta_imagens):
    os.makedirs(pasta_imagens)

carros_raw = []

# Inicializa o raspador 'disfarçado' de navegador real
scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False})

print("🚀 Iniciando a extração da Fandom Hot Wheels com CloudScraper...")

for ano in anos_para_buscar:
    url = f"https://hotwheels.fandom.com/wiki/List_of_{ano}_Hot_Wheels"
    print(f"\n--- Acessando {ano}: {url} ---")

    try:
        # Usamos o scraper.get ao invés de requests.get
        response = scraper.get(url)
        
        # Agora o status code deve ser 200 (Sucesso) e não 403 (Bloqueado)
        if response.status_code != 200:
            print(f"Erro {response.status_code}: Página não encontrada ou bloqueada no ano {ano}.")
            continue

        soup = BeautifulSoup(response.text, 'html.parser')
        tabelas = soup.find_all('table', class_='wikitable')

        for tabela in tabelas:
            linhas = tabela.find_all('tr')
            if not linhas:
                continue

            # Leitura dinâmica de cabeçalhos
            headers_tabela = [th.text.strip().lower() for th in linhas[0].find_all(['th', 'td'])]
            idx_hw, idx_part, idx_name, idx_series, idx_color, idx_photo = -1, -1, -1, -1, -1, -1

            for i, h in enumerate(headers_tabela):
                if 'col' in h or 'hw' in h or '#' in h: idx_hw = i
                if 'toy' in h or 'part' in h: idx_part = i
                if 'model' in h or 'name' in h or 'casting' in h: idx_name = i
                if 'series' in h or 'segment' in h: idx_series = i
                if 'color' in h: idx_color = i
                if 'photo' in h or 'image' in h: idx_photo = i

            for linha in linhas[1:]:
                colunas = linha.find_all(['td', 'th'])

                if len(colunas) <= max(idx_name, idx_part):
                    continue

                try:
                    hw_num = colunas[idx_hw].text.strip() if idx_hw != -1 else ""
                    part_num = colunas[idx_part].text.strip() if idx_part != -1 else ""
                    nome = colunas[idx_name].text.strip() if idx_name != -1 else ""
                    serie = colunas[idx_series].text.strip() if idx_series != -1 else ""
                    cor = colunas[idx_color].text.strip() if idx_color != -1 else ""

                    if not nome or nome.lower() == 'model name' or nome.lower() == 'tba':
                        continue

                    # Extração e Download da Imagem (Atualizado com sua tag HTML!)
                    caminho_imagem_json = ""
                    url_imagem = ""
                    
                    if idx_photo != -1 and len(colunas) > idx_photo:
                        coluna_foto = colunas[idx_photo]
                        
                        # Primeiro tenta pegar pelo link <a> em volta da imagem (melhor resolução)
                        link_tag = coluna_foto.find('a', class_='image')
                        if link_tag and link_tag.get('href'):
                            url_bruta = link_tag.get('href')
                            # Limpa parâmetros extras do MediaWiki para pegar a foto limpa
                            url_imagem = url_bruta.split('/revision/')[0]
                        else:
                            # Fallback para a tag <img> caso o link <a> não exista
                            img_tag = coluna_foto.find('img')
                            if img_tag:
                                url_bruta = img_tag.get('data-src') or img_tag.get('src') or ""
                                if url_bruta.startswith("http"):
                                    url_imagem = url_bruta.split('/revision/')[0]

                    if url_imagem:
                        # Limpa nome do arquivo para não dar erro no Windows
                        nome_arquivo = f"{ano}_{part_num}_{nome}".replace(' ', '_').replace('/', '-')
                        nome_arquivo = "".join(c for c in nome_arquivo if c.isalnum() or c in ('_', '-')) + ".jpg"
                        
                        caminho_fisico = os.path.join(pasta_imagens, nome_arquivo)

                        # Baixa usando o scraper disfarçado
                        if not os.path.exists(caminho_fisico):
                            try:
                                img_data = scraper.get(url_imagem).content
                                with open(caminho_fisico, 'wb') as f:
                                    f.write(img_data)
                                print(f"✅ Baixado: {nome_arquivo}")
                            except Exception as e:
                                print(f"❌ Erro ao baixar foto do {nome}: {e}")
                        
                        caminho_imagem_json = f"assets/img/imagens_hw/{nome_arquivo}"

                    # Adiciona ao JSON
                    carros_raw.append({
                        "year": ano,
                        "name": nome,
                        "series": serie,
                        "color": cor,
                        "part": part_num,
                        "hw": hw_num,
                        "cas": "", 
                        "image": caminho_imagem_json if caminho_imagem_json else url_imagem
                    })

                except Exception as e:
                    pass

        time.sleep(2) # Pausa um pouco maior para a Fandom não desconfiar

    except Exception as e:
        print(f"Erro fatal ao processar o ano {ano}: {e}")

# Criação do arquivo data.js
caminho_js = "data.js"
with open(caminho_js, 'w', encoding='utf-8') as f:
    json_string = json.dumps(carros_raw, indent=4, ensure_ascii=False)
    f.write(f"export const RAW = {json_string};\n")

print("\n" + "="*40)
print("🏁 OPERAÇÃO FINALIZADA!")
print(f"Total: {len(carros_raw)} carros processados.")