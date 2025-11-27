const { bot, ensureWebhook } = require('../bot');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, source: 'telegram-webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    await ensureWebhook();
    await bot.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ ok: false });
  }
};
