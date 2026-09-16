const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
const ALLOWED_CHAT_IDS = (process.env.ALLOWED_CHAT_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .map(Number);

const CODE_TTL_MS = 5 * 60 * 1000; // 5 menit

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isAllowed(chatId) {
  if (ALLOWED_CHAT_IDS.length === 0) return true;
  return ALLOWED_CHAT_IDS.includes(chatId);
}

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function saveLoginCode(code, chatId) {
  const res = await fetch(`${FIREBASE_DB_URL}/login_codes/${code}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, expiresAt: Date.now() + CODE_TTL_MS })
  });
  if (!res.ok) throw new Error('Gagal simpan kode ke Firebase: ' + res.status);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'Guardline Kids bot webhook aktif.' };
  }

  if (!BOT_TOKEN || !FIREBASE_DB_URL) {
    console.error('TELEGRAM_BOT_TOKEN / FIREBASE_DB_URL belum diisi di environment variables Netlify.');
    return { statusCode: 200, body: 'ok' };
  }

  let update;
  try {
    update = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Bad request' };
  }

  const message = update.message;
  if (!message || !message.text) {
    return { statusCode: 200, body: 'ok' };
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  try {
    if (text === '/start') {
      await sendMessage(
        chatId,
        `Halo! Ini bot login Guardline Kids.\n\nChat ID kamu: ${chatId}\n\nKetik /login untuk dapat kode masuk ke panel.`
      );
    } else if (text === '/login') {
      if (!isAllowed(chatId)) {
        await sendMessage(chatId, 'Maaf, chat ID kamu belum terdaftar untuk pakai bot ini.');
      } else {
        const code = generateCode();
        await saveLoginCode(code, chatId);
        await sendMessage(
          chatId,
          `Kode login kamu: ${code}\nBerlaku 5 menit. Masukkan di halaman login panel Guardline Kids.`
        );
      }
    }
  } catch (e) {
    console.error(e);
  }

  return { statusCode: 200, body: 'ok' };
};
