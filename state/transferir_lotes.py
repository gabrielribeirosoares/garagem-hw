import json
import re

def transferir_cases():
    print("🔄 Iniciando a transferência de Lotes (Cases)...")

    # 1. Carregar os dados de origem (hot_wheels_state.json)
    try:
        with open('hot_wheels_state.json', 'r', encoding='utf-8') as f:
            estado_data = json.load(f)
    except Exception as e:
        print(f"❌ Erro ao ler 'hot_wheels_state.json': {e}")
        return

    # 2. Criar "dicionários de busca" para achar os carros rapidamente
    # Vamos mapear tanto pelo código 'part' (mais preciso) quanto pelo 'name' (fallback)
    busca_por_part = {}
    busca_por_nome = {}

    for item in estado_data.get('items', []):
        lote = item.get('cas', '').strip()
        if lote: # Só guarda se o carro realmente tiver um lote cadastrado
            part = item.get('part', '').strip().upper()
            nome = item.get('name', '').strip().lower()

            if part:
                busca_por_part[part] = lote
            if nome:
                busca_por_nome[nome] = lote

    print(f"✅ Base de dados carregada: {len(busca_por_part)} carros mapeados com lote.")

    # 3. Ler o arquivo de destino (novo.txt)
    try:
        with open('novo.txt', 'r', encoding='utf-8') as f:
            conteudo_txt = f.read()
    except Exception as e:
        print(f"❌ Erro ao ler 'novo.txt': {e}")
        return

    # 4. Extrair apenas a parte JSON (removendo "export const RAW = ")
    # Usamos replace e tiramos o ponto e vírgula final se houver
    json_str = conteudo_txt.replace("export const RAW =", "").strip()
    if json_str.endswith(";"):
        json_str = json_str[:-1]

    # Converter o texto extraído para uma lista do Python
    try:
        lista_raw = json.loads(json_str)
    except Exception as e:
        print(f"❌ Erro ao processar o formato JSON dentro de 'novo.txt': {e}")
        return

    # 5. Cruzar os dados e preencher o "cas"
    carros_atualizados = 0

    for carro in lista_raw:
        # Se o lote estiver vazio, tentamos preencher
        if carro.get('cas') == "" or carro.get('cas') is None:
            part = carro.get('part', '').strip().upper()
            nome = carro.get('name', '').strip().lower()

            lote_encontrado = ""

            # Tenta achar primeiro pelo código exato
            if part and part in busca_por_part:
                lote_encontrado = busca_por_part[part]
            # Se não achar, tenta pelo nome
            elif nome and nome in busca_por_nome:
                lote_encontrado = busca_por_nome[nome]

            if lote_encontrado:
                carro['cas'] = lote_encontrado
                carros_atualizados += 1

    # 6. Salvar o resultado num novo arquivo
    try:
        with open('novo_atualizado.txt', 'w', encoding='utf-8') as f:
            f.write("export const RAW = ")
            # Salvamos formatado e garantimos que os acentos fiquem certos
            json.dump(lista_raw, f, indent=4, ensure_ascii=False)
            f.write(";")

        print(f"🎉 Concluído! {carros_atualizados} carros tiveram o lote atualizado.")
        print("📁 O arquivo 'novo_atualizado.txt' foi gerado com sucesso!")
    except Exception as e:
        print(f"❌ Erro ao salvar o novo arquivo: {e}")

if __name__ == "__main__":
    transferir_cases()