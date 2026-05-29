from PIL import Image
import os

def gerar_icones_pwa(arquivo_origem):
    if not os.path.exists(arquivo_origem):
        print(f"❌ Erro: O arquivo '{arquivo_origem}' não foi encontrado.")
        print("Certifique-se de que este script está na mesma pasta que o seu favicon.ico.")
        return

    try:
        # Abre a imagem original
        print(f"📖 Lendo {arquivo_origem}...")
        img = Image.open(arquivo_origem)

        # Garante que está no modo RGBA para preservar transparência, se houver
        if img.mode != 'RGBA':
            img = img.convert('RGBA')

        # Resoluções necessárias para o PWA
        tamanhos = [192, 512]

        for tamanho in tamanhos:
            nome_saida = f"icon-{tamanho}.png"
            print(f"📐 Redimensionando e salvando {nome_saida}...")
            
            # Usamos Resampling.LANCZOS para a melhor qualidade possível no redimensionamento
            # Se você estiver usando uma versão muito antiga do Pillow, use Image.ANTIALIAS
            img_redimensionada = img.resize((tamanho, tamanho), Image.Resampling.LANCZOS)
            
            # Salva o arquivo na pasta assets/img/ (vamos criar se não existir)
            pasta_destino = os.path.join("assets", "img")
            if not os.path.exists(pasta_destino):
                os.makedirs(pasta_destino)
                print(f"📁 Pasta '{pasta_destino}' criada.")

            caminho_final = os.path.join(pasta_destino, nome_saida)
            img_redimensionada.save(caminho_final, "PNG")

        print("\n✅ Sucesso! Os ícones foram gerados e salvos em 'assets/img/'.")
        print("Você já pode deletar este script.")

    except Exception as e:
        print(f"❌ Ocorreu um erro inesperado: {e}")

if __name__ == "__main__":
    # Nome do arquivo que você me enviou
    gerar_icones_pwa("favicon.ico")