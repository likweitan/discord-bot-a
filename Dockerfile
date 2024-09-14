# Step 1: Use an official Node.js runtime as the base image
FROM arm64v8/node:18

# Step 2: Set the working directory inside the container
WORKDIR /usr/src/app

# Step 3: Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Step 4: Install the dependencies
RUN npm install --production

# Step 5: Copy the bot's source code into the container
COPY . .

# Step 6: Expose the port your bot runs on (optional if needed)
# EXPOSE 3000

# Step 7: Define the default command to start the bot
CMD [ "node", "main.js" ]
