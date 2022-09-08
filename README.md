# Demo MockPass Login

Website to demo SingPass/CorpPass login using MockPass server. This application
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
    + [SingPass/CorpPass client](https://github.com/opengovsg/spcp-auth-client)
    + [MyInfo client](https://github.com/opengovsg/myinfo-gov-client)
    + [MyInfo Demo App](https://github.com/ndi-trusted-data/myinfo-demo-app)
    + [MyInfo Business Demo App](https://github.com/ndi-trusted-data/myinfobiz-demo-app)

## Requirements
- [Docker Engine](https://docs.docker.com/engine/release-notes/) >= 20.10.7
- [Docker Compose](https://docs.docker.com/compose/release-notes/) >= 1.29.0
    + `depends_on` condition in Docker Compose file to wait for successful
      service completion added in Docker Compose v1.29.0 onwards. See
      https://github.com/compose-spec/compose-spec/blob/master/spec.md#depends_on
      for more info.
    + Version 3.6 is currently used for the Compose file format.

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
        * If you encounter the error "unexpected character in variable name"
          when running `docker-compose`, try disabling Docker Compose v2
          by running `docker-compose disable-v2` and ensuring all files have
          UNIX-style line endings. See
          https://docs.docker.com/compose/cli-command/ for more info.
        * If you encounter the error "depends_on contains an invalid type"
          when running `docker-compose`, check that `docker-compose --version`
          is at least 1.29.0 and above. Either upgrade Docker Compose
          or temporarily remove the `depends_on` sections in the Docker Compose
          file.
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
          version: "3.6" # this is the version for the compose file config, not the app
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
                  source: /mnt/c/Users/Me/localhost/www/demo-mockpass-login/node_modules/@opengovsg
                  target: /var/lib/app/node_modules/@opengovsg
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
                  source: /mnt/c/Users/Me/localhost/www/demo-mockpass-login/public/vendor
                  target: /var/lib/app/public/vendor
              # This command uses Nodemon which is listed as a production dependency
              # cos container does not install devDependencies and node_modules are
              # read from container not host
              command: npm run dev
          ```

    + Run `npm run start` to start the Docker containers for the application
      and MockPass server. May need to run as `sudo` depending on host
      machine, due to the use of Docker Compose.
    + Run `npm run stop` to stop the Docker container or just press `Ctrl+C`.
      However, the former should be used as it will properly shut down the
      container, else it may have problems restarting later.
    + The website can be accessed via `http://localhost:5000`.
        * See `DEMO_PORT_*` env vars in `.env` for port settings.
