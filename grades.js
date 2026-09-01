const express = require('express');
const router = express.Router();
const db = require('../db');
const { decrypt } = require('../services/encryption');
const { fetchGrades } = require('../services/golestanScraper');
const { sendTelegramMessage } = require('../services/notifier');

// خوندن فوری نمرات یک کاربر (درخواست دستی از فرانت‌اند)
router.get('/:studentId', async (req, res) => {
  const user = db.getUser(req.params.studentId);
  if (!user) return res.status(404).json({ ok: false, error: 'کاربر ثبت نشده.' });

  try {
    const password = decrypt(user.encryptedPassword);
    const grades = await fetchGrades(user.studentId, password);
    db.upsertUser(user.studentId, { lastGrades: grades, lastCheckedAt: new Date().toISOString() });
    res.json({ ok: true, grades });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// این تابع رو کرون‌جاب توی index.js صدا می‌زنه؛ نمرات جدید رو با قبلی مقایسه
// می‌کنه و اگه چیزی عوض شده بود نوتیفیکیشن می‌فرسته.
async function checkAllUsersForNewGrades() {
  const users = db.getAllUsers();
  for (const studentId of Object.keys(users)) {
    const user = users[studentId];
    try {
      const password = decrypt(user.encryptedPassword);
      const newGrades = await fetchGrades(studentId, password);
      const oldGrades = user.lastGrades || [];

      const changed = newGrades.filter(ng =>
        !oldGrades.some(og => og.course === ng.course && og.grade === ng.grade)
      );

      if (changed.length && user.telegramChatId) {
        const text = changed.map(g => `${g.course}: ${g.grade}`).join('\n');
        await sendTelegramMessage(user.telegramChatId, `نمره جدید اعلام شد:\n${text}`);
      }

      db.upsertUser(studentId, { lastGrades: newGrades, lastCheckedAt: new Date().toISOString() });
    } catch (e) {
      console.error(`خطا در بررسی نمرات ${studentId}:`, e.message);
    }
  }
}

module.exports = { router, checkAllUsersForNewGrades };
