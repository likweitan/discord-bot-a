require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { parseImage } = require('./parseReceipt'); // Import the function
const { v4: uuidv4 } = require('uuid'); // Import uuid for generating unique IDs

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Replace with your bot's token
const TOKEN = process.env.TOKEN;

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Function to download the image
async function downloadImage(url, filepath) {
    const response = await axios({
        url,
        responseType: 'stream', // Stream the image data
    });
    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

function getThumbnail(receipt) {
    const isAEON = receipt.merchant.toLowerCase().includes('aeon');
    const isLOTUS = receipt.merchant.toLowerCase().includes('lotus');
    let thumbnail = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRT3Df4n8SQ0JiB8P_Q5GiB16Z-TzJLT_vYPw&s';
    if (isAEON) {
        thumbnail = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRT3Df4n8SQ0JiB8P_Q5GiB16Z-TzJLT_vYPw&s';
    }
    else if (isLOTUS) {
        thumbnail = 'https://raw.githubusercontent.com/likweitan/discord-bot-a/main/assets/lotus.jpg';
    }

    return thumbnail;
}

// Function to create and send an embed message
function createReceiptEmbed(receipt) {
    const embed = new EmbedBuilder()
        .setTitle('Receipt Details')
        .setDescription(`Merchant: ${receipt.merchant}`)
        .setThumbnail(getThumbnail(receipt))
        .addFields(
            // {
            //     name: 'Subtotal',
            //     value: `$${receipt.totals.subtotal.toFixed(2)}`,
            //     inline: true
            // },
            {
                name: 'Total',
                value: `RM${receipt.totals.total.toFixed(2)}`,
                inline: true
            },
            // {
            //     name: 'Tax',
            //     value: `$${receipt.totals.tax.toFixed(2)}`,
            //     inline: true
            // }
        )
        .addFields(
            {
                name: 'Date',
                value: receipt.date,
                inline: true
            },
            {
                name: 'Time',
                value: receipt.time,
                inline: true
            }
        )
        .addFields(
            ...receipt.items.map(item => ({
                name: item.name,
                // value: `Code: ${item.code}\nQuantity: ${item.quantity}\nPrice: RM${item.price.toFixed(2)}`,
                value: `Quantity: ${item.quantity}\nPrice: RM${item.price.toFixed(2)}`,
                inline: false
            }))
        )
        .setTimestamp()
        .setColor('#00ff00') // Green color
        .setFooter({ text: 'Presented by Evenly' });

    return embed;
}

client.on('messageCreate', async (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if the message contains an attachment
    if (message.attachments.size > 0) {
        // Check if there's an image in the attachments
        message.attachments.forEach(async (attachment) => {
            if (attachment.contentType.startsWith('image/')) {
                const imageUrl = attachment.url;
                const uniqueId = uuidv4(); // Generate a unique ID
                const filePath = path.join(__dirname, 'download', `${uniqueId}.png`); // Save with unique ID

                try {
                    // Create 'download' directory if it doesn't exist
                    if (!fs.existsSync(path.join(__dirname, 'download'))) {
                        fs.mkdirSync(path.join(__dirname, 'download'));
                    }

                    // Download the image
                    await downloadImage(imageUrl, filePath);

                    // Call the parseImage function
                    const receiptData = await parseImage(filePath);

                    // Create and send the embed message
                    const embed = createReceiptEmbed(receiptData);
                    message.reply({ embeds: [embed] });

                } catch (error) {
                    console.error('Error processing image:', error);
                    message.reply('There was an error processing the image.');
                }
            }
        });
    }
});

// Log in to Discord with your client's token
client.login(TOKEN);
