const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

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
    // Preprocess the image using Sharp
    await sharp(imagePath)
      .resize(1024)                // Resize image for better OCR
      .greyscale()                 // Convert to grayscale
      .modulate({ brightness: 1.4, contrast: 1.4 }) // Enhance brightness & contrast
      // .convolve({
      //   width: 3,
      //   height: 3,
      //   kernel: [
      //     -1, -1, -1,
      //     -1,  8, -1,
      //     -1, -1, -1
      //   ],                         // Apply a basic edge detection kernel (Sobel-like)
      // })
      .toFile(outputImagePath);

    return outputImagePath;
  } catch (err) {
    console.error(`Error preprocessing image ${imagePath}:`, err);
    throw err; // Re-throw the error to be handled by the caller
  }
}

// Function to parse image using Tesseract.js
async function parseImage(imagePath) {
  let enhancedImagePath;
  try {
    // Preprocess and enhance the image
    enhancedImagePath = await preprocessImage(imagePath);

    // Use Tesseract to recognize text from the image
    const { data: { text } } = await Tesseract.recognize(enhancedImagePath, "eng", {
      logger: (m) => console.log(m), oem: 1 // Optional logging
    });
    console.log("OCR Text Output:\n", text);

    // Extract merchant name and parse the rest of the receipt
    const parsedData = parseReceiptText(text);
    console.log("Parsed Receipt Data:\n", parsedData);

    return parsedData; // Return parsed data for further use
  } catch (err) {
    console.error("Error during OCR processing:", err);
    throw err; // Re-throw the error to be handled by the caller
  } finally {
    // Delete the enhanced image file if it exists
    if (enhancedImagePath && await fileExists(enhancedImagePath)) {
      await deleteFile(enhancedImagePath);
    }
  }
}

// Function to parse receipt text into merchant name, item details (code, quantity, price, name)
function parseReceiptText(text) {
  const lines = text.split("\n").filter((line) => line.trim() !== ""); // Remove empty lines

  // Assume the first line is the merchant name
  const merchantName = lines[0].trim();
  
  // Initialize variables
  const items = [];
  let subtotal = 0;
  let total = 0;
  let tax = 0;
  let date = "NULL";
  let time = "NULL";

  // Different parsing logic based on the merchant name
  if (merchantName.toUpperCase().includes("AEON")) {
    // AEON-specific parsing logic
    for (let i = 1; i < lines.length; i++) {
      const firstLine = lines[i].trim();
      const secondLine = lines[i + 1] ? lines[i + 1].trim() : ""; // The next line for the item name

      // Regex to extract quantity, item code, and price from the first line
      const match = firstLine.match(/(\d+)x\s+(\d+)\s+(\d+[\.,]\d{2})/);
      if (match && secondLine) {
        const quantity = parseInt(match[1]);
        const itemCode = match[2];
        const itemPrice = parseFloat(match[3].replace(',', '.')); // Convert price to float
        const itemName = secondLine; // The second line is the item name

        items.push({
          name: itemName,
          code: itemCode,
          quantity: quantity,
          price: itemPrice,
        });

        i++; // Skip the next line as it has been processed for the item name
      }

      const line = lines[i].trim();

      // Extract subtotal
      if (line.match(/Sub\-total\s+(\d+[\.,]\d{2})/i)) {
        const match = line.match(/Sub\-total\s+(\d+[\.,]\d{2})/i);
        subtotal = parseFloat(match[1].replace(',', '.'));
      }

      // Extract total after adjustments including tax
      else if (line.match(/Total\s+After\s+Adj\s+INCL\s+SVC\s+TAX\s+(\d+[\.,]\d{2})/i)) {
        const match = line.match(/Total\s+After\s+Adj\s+INCL\s+SVC\s+TAX\s+(\d+[\.,]\d{2})/i);
        total = parseFloat(match[1].replace(',', '.'));
      }

      // Extract "Total Sales INCL SVC TAX"
      else if (line.match(/Total\s+Sales\s+(?:\w+\s+)*(\d{1,3}(?:[\s.]\d{3})*[\s.,]?\d{2})/i)) {
        const match = line.match(/Total\s+Sales\s+(?:\w+\s+)*(\d{1,3}(?:[\s.]\d{3})*[\s.,]?\d{2})/i);
        total = parseFloat(match[1].replace(',', '.')); // Convert price to float
      }

      // Extract date and time (DD/MM/YYYY HH:MM)
      const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
      if (dateMatch) {
        date = dateMatch[1];
        time = dateMatch[2];
      }
    }
  } else if (merchantName.toUpperCase().includes("LOTUS")) {
    // LOTUS-specific parsing logic
    let currentItem = null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();

      // Regex to extract item code and name in the format: "09555663103205 LOTUSS TAT PAK CHOY"
      const itemMatch = line.match(/(\d+)\s+([A-Z\s\./]+)(?:\s+(\d+[\.,]\d{2}))?$/i);
      
      if (itemMatch) {
        // If a current item is being processed but doesn't have a price, push it with "UNKNOWN" price
        if (currentItem && !currentItem.price) {
          currentItem.price = "UNKNOWN";
          currentItem.quantity = "1";
          items.push(currentItem);
        }

        const itemCode = itemMatch[1];
        const itemName = itemMatch[2].trim();
        const itemPrice = itemMatch[3] ? parseFloat(itemMatch[3].replace(',', '.')) : null;
        currentItem = { code: itemCode, name: itemName, price: itemPrice };
        
        // If item price is provided in the same line, add it immediately
        if (itemPrice !== null) {
          currentItem.quantity = "1";
          items.push(currentItem);
          currentItem = null; // Reset for the next item
        }
      }

      // Check for "REDUCED PRICE" or other price entries
      const priceMatch = line.match(/REDUCED\s+PRICE\s+(\d+[\.,]\d{2})|(\d+[\.,]\d{2})/i);
      if (priceMatch && currentItem) {
        // If the price is found, update the current item
        currentItem.price = parseFloat((priceMatch[1] || priceMatch[2]).replace(',', '.'));
        items.push(currentItem); // Add the item to the list
        currentItem = null; // Reset for the next item
      }

      // Extract total in the format "TOTAL 49.62"
      const totalMatch = line.match(/TOTAL\s+(\d+[\.,]\d{2})/i);
      if (totalMatch) {
        total = parseFloat(totalMatch[1].replace(',', '.'));
      }

      // Look for date and time pattern (DD/MM/YYYY HH:MM)
      const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
      if (dateMatch) {
        date = dateMatch[1];
        time = dateMatch[2];
      }
    }

    // Push any remaining item with an unknown price
    if (currentItem && !currentItem.price) {
      currentItem.price = "UNKNOWN";
      // items.push(currentItem);
    }
  }

  return {
    merchant: merchantName,
    items,
    totals: {
      subtotal: subtotal,
      total: total,
      tax: tax,
    },
    date,
    time,
  };
}



module.exports = {
  parseImage,
};
