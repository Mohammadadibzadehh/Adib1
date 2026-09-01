// دیتابیس ساده مبتنی بر فایل JSON — برای شروع کافیه.
// وقتی تعداد کاربرا زیاد شد، بهتره به SQLite یا Postgres مهاجرت کنی.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'users.json');

function readAll() {
  if (!fs.existsSync(DB_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function upsertUser(studentId, fields) {
  const all = readAll();
  all[studentId] = { ...(all[studentId] || {}), ...fields };
  writeAll(all);
  return all[studentId];
}

function getUser(studentId) {
  const all = readAll();
  return all[studentId] || null;
}

function getAllUsers() {
  return readAll();
}

function deleteUser(studentId) {
  const all = readAll();
  delete all[studentId];
  writeAll(all);
}

module.exports = { upsertUser, getUser, getAllUsers, deleteUser };
