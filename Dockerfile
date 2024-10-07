FROM node:20-bookworm

# Install playwright with deps
RUN npx -y playwright@1.47.1 install --with-deps chromium

# Create app directory
WORKDIR /usr/src/app

# Both package.json AND package-lock.json are copied
COPY package.json yarn.lock* ./

# Install app dependencies
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Bundle app source
COPY . .

# Copy the .env and .env.prod files
COPY .env ./

RUN yarn prisma:generate
RUN yarn prisma:generate:mediamine

# Creates a "dist" folder with the production build
# RUN yarn build

# Expose the port on which the app will run
# EXPOSE 3002

# Start the server using the production build
CMD ["yarn", "start"]
