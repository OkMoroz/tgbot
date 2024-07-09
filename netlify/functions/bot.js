const { google } = require("googleapis");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const fs = require("fs");
const path = require("path");

// Отримуємо токен з .env файлу
const token = process.env.TELEGRAM_BOT_TOKEN;

// Перевірка, чи зчитано токен з .env файлу
if (!token) {
  console.error("Не вдалося зчитати TELEGRAM_BOT_TOKEN з .env файлу.");
  process.exit(1);
}

// Створюємо екземпляр бота
const bot = new TelegramBot(token, { polling: true });

// Масив питань для опитування
const questions = ["Введи свій ID"];

let currentQuestionIndex = -1; // Індекс поточного питання (-1, оскільки спочатку ми збираємо інформацію про чат)
let chatId; // Зберігаємо id чату для взаємодії з користувачем
let userID; // Зберігаємо електронну пошту користувача для подальшого використання

// Налаштовуємо Google Sheets API
const keys = require(path.resolve(__dirname, "./credentials.json"));

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(__dirname, "./credentials.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// ID таблиці Google Sheets
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

// Зчитуємо дані з файлу data.json
const employeesData = require(path.resolve(__dirname, "./data.json"));

// Функція для розрахунку залишкових днів відпустки для співробітника
function calculateRemainingVacationDays(employee) {
  const currentDate = new Date(); // Поточна дата
  const employmentStartDate = new Date(employee.Дата_прийняття_на_роботу); // Дата прийняття на роботу
  const usedVacationDays = employee.Використана_відпустка || 0; // Кількість використаних днів відпустки

  const monthsSinceEmployment =
    (currentDate.getFullYear() - employmentStartDate.getFullYear()) * 12 +
    (currentDate.getMonth() - employmentStartDate.getMonth());

  const accruedVacationDays =
    monthsSinceEmployment * employee.Відпустка_на_місяць; // Замість хардкодування 2 дні на місяць

  const remainingVacationDays = accruedVacationDays - usedVacationDays;

  const responseMessage = `
    Місяців з моменту прийняття на роботу: ${monthsSinceEmployment}
    Загальна кількість нагромаджених днів відпустки: ${accruedVacationDays}
    Кількість використаних днів відпустки: ${usedVacationDays}
    Залишилось днів відпустки: ${remainingVacationDays}
  `;

  return responseMessage.trim(); // Повертаємо рядок з інформацією (без зайвих пробілів)
}

async function saveAnswer(question, answer, ID) {
  const employee = employeesData.find((emp) => emp.ID === ID);

  if (!employee) {
    console.error(
      `Працівника з електронною поштою ${ID} не знайдено у базі даних.`
    );
    return;
  }

  const now = new Date();
  const data = {
    question: question,
    answer: answer,
    timestamp: now.toISOString().slice(0, 16), // Отримання дати у вказаному форматі без секунд і мілісекунд
  };

  if (questions[currentQuestionIndex] === "Електронна пошта") {
    userID = answer;
  }

  const remainingVacationDays = calculateRemainingVacationDays(employee);

  const values = [
    [data.question, data.answer, data.timestamp, remainingVacationDays],
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `tgbot!A:D`,
      valueInputOption: "RAW",
      resource: {
        values,
      },
    });
    console.log("Відповідь збережено у Google Sheets");

    sendNextQuestion(userID);
  } catch (err) {
    console.error("Помилка при збереженні відповіді у Google Sheets:", err);
  }
}

function sendNextQuestion(email) {
  currentQuestionIndex++;
  if (currentQuestionIndex < questions.length) {
    if (chatId) {
      setTimeout(() => {
        let messageToSend = questions[currentQuestionIndex];
        bot.sendMessage(chatId, messageToSend).catch((err) => {
          console.error("Помилка при надсиланні повідомлення:", err);
        });
      }, 1000);
    } else {
      console.log("Не вдалося знайти chatId. Питання не буде відправлене.");
    }
  } else {
    sendFinalMessage(userID);
  }
}

function sendFinalMessage(email) {
  const employee = employeesData.find((emp) => emp.Пошта === email);
  const remainingVacationDays = calculateRemainingVacationDays(employee);
  bot
    .sendMessage(chatId, `Дякую.  ${remainingVacationDays} `)
    .then(() => {
      currentQuestionIndex = -1; // Скидаємо індекс, щоб можна було розпочати нове опитування
    })
    .catch((err) => {
      console.error("Помилка при надсиланні останнього повідомлення:", err);
    });
}

bot.onText(/\/start/, (msg) => {
  chatId = msg.chat.id; // Зберігаємо id чату
  currentQuestionIndex = -1; // Скидаємо індекс перед початком опитування

  bot
    .sendMessage(chatId, "Давай розпочнемо :)")
    .then(() => {
      sendNextQuestion(userID); // Надсилаємо перше питання після команди /start
    })
    .catch((err) => {
      console.error("Помилка при надсиланні повідомлення:", err);
    });
});

bot.on("message", (msg) => {
  if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
    if (msg.from.id === chatId) {
      userID = msg.text; // Введений ID користувача

      saveAnswer(questions[currentQuestionIndex], userID, userID);
    }
  }
});

console.log("Бот запущено");

module.exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Telegram bot is running",
    }),
  };
};
console.log("Бот запущено");
