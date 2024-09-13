##
# Dockerfile
##

# Debian Linux. Node.js provides Tier 1 support for Debian Linux but only experimental support for Alpine Linux
FROM node:18.20.4-bullseye-slim

# Set environment variables. NODE_ENV should always be set to production
# else `npm install` will install devDependencies.
ENV DEBIAN_FRONTEND=noninteractive NODE_ENV=production

# Install system packages: cURL (used in healthcheck), dumb-init (used in Dockerfile), nano/vim (editors)
RUN apt-get --yes update \
    && apt-get --yes install curl dumb-init nano vim

# Create app directory and switch to it
RUN mkdir -p /var/lib/app/public \
    && mkdir -p /var/lib/app/src \
    && mkdir -p /var/lib/app/tmp
WORKDIR /var/lib/app

# Copy only essential files and folders - Docker recommends using COPY instruction over ADD
# Placing the copy commands explicitly here is easier to troubleshoot
# than using .dockerignore. Do NOT copy .env inside here, use docker-compose.yml
# or Docker CLI to set environment variables for the container instead.
COPY --chown=node:node public/ /var/lib/app/public/
COPY --chown=node:node src/ /var/lib/app/src/
COPY --chown=node:node package* /var/lib/app/

# Install app dependencies. Note that devDependences in package.json are not installed.
# Disabling progress yields 2x speed improvement - https://twitter.com/gavinjoyce/status/691773956144119808
RUN npm set progress=false && npm ci --omit=dev

# Using dumb-init allows proper terminating of application in Docker container
# CMD can be overridden via `command` in docker-compose.yml while ENTRYPOINT ensures CMD/command go thru dumb-init
# Run as non-root - see https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker
USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
