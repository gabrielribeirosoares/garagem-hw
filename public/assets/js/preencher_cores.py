import json
import time
import requests
import os
from io import BytesIO
from PIL import Image
from google import genai

# ==========================================
# CONFIGURAÇÃO DA API (NOVA VERSÃO)
# ==========================================
# Substitua pela sua chave gerada no Google AI Studio
client = genai.Client(api_key="AIzaSyCfsJwrieE7i-S32hs8zmhzZviVIjQHQKg")

# Garante que o Python procure os arquivos na mesma pasta onde este script está salvo
DIRETORIO_ATUAL = os.path.dirname(os.path.abspath(__file__))
CAMINHO_ENTRADA = os.path.join(DIRETORIO_ATUAL, 'data.js')
CAMINHO_SAIDA = os.path.join(DIRETORIO_ATUAL, 'data_atualizado.js')

# ==========================================
# FUNÇÕES DE APOIO
# ==========================================
def extrair_json_do_js(caminho_arquivo):
    """Lê o arquivo .js e extrai apenas a lista em formato JSON."""
    with open(caminho_arquivo, 'r', encoding='utf-8') as f:
        conteudo = f.read()

    # Remove a declaração da constante para o Python tratar como JSON puro
    conteudo_json = conteudo.replace("export const RAW = ", "").strip()
    if conteudo_json.endswith(";"):
        conteudo_json = conteudo_json[:-1]

    return json.loads(conteudo_json)

def salvar_js(dados, caminho_arquivo):
    """Salva os dados atualizados de volta no formato .js."""
    with open(caminho_arquivo, 'w', encoding='utf-8') as f:
        f.write("export const RAW = " + json.dumps(dados, indent=2, ensure_ascii=False) + ";\n")

def analisar_cor(url_imagem):
    """Baixa a imagem, reduz o tamanho e pede para o Gemini identificar a cor."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(url_imagem, headers=headers, timeout=10)

        if response.status_code != 200:
            print(f" -> Imagem indisponível (Erro {response.status_code}). Pulando...")
            return ""

        # Abre a imagem
        img = Image.open(BytesIO(response.content))

        # 1. COMPRESSÃO DA IMAGEM: Reduz as dimensões para não estourar o limite da API
        img.thumbnail((512, 512)) # Reduz para no máximo 512x512 pixels mantendo a proporção

        # 2. Converte para RGB (evita erros com imagens PNG que tenham fundo transparente)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        prompt = "Analise esta imagem de um carrinho em miniatura. Responda APENAS com o nome da cor predominante da carroceria em português (ex: Vermelho, Azul, Preto, Branco, Verde, Laranja, Prata, Dourado). Não escreva frases, apenas a cor."

        resposta = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt, img]
        )
        return resposta.text.strip().capitalize()

    except Exception as e:
        print(f" -> Falha ao analisar: {e}")
        return ""


def iniciar_automacao():
    # Agora a entrada e a saída são o mesmo ficheiro para continuar de onde parou
    CAMINHO_ARQUIVO = os.path.join(DIRETORIO_ATUAL, 'data.js')

    print(f"Procurando arquivo em: {CAMINHO_ARQUIVO}")

    if not os.path.exists(CAMINHO_ARQUIVO):
        print("ERRO CRÍTICO: O arquivo data.js não foi encontrado nesta pasta.")
        return

    print("Carregando o banco de dados...")
    dados = extrair_json_do_js(CAMINHO_ARQUIVO)
    total_carros = len(dados)

    # ==========================================
    # CONFIGURAÇÃO DOS LOTES
    # ==========================================
    tamanho_do_lote = 50 # O script vai salvar no disco a cada 50 carros identificados
    processados_no_lote = 0
    total_processados = 0

    print(f"Total de registros encontrados: {total_carros}")
    print("Iniciando processamento contínuo... Pressione Ctrl+C para parar com segurança.")
    print("-" * 40)

    try:
        for i, carro in enumerate(dados):
            # Só analisa se ainda não tiver cor e tiver imagem
            if carro.get("color") == "" and carro.get("image"):
                print(f"[{i+1}/{total_carros}] Analisando {carro.get('name')}...")

                cor_encontrada = analisar_cor(carro["image"])

                if cor_encontrada:
                    print(f" -> Cor identificada: {cor_encontrada}")
                    carro["color"] = cor_encontrada
                    processados_no_lote += 1
                    total_processados += 1

                    # SALVAMENTO AUTOMÁTICO EM LOTES
                    if processados_no_lote >= tamanho_do_lote:
                        print(f"\n[+] Lote de {tamanho_do_lote} atingido! Salvando progresso no data.js...")
                        salvar_js(dados, CAMINHO_ARQUIVO)
                        processados_no_lote = 0 # Zera o contador para o próximo lote
                        print("Progresso salvo! Continuando o trabalho...\n")

                    # Pausa de 3 segundos para não sobrecarregar o Google
                    time.sleep(3)

        # Quando o loop terminar de analisar todos os 100k carros, salva o restinho que sobrou
        if processados_no_lote > 0:
            print("\n[+] Salvando os últimos carrinhos restantes...")
            salvar_js(dados, CAMINHO_ARQUIVO)

        print("-" * 40)
        print(f"Processo 100% finalizado! {total_processados} novas cores foram adicionadas ao sistema.")

    except KeyboardInterrupt:
        # SISTEMA DE SEGURANÇA: Se você apertar Ctrl+C no terminal, ele salva antes de fechar!
        print("\n\n[!] Script interrompido manualmente. Salvando os carros já processados...")
        salvar_js(dados, CAMINHO_ARQUIVO)
        print("Progresso salvo com segurança. Você pode rodar o script novamente depois.")

if __name__ == "__main__":
    iniciar_automacao()