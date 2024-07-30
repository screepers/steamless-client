FROM node:20

WORKDIR /app

RUN git clone https://github.com/admon84/screeps-steamless-client.git .

RUN git checkout fix/docker

RUN npm install

CMD ["npm", "start"]
