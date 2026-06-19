// api/photo-proxy.js
import fetch from 'node-fetch'; // Certifique-se de que 'node-fetch' está no seu package.json

export default async function handler(req, res) {
  const { image } = req.query;
  if (!image) return res.status(400).json({ error: 'Nenhuma URL de imagem fornecida.' });

  try {
    const response = await fetch(decodeURIComponent(image));
    if (!response.ok) throw new Error("Falha ao buscar a imagem de origem.");

    const buffer = await response.buffer();
    res.setHeader('Content-Type', response.headers.get('content-type'));
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'Falha ao buscar a foto no servidor de origem.' });
  }
}