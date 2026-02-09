
# 1. Base Image
FROM node:18-alpine

# 2. Set Working Directory
WORKDIR /app

# 3. Copy Package Files
COPY package*.json ./

# 4. Install Dependencies
RUN npm install

# 5. Copy Application Source Code
COPY . .

# 6. Expose Port
EXPOSE 4000

# 7. Start Command (use npm run dev for implementation, but in prod use node src/server.js)
# Let's use 'npm start' if defined, or assume 'node src/server.js'. 
# Since user script has "dev": "nodemon src/server.js", let's use node for docker.
CMD ["node", "src/server.js"]
