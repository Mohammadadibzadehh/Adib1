FROM node:20-slim

# نصب کرومیوم و کتابخانه‌های موردنیازش برای اجرای headless
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto \
    fonts-noto-cjk \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# مسیر کرومیوم نصب‌شده — همون چیزیه که CHROME_EXECUTABLE_PATH باید بهش اشاره کنه
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .

EXPOSE 3000
CMD ["node", "src/index.js"]
