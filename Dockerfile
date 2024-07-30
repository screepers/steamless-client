FROM node:20
RUN rm -rf /app
WORKDIR /app
RUN git clone --branch main --single-branch https://github.com/screepers/steamless-client.git /app
RUN npm install
CMD ["npm", "start", "--", "--package", "/screeps.nw", "--host", "0.0.0.0"]
