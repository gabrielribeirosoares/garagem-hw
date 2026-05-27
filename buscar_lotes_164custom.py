import json
import requests
from bs4 import BeautifulSoup
import time

ficheiro_dados = 'public/assets/js/data.js' # O seu arquivo com as imagens já corrigidas
ficheiro_final = 'data_final_com_lotes.js'

print("Lendo a sua base de dados...")

# 1. Carregar os dados
with open(ficheiro_dados, 'r', encoding='utf-8') as f:
    conteudo = f.read()
    inicio = conteudo.find('[')
    fim = conteudo.rfind(']') + 1
    dados = json.loads(conteudo[inicio:fim])

# As caixas da Hot Wheels vão de A a Q (pulando I e O para não confundir com números 1 e 0)
letras_lotes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q']
textos_dos_lotes = {}

# Fazer o robô parecer um navegador de verdade (senão o site pode bloquear)
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

print("\n🚀 Iniciando a busca no site 164custom.com...")

# 2. Navegar no site e extrair os textos
for letra in letras_lotes:
    url = f"https://164custom.com/hot-wheels/case-{letra}/2026.html"
    print(f"Buscando Lote {letra.upper()}...")
    
    try:
        resposta = requests.get(url, headers=headers, timeout=10)
        
        # Se a página existir (Código 200)
        if resposta.status_code == 200:
            soup = BeautifulSoup(resposta.text, 'html.parser')
            # Pega todo o texto da página e transforma em letras minúsculas
            texto_pagina = soup.get_text(separator=' ', strip=True).lower()
            textos_dos_lotes[letra.upper()] = texto_pagina
            print(f"  ✅ Lote {letra.upper()} baixado com sucesso!")
            
        # Se a página ainda não existir (Código 404 - ex: Lote P e Q que ainda não lançaram)
        elif resposta.status_code == 404:
            print(f"  ⚠️ Lote {letra.upper()} ainda não lançado no site.")
            
    except Exception as e:
        print(f"  ❌ Erro de conexão no Lote {letra.upper()}: {e}")
    
    # Pausa de 1 segundo para não sobrecarregar/derrubar o site deles
    time.sleep(1)

print("\nCruzando os dados do site com os seus carrinhos de 2026...")

# 3. Cruzar as informações
carros_atualizados = 0

for carro in dados:
    # Só queremos olhar para os carros de 2026 que ainda estão sem lote
    if carro.get('year') == 2026 and not carro.get('cas'):
        nome_carro = carro.get('name', '').lower().strip()
        
        if not nome_carro:
            continue
            
        # Procurar em qual página o nome deste carro aparece
        for lote, texto_pagina in textos_dos_lotes.items():
            # Se o nome do carro estiver no texto da página, achamos o lote!
            if nome_carro in texto_pagina:
                carro['cas'] = lote
                carros_atualizados += 1
                break # Para a busca e vai para o próximo carro

print(f"\n🎉 MÁGICA CONCLUÍDA! {carros_atualizados} lotes foram preenchidos sozinhos.")

# 4. Salvar o resultado
texto_final = "export const hwData = " + json.dumps(dados, indent=4, ensure_ascii=False) + ";"

with open(ficheiro_final, 'w', encoding='utf-8') as f:
    f.write(texto_final)

print(f"Tudo salvo perfeitamente no arquivo '{ficheiro_final}'! 🚀")