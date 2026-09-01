// اسکلت اتوماسیون ورود به گلستان و خوندن گزارش‌ها با puppeteer-core.
//
// نکته مهم: ساختار HTML سامانه گلستان بین دانشگاه‌های مختلف کمی فرق داره
// (هرکدوم نسخه‌ی خودشون رو دارن)، پس selectorهای دقیق زیر رو باید خودت
// با «Inspect Element» روی سایت گلستان دانشگاه خودت پیدا کنی و جای TODO بذاری.
//
// راهنمای عمومی معماری گلستان:
// - صفحه لاگین معمولا دو ورودی «شماره دانشجویی / شناسه کاربری» و «گذرواژه» داره.
// - بعد از ورود، محتوای اصلی داخل یک <iframe> بارگذاری می‌شه.
// - یک باکس «انتخاب گزارش سریع» هست که با تایپ شماره گزارش (مثلا 79 یا 278)
//   و زدن Enter، اون گزارش رو داخل iframe باز می‌کنه.

const puppeteer = require('puppeteer-core');

async function launchBrowser() {
  return puppeteer.launch({
    executablePath: process.env.CHROME_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

async function loginToGolestan(page, studentId, password) {
  const baseUrl = process.env.GOLESTAN_URL;
  if (!baseUrl) throw new Error('GOLESTAN_URL در فایل .env تنظیم نشده.');

  await page.goto(baseUrl, { waitUntil: 'networkidle2' });

  // TODO: این سه selector رو با مقادیر واقعی صفحه لاگین گلستان خودت جایگزین کن
  const USERNAME_SELECTOR = '#F51701'; // نمونه — باید تایید بشه
  const PASSWORD_SELECTOR = '#F51801'; // نمونه — باید تایید بشه
  const SUBMIT_SELECTOR = '#F51901';   // نمونه — باید تایید بشه

  await page.waitForSelector(USERNAME_SELECTOR, { timeout: 15000 });
  await page.type(USERNAME_SELECTOR, studentId, { delay: 30 });
  await page.type(PASSWORD_SELECTOR, password, { delay: 30 });
  await page.click(SUBMIT_SELECTOR);
  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
}

async function openReportByCode(page, reportCode) {
  // TODO: selector باکس «کد گزارش سریع» گلستان رو اینجا بذار
  const QUICK_REPORT_INPUT = '#quickReportBox'; // نمونه — باید تایید بشه
  await page.waitForSelector(QUICK_REPORT_INPUT, { timeout: 15000 });
  await page.click(QUICK_REPORT_INPUT, { clickCount: 3 });
  await page.type(QUICK_REPORT_INPUT, String(reportCode));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500); // بارگذاری داخل iframe زمان می‌بره
}

// گزارش 79 = کارنامه ترمی دانشجو
async function fetchGrades(studentId, password) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await loginToGolestan(page, studentId, password);
    await openReportByCode(page, 79);

    // TODO: چون گزارش داخل iframe بارگذاری می‌شه، باید فریم درست رو پیدا کنی:
    // const frame = page.frames().find(f => f.url().includes('Report'));
    // و بعد از اون فریم جدول نمرات رو استخراج کنی. نمونه‌ی کلی:
    //
    // const grades = await frame.evaluate(() => {
    //   const rows = Array.from(document.querySelectorAll('table tr'));
    //   return rows.map(r => {
    //     const cells = Array.from(r.querySelectorAll('td')).map(td => td.innerText.trim());
    //     return { course: cells[1], grade: cells[3] };
    //   }).filter(g => g.course);
    // });

    const grades = []; // TODO: جایگزین کن با استخراج واقعی از frame بالا
    return grades;
  } finally {
    await browser.close();
  }
}

module.exports = { fetchGrades, loginToGolestan, openReportByCode, launchBrowser };
