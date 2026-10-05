const DESTINATION = 'jammehoumarou@gmail.com';
const SENDER = 'commercial@magicscript.fr';
const MAX_LENGTH = 4000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
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
  })[character]);
}

export async function onRequestPost({ request, env }) {
  if (!env.EMAIL) return json({ ok: false, error: 'email_not_configured' }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  if (text(payload.website)) return json({ ok: true });

  const name = text(payload.nom);
  const phone = text(payload.telephone);
  const email = text(payload.email);
  const mission = text(payload.mission);
  const message = text(payload.message);

  if (!name || !phone || !mission || !message || !/^\S+@\S+\.\S+$/.test(email)) {
    return json({ ok: false, error: 'invalid_fields' }, 400);
  }

  if ([name, phone, email, mission, message].some((value) => value.length > MAX_LENGTH)) {
    return json({ ok: false, error: 'field_too_long' }, 413);
  }

  const subject = `Demande de mission - ${name.replace(/[\r\n]/g, ' ')}`;
  const plainText = [
    'Nouvelle demande depuis le site Safiu Protection',
    '',
    `Nom : ${name}`,
    `Téléphone : ${phone}`,
    `Email : ${email}`,
    `Type de mission : ${mission}`,
    '',
    `Message : ${message}`,
  ].join('\n');
  const html = `<h2>Nouvelle demande depuis le site Safiu Protection</h2><p><strong>Nom :</strong> ${escapeHtml(name)}<br><strong>Téléphone :</strong> ${escapeHtml(phone)}<br><strong>Email :</strong> ${escapeHtml(email)}<br><strong>Type de mission :</strong> ${escapeHtml(mission)}</p><p><strong>Message :</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`;

  try {
    const result = await env.EMAIL.send({
      to: DESTINATION,
      from: SENDER,
      replyTo: email,
      subject,
      text: plainText,
      html,
    });
    return json({ ok: true, messageId: result.messageId });
  } catch (error) {
    console.error('Safiu contact email failed', error);
    return json({ ok: false, error: 'email_send_failed' }, 502);
  }
}
