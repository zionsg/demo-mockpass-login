##
# Dockerfile
##

# Debian Linux. Node.js provides Tier 1 support for Debian Linux but only experimental support for Alpine Linux
FROM node:16.15.0-bullseye-slim

# Set environment variables. NODE_ENV should always be set to production
# else `npm install` will install devDependencies.
ENV DEBIAN_FRONTEND=noninteractive NODE_ENV=production

# Install system packages: cURL (used in healthcheck), dumb-init (used in Dockerfile), nano/vim (editors)
# Specify the versions for the system packages to avoid surprises by `apt-get update`
# Use `apt-cache policy <package>` (not `<package> --version`) to get the specific version installed by apt-get
RUN apt-get --yes update \
    && apt-get --yes install curl=7.74.0-1.3+deb11u2 dumb-init=1.2.5-1 nano=5.4-2+deb11u1 vim=2:8.2.2434-3+deb11u1

# Create app directory and switch to it
RUN mkdir -p /var/lib/app/public \
    && mkdir -p /var/lib/app/src
WORKDIR /var/lib/app

# Copy only essential files and folders - Docker recommends using COPY instruction over ADD
# Placing the copy commands explicitly here is easier to troubleshoot
# than using .dockerignore. Do NOT copy .env inside here, use docker-compose.yml
# or Docker CLI to set environment variables for the container instead.
COPY --chown=node:node public/ /var/lib/app/public/
COPY --chown=node:node src/ /var/lib/app/src/
COPY --chown=node:node nodemon.json package* /var/lib/app/

# Install app dependencies. Note that devDependences in package.json are not installed.
# Disabling progress yields 2x speed improvement - https://twitter.com/gavinjoyce/status/691773956144119808
RUN npm set progress=false && npm ci --production

# Using dumb-init allows proper terminating of application in Docker container
# CMD can be overridden via `command` in docker-compose.yml while ENTRYPOINT ensures CMD/command go thru dumb-init
# Run as non-root - see https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker
USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
