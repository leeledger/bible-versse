FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all other source files
COPY . .

# Expose the port the server runs on
EXPOSE 3001

# The command to start the server
CMD ["node", "server.js"]
