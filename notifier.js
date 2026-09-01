// ارسال نوتیفیکیشن از طریق ربات تلگرام (ساده‌ترین و بدون‌نیاز-به-دامنه‌ترین روش).
//
// راه‌اندازی:
// 1) در تلگرام به @BotFather پیام بده و /newbot رو بزن، یه توکن می‌گیری.
// 2) توکن رو در .env به عنوان TELEGRAM_BOT_TOKEN بذار.
// 3) کاربر باید یک بار به ربات پیام بده تا chatId ش به دست بیاد
//    (با فراخوانی getUpdates می‌تونی chatId رو پیدا کنی).

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN تنظیم نشده — نوتیفیکیشن ارسال نشد.');
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('ارسال پیام تلگرام ناموفق بود:', body);
  }
}

module.exports = { sendTelegramMessage };
