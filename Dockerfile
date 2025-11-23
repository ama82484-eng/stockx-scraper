# Use Apify base image with Playwright
FROM apify/actor-node-playwright-chrome:latest

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=prod --no-optional

# Copy source code
COPY . ./

# Run the actor
CMD npm start
