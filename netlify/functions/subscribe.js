exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { nome, email, whatsapp, profissao } = body;

  if (!nome || !email || !whatsapp || !profissao) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Campos obrigatórios ausentes' }) };
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = 5;

  // Converte "(11) 99999-9999" → "+5511999999999"
  const whatsappFormatado = '+55' + whatsapp.replace(/\D/g, '');

  const headers = {
    'api-key': apiKey,
    'Content-Type': 'application/json',
    'accept': 'application/json',
  };

  const attributes = { NOME: nome, WHATSAPP: whatsappFormatado, PROFISSAO: profissao };

  try {
    // Tenta criar o contato
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, attributes, listIds: [listId] }),
    });

    if (res.ok || res.status === 204) {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    const err = await res.json().catch(() => ({}));

    // Contato já existe: atualiza atributos e adiciona à lista
    if (res.status === 400 && err.code === 'duplicate_parameter') {
      const emailEncoded = encodeURIComponent(email);

      await fetch(`https://api.brevo.com/v3/contacts/${emailEncoded}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ attributes, listIds: [listId] }),
      });

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Erro no Brevo' }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
