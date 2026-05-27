import os
import requests
from bs4 import BeautifulSoup
import json

url_base = "https://minigt.tsm-models.com/" 
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# Pasta onde as imagens vão ficar
pasta_imagens = os.path.join("public", "assets", "img", "imagens_kaido")

if not os.path.exists(pasta_imagens):
    os.makedirs(pasta_imagens)

carros_kaido = []

print("Iniciando o robô extrator da Kaido House...")

# Vasculhando as 10 páginas
for pagina in range(1, 11):
    print(f"\n--- Vasculhando a Página {pagina} ---")
    
    # URL CORRIGIDA com o parâmetro exato do site (&p=)
    url = f"https://minigt.tsm-models.com/index.php?action=product-list&b_id=21&p={pagina}"
    
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    paragrafos_codigo = soup.find_all('p', class_='m-0')
    
    if not paragrafos_codigo:
        print("Nenhum carro encontrado nesta página. Encerrando a navegação.")
        break

    for p in paragrafos_codigo:
        codigo = p.text.strip()
        
        if codigo.startswith("KHMG"):
            # Extração do Nome
            elemento_pai = p.parent
            texto_completo = elemento_pai.text.strip().replace('\n', ' ')
            nome_modelo = texto_completo.replace(codigo, '').strip()
            if not nome_modelo:
                nome_modelo = "Nome não encontrado"

            # Extração da Imagem
            link_imagem_final = ""
            container = p.parent
            for _ in range(4):
                if container.find('img'):
                    break
                container = container.parent
                
            tag_img = container.find('img')
            
            if tag_img and tag_img.get('src'):
                link_imagem = tag_img.get('src')
                
                if not link_imagem.startswith("http"):
                    link_imagem_final = url_base + link_imagem.lstrip('/')
                else:
                    link_imagem_final = link_imagem
                    
                # Download da Imagem
                try:
                    img_data = requests.get(link_imagem_final, headers=headers).content
                    caminho_arquivo_fisico = os.path.join(pasta_imagens, f"{codigo}.jpg")
                    
                    with open(caminho_arquivo_fisico, 'wb') as arquivo_img:
                        arquivo_img.write(img_data)
                    print(f"✅ Imagem: {codigo}")
                except Exception as e:
                    print(f"❌ Erro na imagem {codigo}: {e}")

            # Caminho para o JSON do Front-end
            caminho_imagem_json = f"assets/img/imagens_kaido/{codigo}.jpg"

            # Adicionando ao nosso banco de dados em memória
            # Criamos uma regra para evitar salvar duplicados, caso o site repita carros entre páginas
            if not any(carro['codigo'] == codigo for carro in carros_kaido):
                carros_kaido.append({
                    "codigo": codigo,
                    "modelo": nome_modelo,
                    "fabricante": "Mini GT",
                    "marca": "Kaido House",
                    "escala": "1:64",
                    "caminho_imagem": caminho_imagem_json
                })

# Finalização e exportação
with open('banco_kaido_house_final.json', 'w', encoding='utf-8') as arquivo_json:
    json.dump(carros_kaido, arquivo_json, indent=4, ensure_ascii=False)

print("\n" + "=" * 40)
print(f"OPERAÇÃO FINALIZADA!")
print(f"Total: {len(carros_kaido)} carros únicos importados das páginas.")
print(f"Imagens salvas na pasta: '{pasta_imagens}'")