const express = require('express');
const router = express.Router();
const { encrypt } = require('../services/encryption');
const db = require('../db');

// ثبت / به‌روزرسانی اطلاعات ورود گلستان (رمزنگاری‌شده ذخیره می‌شه)
router.post('/login', (req, res) => {
  const { studentId, password, telegramChatId } = req.body;
  if (!studentId || !password) {
    return res.status(400).json({ ok: false, error: 'studentId و password لازمه.' });
  }
  try {
    const encryptedPassword = encrypt(password);
    db.upsertUser(studentId, {
      studentId,
      encryptedPassword,
      telegramChatId: telegramChatId || null,
      lastGrades: db.getUser(studentId)?.lastGrades || [],
      updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// حذف کامل اطلاعات کاربر (رمز عبور و همه چیز)
router.delete('/:studentId', (req, res) => {
  db.deleteUser(req.params.studentId);
  res.json({ ok: true });
});

module.exports = router;
