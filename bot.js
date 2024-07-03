const { google } = require("googleapis");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config(); // Завантажуємо змінні середовища з .env

// Отримуємо токен з .env файлу
const token = process.env.TELEGRAM_BOT_TOKEN;

// Перевірка, чи зчитано токен з .env файлу
if (!token) {
  console.error("Не вдалося зчитати TELEGRAM_BOT_TOKEN з .env файлу.");
  process.exit(1); // Вихід з програми з кодом помилки
}

// Створюємо екземпляр бота
const bot = new TelegramBot(token, { polling: true });

// Масив питань для опитування
const questions = [
  "Як вас звати?",
  "Яка ваша посада?",
  "Яка ваша електронна пошта?",
  "Який ваш номер телефону?",
  "Що б ви хотіли покращити в нашій компанії?",
];

let currentQuestionIndex = -1; // Індекс поточного питання (-1, оскільки спочатку ми збираємо інформацію про чат)
let chatId; // Зберігаємо id чату для взаємодії з користувачем

// Налаштовуємо Google Sheets API
const keys = require("./credentials.json");

const auth = new google.auth.GoogleAuth({
  keyFile: "./credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// ID таблиці Google Sheets
const spreadsheetId = "1tqFppIRYQ3rchwECFvytaAd973vjxfQQjcZqdV48sEQ";

// Функція для збереження відповіді у Google Sheets
async function saveAnswer(question, answer) {
  const data = {
    question: question,
    answer: answer,
    timestamp: new Date().toISOString(),
  };

  const values = [[data.question, data.answer, data.timestamp]];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "tgbot!A:C", // Використовуємо правильний формат діапазону
      valueInputOption: "RAW",
      resource: {
        values,
      },
    });
    console.log("Відповідь збережено у Google Sheets");

    // Після збереження відповіді, надсилаємо наступне питання
    sendNextQuestion();
  } catch (err) {
    console.error("Помилка при збереженні відповіді у Google Sheets:", err);
  }
}

// Функція для надсилання наступного питання
function sendNextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex < questions.length) {
    if (chatId) {
      setTimeout(() => {
        bot
          .sendMessage(chatId, questions[currentQuestionIndex])
          .catch((err) => {
            console.error("Помилка при надсиланні повідомлення:", err);
          });
      }, 1000); // Затримка у 1 секунду перед надсиланням наступного питання
    } else {
      console.log("Не вдалося знайти chatId. Питання не буде відправлене.");
    }
  } else {
    // Якщо всі питання вже задані, виконуємо необхідні дії
    sendFinalMessage();
  }
}

// Функція для надсилання останнього повідомлення після завершення опитування
function sendFinalMessage() {
  bot
    .sendMessage(chatId, "Записано. Дякую за ваші відповіді.")
    .then(() => {
      currentQuestionIndex = -1; // Скидаємо індекс, щоб можна було розпочати нове опитування
    })
    .catch((err) => {
      console.error("Помилка при надсиланні останнього повідомлення:", err);
    });
}

// Обробка команди /start
bot.onText(/\/start/, (msg) => {
  chatId = msg.chat.id; // Зберігаємо id чату
  currentQuestionIndex = -1; // Скидаємо індекс перед початком опитування

  // Вітаємо користувача перед початком опитування
  bot
    .sendMessage(chatId, "Привіт! Давайте розпочнемо опитування.")
    .then(() => {
      sendNextQuestion(); // Надсилаємо перше питання після команди /start
    })
    .catch((err) => {
      console.error("Помилка при надсиланні повідомлення:", err);
    });
});

// Обробка всіх повідомлень
bot.on("message", (msg) => {
  if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
    // Зберігаємо введені дані після кожного питання
    saveAnswer(questions[currentQuestionIndex], msg.text);
  }
});

console.log("Бот запущено");
