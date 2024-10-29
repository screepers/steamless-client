FROM node:20

WORKDIR /srv/screeps

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm clean-install --ignore-scripts

COPY . .

ENV PATH="${PATH}:/srv/screeps/node_modules/bin"
RUN npm run --ignore-scripts build

ENTRYPOINT ["npm", "--ignore-scripts"]
# NOTE: This command will not work out of the box.
# screeps.nw is not included in the image, as it is copyrighted.
# See README.md and compose.yaml for more information.
CMD ["start", "--", "--package", "/screeps.nw", "--host", "0.0.0.0"]
