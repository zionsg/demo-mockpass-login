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
- Relevant articles:
    + [18 Mar 2025 - New Staging Singpass App Download Process](https://partnersupport.singpass.gov.sg/hc/en-sg/articles/44616927370777-18-Mar-2025-New-Staging-Singpass-App-Download-Process)
    + [18 Nov 2024 Singpass Onboarding Resumption – Briefing Materials Available!](https://partnersupport.singpass.gov.sg/hc/en-sg/articles/39996163746585--18-Nov-2024-Singpass-Onboarding-Resumption-Briefing-Materials-Available)
        * This announces the replacement of MyInfo v3/v4 with the Singpass `/userinfo` endpoint,
          as well as the replacement of MyInfo Business v1/v2 with Corppass (endpoint not mentioned).
    + [Digital Identity](https://www.developer.tech.gov.sg/products/categories/digital-identity/)
    + [A Hitchhiker's Guide to Identity Providers (Singapore Government Edition)](https://medium.com/singapore-gds/a-hitchhikers-guide-to-identity-providers-singapore-government-edition-bebfdf354a68)
    + [MockPass - a mock SingPass/CorpPass server for testing in development](https://medium.com/open-government-products/mockpass-a-mock-singpass-corppass-server-for-testing-in-development-a583193c898c)
    + [Auth0 Integration with Singpass (2021)](https://auth0.com/blog/auth0-integration-with-singpass/)
- [Singpass Developer Portal](https://developer.singpass.gov.sg/)
    + [Singpass Partner Support Center](https://partnersupport.singpass.gov.sg/) where announcements can be found.
    + [Singpass Developer Docs](https://docs.developer.singpass.gov.sg/docs) which includes
      onboarding checklist.
- [Corppass Developer Portal](https://developer.corppass.gov.sg/)
    + [Corppass Partner Support](https://partnersupport.corppass.gov.sg/) where announcements can be found.
    + [Corppass Developer Docs](https://docs.corppass.gov.sg/) which includes onboarding checklist
      under the user guide.
- [MyInfo](https://api.singpass.gov.sg/library/myinfo/developers/overview)
    + [When will Myinfo v3 and Myinfo v4 be decomissioned?](https://partnersupport.singpass.gov.sg/hc/en-sg/articles/40265036685593-When-will-Myinfo-v3-and-Myinfo-v4-be-decomissioned)
    + [MyInfo API v3](https://public.cloud.myinfo.gov.sg/myinfo/api/myinfo-kyc-v3.2.html)
    + [MyInfo API v4](https://public.cloud.myinfo.gov.sg/myinfo/api/myinfo-kyc-v4.0.html)
- [MyInfo Business](https://api.singpass.gov.sg/library/myinfobiz/developers/overview)
    + [MyInfo Business API v2](https://public.cloud.myinfo.gov.sg/myinfobiz/myinfo-biz-specs-v2.0.html)
- Related open-source Node.js repositories
    + [MockPass server](https://github.com/opengovsg/mockpass)
    + [Singpass MyInfo OIDC helper](https://github.com/GovTechSG/singpass-myinfo-oidc-helper)
    + [MyInfo client](https://github.com/opengovsg/myinfo-gov-client)
    + [MyInfo Demo App](https://github.com/singpass/myinfo-demo-app)
    + [MyInfo Business Demo App](https://github.com/singpass/myinfobiz-demo-app)
    + [MyInfo Connector NodeJS](https://github.com/singpass/myinfo-connector-v4-nodejs)

## Requirements
- [Docker Engine](https://docs.docker.com/engine/release-notes/) >= 27.3.1
- [Docker Compose](https://docs.docker.com/compose/release-notes/) >= 2.29.7
    + Docker Compose v3 not used as it does not support the `extends` key.
    + Docker Compose v1 not used as it does not support the `depends_on` key.
    + Note that Docker Compose v2 uses the `docker compose` command (without
      hyphen) via the Compose plugin for Docker whereas Docker Compose v1 uses
      the `docker-compose` command (with hyphen).
        * [Install Docker Compose v2 plugin on Ubuntu 22.04](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-compose-on-ubuntu-22-04)
- [Node.js](https://nodejs.org/) >= 22.13.0 (includes npm 10.9.2)
    + `?.` optional chaining and `??` nullish coalescing operator supported from
      Node.js 14 onwards. `btoa()` supported from Node.js 16 onwards.
    + Node.js 22 is a LTS release. As of 08 Jan 2025, its status is Active LTS
      with Maintenance LTS status starting from 21 Oct 2025. End-of-life is
      30 Apr 2027.
    + For development purposes, it is recommended that
      [nvm](https://nodejs.org/en/download/package-manager/#nvm) be used to
      install Node.js and npm as it can switch between multiple versions
      if need be for different projects, e.g. `nvm install 22.13.0` to install
      a specific version and `nvm alias default 22.13.0` to set the default
      version.
    + For the base Docker image, `node:22.13.0-bookworm-slim` is used.
      As of 08 Jan 2025, the stable release for Debian is version 12, codenamed
      Bookworm, released 2023-06-10 (see https://www.debian.org/releases/
      for more info). Alpine Linux is not used as Node.js only provides
      experimental support for it, versus Tier 1 support for Debian (see
      https://github.com/nodejs/node/blob/master/BUILDING.md#platform-list
      for more info).

## Installation
- This section is meant for software developers working on the source code
  in this repository.
- Clone this repository, e.g. `git clone git@github.com:zionsg/demo-mockpass-login.git`.
- Note that `.env` and `docker-compose.override.yml` MUST be created for this
  application to run. The creation of the files will be covered in subsequent
  steps.
- Copy `.env.example` to `.env`. This will be read by Docker Compose and the
  application. The file `.env` will not be committed to the repository.
    + To make it easier to identify which env vars were changed, and to be
      consistent with server deployments, it is recommended that env vars
      be overridden in `docker-compose.override.yml` instead of updating `.env`.
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
                - type: bind
                  source: /mnt/c/Users/Me/localhost/www/demo-mockpass-login/node_modules/@opengovsg/mockpass/lib
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
                # Read from local copy to allow debugging
                - type: bind
                  source: /mnt/c/Users/Me/localhost/www/demo-mockpass-login/node_modules/@opengovsg/myinfo-gov-client
                  target: /var/lib/app/node_modules/@opengovsg/myinfo-gov-client
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
