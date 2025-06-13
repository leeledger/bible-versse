# 1. Base image: Use an official Node.js runtime as a parent image
FROM node:18-alpine

# 2. Set the working directory in the container
WORKDIR /app

# 3. Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# 4. Install project dependencies
# We remove package-lock.json to work around an npm bug with optional dependencies on Alpine Linux.
RUN rm -f package-lock.json && npm install

# 5. Copy the rest of the application's source code into the container
COPY . .

# 6. Build the React application for production
RUN npm run build

# 7. Expose the port the app will run on
EXPOSE 5173

# 8. The command to start the Vite preview server
# We use --host 0.0.0.0 to make it accessible from outside the container
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
