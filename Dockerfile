FROM node:14-alpine

# Install dependencies
RUN apk add --no-cache git

# Copy app files
COPY . /app
WORKDIR /app

# Install Node.js dependencies
RUN npm install

# Start the app
CMD ["npm", "start"]