const { google } = require("googleapis");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api"); // Import TelegramBot class
require("dotenv").config(); // Load environment variables from .env

// Retrieve token from .env file
const token = process.env.TELEGRAM_BOT_TOKEN;

// Create bot instance
const bot = new TelegramBot(token, { polling: true });

// Array of survey questions
const questions = [
  "What is your name?",
  "What is your position?",
  "What is your email address?",
  "What is your phone number?",
  "What would you like to improve in our company?",
];

let currentQuestionIndex = -1; // Index of current question (-1 initially as we gather chat information)
let chatId; // Store chat id for interaction with user

// Google Sheets API setup
const keys = require("./credentials.json");

const auth = new google.auth.GoogleAuth({
  keyFile: "./path-to-your-credentials-file.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// Spreadsheet ID
const spreadsheetId =
  "1tqFppIRYQ3rchwECFvytaAd973vjxfQQjcZqdV48sEQ/edit?gid=0#gid=0";

// Function to save response to Google Sheets
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
      range: "Sheet1!A:C",
      valueInputOption: "RAW",
      resource: {
        values,
      },
    });
    console.log("Response saved to Google Sheets");

    // After saving response, send the next question
    sendNextQuestion();
  } catch (err) {
    console.error("Error saving response to Google Sheets:", err);
  }
}

// Function to send the next question
function sendNextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex < questions.length) {
    if (chatId) {
      setTimeout(() => {
        bot
          .sendMessage(chatId, questions[currentQuestionIndex])
          .then(() => {
            // After successfully sending question, await response
          })
          .catch((err) => {
            console.error("Error sending message:", err);
          });
      }, 1000); // 1-second delay before sending the next question
    } else {
      console.log("Unable to find chatId. Question will not be sent.");
    }
  } else {
    // If all questions have been asked, perform necessary actions
    sendFinalMessage();
  }
}

// Function to send final message after survey completion
function sendFinalMessage() {
  bot
    .sendMessage(chatId, "Recorded. Thank you for your responses.")
    .then(() => {
      currentQuestionIndex = -1; // Reset index to start a new survey
    })
    .catch((err) => {
      console.error("Error sending final message:", err);
    });
}

// Handling the /start command
bot.onText(/\/start/, (msg) => {
  chatId = msg.chat.id; // Store chat id
  currentQuestionIndex = -1; // Reset index before starting survey

  // Greet user before starting survey
  bot
    .sendMessage(chatId, "Hello! Let's start the survey.")
    .then(() => {
      sendNextQuestion(); // Send the first question after /start command
    })
    .catch((err) => {
      console.error("Error sending message:", err);
    });
});

// Handling all messages
bot.on("message", (msg) => {
  if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
    // Save input data after each question
    saveAnswer(questions[currentQuestionIndex], msg.text);
  }
});

console.log("Bot started");
