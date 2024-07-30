FROM node:20
WORKDIR /app

# Clone the repo
RUN git clone https://github.com/admon84/screeps-steamless-client.git /tmp/repo

# Copy all files from the repo to the app directory
RUN mv /tmp/repo/* /tmp/repo/.* /app/ || true
RUN rm -rf /tmp/repo

# Checkout the fix/docker branch
RUN git fetch
RUN git checkout fix/docker

# Install the dependencies
RUN npm install

CMD ["npm", "start", "--", "--package", "/screeps.nw"]
