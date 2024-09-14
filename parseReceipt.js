const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const nlp = require('compromise');

// Function to delete a file
async function deleteFile(filePath) {
  try {
    await fs.promises.unlink(filePath);
    console.log(`File deleted: ${filePath}`);
  } catch (err) {
    console.error(`Error deleting file ${filePath}:`, err);
  }
}

// Function to check if a file exists
async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Function to preprocess and enhance image quality
async function preprocessImage(imagePath) {
  const outputImagePath = path.join(
    path.dirname(imagePath),
    "enhanced_" + path.basename(imagePath)
  );

  try {
    await sharp(imagePath)
      .resize(1024)
      .greyscale()
      .modulate({ brightness: 1.4, contrast: 1.4 })
      .toFile(outputImagePath);

    return outputImagePath;
  } catch (err) {
    console.error(`Error preprocessing image ${imagePath}:`, err);
    throw err;
  }
}

// Function to parse image using Tesseract.js
async function parseImage(imagePath) {
  let enhancedImagePath;
  try {
    enhancedImagePath = await preprocessImage(imagePath);

    const { data: { text } } = await Tesseract.recognize(enhancedImagePath, "eng", {
      tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ,.',
      logger: (m) => console.log(m),
      oem: 1
    });
    console.log("OCR Text Output:\n", text);

    const parsedData = parseReceiptText(text);
    console.log("Parsed Receipt Data:\n", parsedData);

    return parsedData;
  } catch (err) {
    console.error("Error during OCR processing:", err);
    throw err;
  } finally {
    if (enhancedImagePath && await fileExists(enhancedImagePath)) {
      await deleteFile(enhancedImagePath);
    }
  }
}

// Function to parse receipt text using Compromise
function parseReceiptText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');

  console.log("Processing receipt with", lines.length, "lines");

  const isAeon = lines.some(line => line.toLowerCase().includes('aeon'));
  const isLotus = lines.some(line => line.toLowerCase().includes('lotus'));

  const merchantName = isAeon ? "AEON" : (isLotus ? "LOTUS" : "Unknown Merchant");
  console.log("Detected merchant:", merchantName);

  const items = [];
  let total = 0;
  let date = "NULL";
  let time = "NULL";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    console.log("Processing line:", line);

    if (isAeon) {
      const aeonItemMatch = line.match(/^(\d+)x\s+(\d{13})\s+(\d+\.\d{2})/);
      if (aeonItemMatch) {
        const [_, quantity, code, price] = aeonItemMatch;
        const item = {
          code,
          name: i + 1 < lines.length ? lines[i + 1].trim() : "",
          price: parseFloat(price),
          quantity: parseInt(quantity)
        };
        items.push(item);
        console.log("Added AEON item:", item);
        i++; // Skip the next line as we've processed it for the name
      }
    } else if (isLotus) {
      // Updated regex to be more flexible
      const lotusItemMatch = line.match(/^(\(?[\d%]{13,14})\s+(.+?)\s+(\d+\.\d{2})$/);
      if (lotusItemMatch) {
        const [_, code, name, price] = lotusItemMatch;
        const item = {
          code: code.replace(/[()%]/g, ''), // Remove parentheses or % if present
          name: name.trim(),
          price: parseFloat(price),
          quantity: 1
        };
        items.push(item);
        console.log("Added LOTUS item:", item);

        // Updated regex for capturing date and time from lines like "20/08/2024 14:28 05507 074 9074 4663"
        const dateTimeMatchLotus = line.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
        if (dateTimeMatchLotus) {
          date = dateTimeMatchLotus[1];
          time = dateTimeMatchLotus[2];
          console.log("Found date and time (LOTUS):", date, time);
        }
      }
    }

    const totalMatch = line.match(/(?:TOTAL|Total Sales).*?(\d+\.\d{2})/);
    if (totalMatch) {
      total = parseFloat(totalMatch[1]);
      console.log("Found total:", total);
    }

    const dateTimeMatch = line.match(/(?:DATE\/TIME|Date)\s*:\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
    if (dateTimeMatch) {
      [_, date, time] = dateTimeMatch;
      console.log("Found date and time:", date, time);
    }
  }

  console.log("Parsing complete. Found", items.length, "items");

  return {
    merchant: merchantName,
    items,
    totals: {
      total,
    },
    date,
    time,
  };
}

module.exports = {
  parseImage,
};