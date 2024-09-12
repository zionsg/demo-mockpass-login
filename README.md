# Demo MockPass Login

Website to demo SingPass/CorpPass login and profile retrieval from
MyInfo Personal/Business using MockPass server. This application
will serve up a website as well as start up a MockPass server locally.

Paths in all documentation, even those in subfolders, are relative to the root
of the repository. Shell commands are all run from the root of the repository.

## Sections
- [References](#references)
- [Requirements](#requirements)
- [Installation](#installation)

## References
- [MockPass - a mock SingPass/CorpPass server for testing in development](https://medium.com/open-government-products/mockpass-a-mock-singpass-corppass-server-for-testing-in-development-a583193c898c)
- [SingPass Developer Guide](https://api.singpass.gov.sg/developers)
    + [Displaying the SingPass QR](https://api.singpass.gov.sg/library/login/developers/tutorial1)
- [CorpPass](https://www.developer.tech.gov.sg/products/categories/digital-identity/corppass/overview.html)
- Related open-source Node.js repositories
    + [MockPass server](https://github.com/opengovsg/mockpass)
    + [Singpass MyInfo OIDC helper](https://github.com/GovTechSG/singpass-myinfo-oidc-helper)
    + [MyInfo client](https://github.com/opengovsg/myinfo-gov-client)
    + [MyInfo Demo App](https://github.com/ndi-trusted-data/myinfo-demo-app)
    + [MyInfo Business Demo App](https://github.com/singpass/myinfobiz-demo-app)

## Requirements
- [Docker Engine](https://docs.docker.com/engine/release-notes/) >= 20.10.7
- [Docker Compose](https://docs.docker.com/compose/release-notes/) >= 2.14.0
    + Docker Compose v3 not used as it does not support the `extends` key.
    + Docker Compose v1 not used as it does not support the `depends_on` key.
    + Note that Docker Compose v2 uses the `docker compose` command (without
      hyphen) via the Compose plugin for Docker whereas Docker Compose v1 uses
      the `docker-compose` command (with hyphen).
        * [Install Docker Compose v2 plugin on Ubuntu 22.04](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-compose-on-ubuntu-22-04)
    + Version 3.8 is currently used for the Compose file format.
- [Node.js](https://nodejs.org/) >= 18.20.4 (includes npm 10.7.0)
    + `?.` optional chaining and `??` nullish coalescing operator supported from
      Node.js 14 onwards. `btoa()` supported from Node.js 16 onwards.
    + Node.js 18 is a LTS release. As of 25 Oct 2022, its status is Active LTS
      with Maintenance LTS status starting from 18 Oct 2023. End-of-life is
      30 Apr 2025.
    + For development purposes, it is recommended that
      [nvm](https://nodejs.org/en/download/package-manager/#nvm) be used to
      install Node.js and npm as it can switch between multiple versions
      if need be for different projects, e.g. `nvm install 18.20.4` to install
      a specific version and `nvm alias default 18.20.4` to set the default
      version.
    + For the base Docker image, `node:18.20.4-bullseye-slim` is used.
      At this time, the stable release for Debian is version 11, codenamed
      Bullseye, released 2021-08-14 (see https://wiki.debian.org/DebianReleases
      for more info). Alpine Linux is not used as Node.js only provides
      experimental support for it, versus Tier 1 support for Debian (see
      https://github.com/nodejs/node/blob/master/BUILDING.md#platform-list
      for more info).

## Installation
- Clone this repository.
- Copy `.env.example` to `.env` and update the values accordingly. This will be
  read by Docker Compose and the application. The file `.env` will not be
  committed to the repository.
- Run `npm install`.
- To run the application locally:
    + The application should be run using Docker and Docker Compose during local
      development (which settles all dependencies including the starting of
      the local MockPass server) and not directly using `node src/index.js`.
        * May need to run Docker and Docker Compose commands as `sudo` depending
          on the host machine. See
          https://docs.docker.com/engine/install/linux-postinstall/ for more
          info.
        * If you see a stacktrace error when running a Docker command in
          Windows Subsystem for Linux (WSL),
          e.g. "Error: ENOENT: no such file or directory, uv_cwd",
          try running `cd .` and run the Docker command again.
    + Create a `docker-compose.override.yml` which will be automatically used by
      Docker Compose to override specified settings in `docker-compose.yml`.
      This is used to temporarily tweak the Docker Compose configuration on the
      local machine and will not be committed to the repository. See
      https://docs.docker.com/compose/extends for more info.
        * A common use case during local development would be to enable live
          reload inside the Docker container when changes are made to the source
          code on a Windows host machine, without rebuilding the Docker image.

          ```
          # docker-compose.override.yml in root of repository
          name: local # override Compose project name

          services:
            mockpass-server:
              # need to manually restart this container if code is changed locally cos modules alr loaded and
              # require() is cached, i.e. docker restart mockpass-server
              volumes:
                # tmp/mockpass created by scripts/get-mockpass.sh which clones the MockPass repository
                # and creates its package-lock.json needed to build the Docker image
                - type: bind
                  source: /mnt/c/Users/Me/localhost/www/demo-mockpass-login/tmp/mockpass
                  target: /usr/src/mockpass/lib

            demo-app:
              volumes:
                # Cannot use the shortform "- ./src/:/var/lib/app/src" else Windows permission error
                # Use the node_modules & public/vendor folders inside container not host cos packages may use
                # Linux native libraries and not work on host platform (except opengovsg to allow changing of
                # code to debug)
                - type: bind
                  source: /mnt/c/Users/Me/localhost/www/demo-mockpass-login/src
                  target: /var/lib/app/src
                - type: bind
                  source: /mnt/c/Users/Me/localhost/www/demo-mockpass-login/public/css
                  target: /var/lib/app/public/css
                - type: bind
                  source: /mnt/c/Users/Me/localhost/www/demo-mockpass-login/public/images
                  target: /var/lib/app/public/images
                - type: bind
                  source: /mnt/c/Users/Me/localhost/www/demo-mockpass-login/public/js
                  target: /var/lib/app/public/js
                - type: bind
                  source: /mnt/c/Users/Me/localhost/www/demo-mockpass-login/tmp
                  target: /var/lib/app/tmp
              # This command uses Nodemon which is listed as a production dependency
              # cos container does not install devDependencies and node_modules are
              # read from container not host
              command: npm run dev
          ```

    + Run `npm run build:local` first to build the Docker images for MockPass
      and this application
    + Run `npm run start` to start the Docker containers for the MockPass server
      and the application. May need to run as `sudo` depending on host
      machine, due to the use of Docker Compose.
    + Run `npm run stop` to stop the Docker container or just press `Ctrl+C`.
      However, the former should be used as it will properly shut down the
      container, else it may have problems restarting later.
    + The website can be accessed via `http://localhost:3001`.
