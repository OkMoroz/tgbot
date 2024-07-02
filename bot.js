const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
require("dotenv").config(); // Завантаження змінних з .env

// Отримання токену з .env файлу
const token = process.env.TELEGRAM_BOT_TOKEN;

// Створюємо бота
const bot = new TelegramBot(token, { polling: true });

// Масив питань для опитування
const questions = [
  "Як вас звати?",
  "Яка ваша посада?",
  "Яка ваша електронна пошта?",
  "Який ваш номер телефону?",
  "Що ви б хотіли покращити у нашій компанії?",
];

let currentQuestionIndex = -1; // Індекс поточного питання (-1, оскільки спочатку ми збираємо інформацію про чат)
let chatId; // Зберігаємо id чату для взаємодії з користувачем

// Функція для збереження відповіді у файл
function saveAnswer(question, answer) {
  const data = {
    question: question,
    answer: answer,
    timestamp: new Date().toISOString(),
  };

  fs.readFile("responses.json", (err, fileData) => {
    if (err && err.code === "ENOENT") {
      // Якщо файл не існує, створюємо новий
      fs.writeFile("responses.json", JSON.stringify([data], null, 2), (err) => {
        if (err) throw err;
        console.log("Відповідь збережено");

        // Після збереження відповіді, надсилаємо наступне питання
        sendNextQuestion();
      });
    } else {
      // Якщо файл існує, додаємо нову відповідь
      const json = JSON.parse(fileData);
      json.push(data);
      fs.writeFile("responses.json", JSON.stringify(json, null, 2), (err) => {
        if (err) throw err;
        console.log("Відповідь збережено");

        // Після збереження відповіді, надсилаємо наступне питання
        sendNextQuestion();
      });
    }
  });
}

// Функція для надсилання наступного питання
function sendNextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex < questions.length) {
    if (chatId) {
      setTimeout(() => {
        bot
          .sendMessage(chatId, questions[currentQuestionIndex])
          .then(() => {
            // Після успішної відправки питання, очікуємо відповідь
          })
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

// Функція для відправлення останнього повідомлення після завершення опитування
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
