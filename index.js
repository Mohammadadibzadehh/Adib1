require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const authRoutes = require('./routes/auth');
const { router: gradesRouter, checkAllUsersForNewGrades } = require('./routes/grades');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/grades', gradesRouter);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'adib-server' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`adib-server روی پورت ${PORT} در حال اجراست`);
});

// هر N دقیقه یک‌بار همه کاربرها رو برای نمره جدید چک کن
const intervalMin = parseInt(process.env.CHECK_INTERVAL_MINUTES || '30', 10);
cron.schedule(`*/${intervalMin} * * * *`, () => {
  console.log('در حال بررسی نمرات جدید برای همه کاربرها...');
  checkAllUsersForNewGrades();
});
