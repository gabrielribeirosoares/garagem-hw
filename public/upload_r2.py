import os
import boto3

# Preencha com suas chaves do R2
R2_ENDPOINT_URL = "https://9af2e8bde9c67488b50180c7d0fede5b.r2.cloudflarestorage.com"
R2_ACCESS_KEY = "ca515660b434a41379e2e182423a9b15"
R2_SECRET_KEY = "2d5578d6495312b694a3d7d61e175339b7bf2242699c7b4eb11d60b7a4ff17e8"
R2_BUCKET_NAME = "garagemhw-db"

# Pasta onde suas imagens estão salvas
pasta_imagens = os.path.join("imagens_miniaturas")

s3_client = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY
)

# Verifica se a pasta existe
if not os.path.exists(pasta_imagens):
    print(f"Erro: Pasta '{pasta_imagens}' não encontrada.")
    exit()

arquivos = os.listdir(pasta_imagens)
total_arquivos = len(arquivos)
print(f"Iniciando upload de {total_arquivos} arquivos para o R2...")

for i, arquivo in enumerate(arquivos, 1):
    caminho_local = os.path.join(pasta_imagens, arquivo)
    
    # Verifica se é arquivo (ignora subpastas)
    if os.path.isfile(caminho_local):
        # A chave é o caminho que o arquivo terá DENTRO do bucket
        # Ex: Vai ficar direto na raiz do bucket ou dentro de uma pasta?
        # Aqui, vamos subir direto na raiz, mantendo apenas o nome do arquivo.
        chave_r2 = arquivo 
        
        try:
            print(f"[{i}/{total_arquivos}] Subindo {arquivo}...")
            s3_client.upload_file(
                Filename=caminho_local,
                Bucket=R2_BUCKET_NAME,
                Key=chave_r2,
                ExtraArgs={'ContentType': 'image/jpeg'} # Ajuda os navegadores a renderizarem
            )
        except Exception as e:
            print(f"Erro ao subir {arquivo}: {e}")

print("Upload finalizado!")