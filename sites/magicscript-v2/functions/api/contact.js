const MAX_LENGTHS = {
  nom: 160,
  email: 254,
  activite: 200,
  telephone: 40,
  message: 4000,
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ ok: false, error: 'invalid_origin' }, 403);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  if (text(payload?.website)) return json({ ok: true });

  const fields = Object.fromEntries(Object.keys(MAX_LENGTHS).map((key) => [key, text(payload?.[key])]));
  if (!fields.nom || !fields.activite || !fields.message || !/^\S+@\S+\.\S+$/.test(fields.email)) {
    return json({ ok: false, error: 'invalid_fields' }, 400);
  }
  if (Object.entries(fields).some(([key, value]) => value.length > MAX_LENGTHS[key])) {
    return json({ ok: false, error: 'field_too_long' }, 413);
  }

  // Keep previews and local development non-transmitting until the owner enables reception.
  if (env.CONTACT_EMAIL_ENABLED !== 'true' || !env.EMAIL) {
    return json({ ok: false, error: 'email_not_configured' }, 503);
  }

  const destination = text(env.CONTACT_TO);
  const sender = text(env.CONTACT_FROM);
  if (!destination || !sender) return json({ ok: false, error: 'email_not_configured' }, 503);

  const subject = `Projet web - ${fields.nom.replace(/[\r\n]/g, ' ')}`;
  const plainText = [
    'Nouvelle demande depuis le site Magic Script',
    '',
    `Nom : ${fields.nom}`,
    `Email : ${fields.email}`,
    `Activité : ${fields.activite}`,
    `Téléphone : ${fields.telephone || 'Non renseigné'}`,
    '',
    `Message : ${fields.message}`,
  ].join('\n');
  const html = `<h2>Nouvelle demande depuis le site Magic Script</h2><p><strong>Nom :</strong> ${escapeHtml(fields.nom)}<br><strong>Email :</strong> ${escapeHtml(fields.email)}<br><strong>Activité :</strong> ${escapeHtml(fields.activite)}<br><strong>Téléphone :</strong> ${escapeHtml(fields.telephone || 'Non renseigné')}</p><p><strong>Message :</strong><br>${escapeHtml(fields.message).replace(/\n/g, '<br>')}</p>`;

  try {
    const result = await env.EMAIL.send({
      to: destination,
      from: sender,
      replyTo: fields.email,
      subject,
      text: plainText,
      html,
    });
    return json({ ok: true, messageId: result?.messageId ?? null });
  } catch (error) {
    console.error('Magic Script contact email failed', error);
    return json({ ok: false, error: 'email_send_failed' }, 502);
  }
}
