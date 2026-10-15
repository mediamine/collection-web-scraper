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

# Gate the image on the unit tests and their coverage thresholds. They mock the database, browser and
# network, so they need nothing beyond the generated Prisma client. The container runs `yarn start`, not
# `yarn build`, so the prebuild hook alone wouldn't cover this path.
RUN yarn test:ci && rm -rf coverage

# Creates a "dist" folder with the production build
# RUN yarn build

# Copy and modify the entrypoint.sh script
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Start the server using the production build
ENTRYPOINT ["/entrypoint.sh", "yarn", "start"]
