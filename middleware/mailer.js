/**
 * Envoi d'emails via nodemailer (SMTP configurable)
 * Variables .env requises :
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * Sans config → log console uniquement (mode dev)
 */
const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transporter;
}

/**
 * Envoyer une newsletter à une liste d'emails
 * @param {string[]} emails
 * @param {string} subject
 * @param {string} html
 * @param {string} unsubscribeBase  ex: "https://ton-site.com/api/notifications/newsletter/unsubscribe"
 */
async function sendNewsletter(emails, subject, html, unsubscribeBase) {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@michino.com';

  if (!t) {
    console.log(`[mailer] SMTP non configuré — email simulé\nSujet: ${subject}\nDestinataires: ${emails.length}`);
    return { sent: emails.length, failed: 0, simulated: true };
  }

  let sent = 0, failed = 0;
  for (const email of emails) {
    try {
      const unsubLink = unsubscribeBase
        ? `${unsubscribeBase}?email=${encodeURIComponent(email)}`
        : null;
      const footer = unsubLink
        ? `<p style="color:#888;font-size:11px;margin-top:24px">
             <a href="${unsubLink}" style="color:#888">Se désabonner</a>
           </p>`
        : '';
      await t.sendMail({
        from,
        to: email,
        subject,
        html: html + footer,
      });
      sent++;
    } catch (e) {
      console.warn(`[mailer] Échec envoi à ${email}:`, e.message);
      failed++;
    }
  }
  return { sent, failed };
}

/**
 * Email de confirmation d'inscription newsletter
 */
async function sendWelcomeEmail(email, name) {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@michino.com';
  const siteUrl = process.env.SITE_URL || 'https://michino.onrender.com';

  if (!t) {
    console.log(`[mailer] Welcome email simulé pour ${email}`);
    return;
  }

  await t.sendMail({
    from,
    to: email,
    subject: '🎵 Bienvenue sur MichiNo- !',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#111;color:#fff;border-radius:12px;padding:32px">
        <h1 style="color:#ff4500;font-size:1.6rem;margin-bottom:8px">MichiNo-</h1>
        <p>Bonjour ${name || 'ami de la musique'} 👋</p>
        <p>Tu es maintenant inscrit à la newsletter <strong>MichiNo-</strong> — la plateforme Afrobeat & musique africaine.</p>
        <p>Tu recevras les dernières sorties, clips et actus directement ici.</p>
        <a href="${siteUrl}" style="display:inline-block;margin-top:16px;background:#ff4500;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">
          🎵 Écouter maintenant
        </a>
        <p style="color:#888;font-size:11px;margin-top:24px">
          <a href="${siteUrl}/api/notifications/newsletter/unsubscribe?email=${encodeURIComponent(email)}" style="color:#888">Se désabonner</a>
        </p>
      </div>
    `,
  }).catch(e => console.warn('[mailer] Welcome email failed:', e.message));
}

module.exports = { sendNewsletter, sendWelcomeEmail };
