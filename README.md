# Receipt OCR Discord Bot

This is a Discord bot that extracts information from images of receipts using Optical Character Recognition (OCR). The bot currently supports extracting item names, prices, and quantities from receipts of the following merchants:
- AEON
- LOTUS'S

# Features
- Extracts item details from receipt images.
- Supports multiline item names and special formats (e.g., reduced prices).
- Handles different receipt formats for supported merchants.
- Processes receipts sent in Discord messages and replies with extracted details.

# Technologies Used
- Node.js: Backend runtime for the bot.
- Tesseract.js: JavaScript library for OCR processing.
- Discord.js: API to interact with Discord and handle bot functionalities.

# How It Works
1. The bot listens for image attachments in messages on Discord.
2. When an image of a receipt is sent, the bot downloads it and assigns a unique ID.
3. The bot uses Tesseract.js to process the image and extract text.
4. It parses the text to identify item names, prices, and quantities, taking into account special formatting rules for different merchants.
5. The bot sends a message back to the user with the extracted information.

# Supported Merchants
- AEON
- LOTUS'S (supports reduced prices and multiline item names).

# Usage
1. Invite the bot to your Discord server.
2. Send a message with an attached image of a receipt.
3. The bot will reply with the extracted details.

# Example
A receipt from LOTUS'S might be formatted like this:

```
09555663103205 LOTUSS TAT PAK CHOY
REDUCED PRICE 1.94
09556535537708 FIGO P.BUN 3.99
```

```yaml
Item: LOTUSS TAT PAK CHOY
Price: 1.94 (Reduced)
---
Item: FIGO P.BUN
Price: 3.99
```

# Setup
1. Clone the repository:
```bash
git clone https://github.com/your-username/receipt-ocr-discord-bot.git
cd receipt-ocr-discord-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with your Discord bot token:
```bash
DISCORD_TOKEN=your_discord_bot_token
```

4. Run the bot:
```bash
node index.js
```

# Future Improvements
- Add support for more merchants.
- Improve parsing logic to handle more complex receipt formats.
- Add additional item categories (e.g., discounts, taxes).

# Contributing
Contributions are welcome! Please open an issue or submit a pull request if you'd like to contribute to the project.