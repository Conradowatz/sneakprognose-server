# SneakPrognose Server

Steps to run this project:

1. Run `npm install` command to install sources
2. Setup database settings inside `app-data-source.ts` file or set the correct environment variables.
3. Place your API keys inside `api.ts` or set the correct environment variables.
4. Run `npm run start` command

For building the project run `npm run build` or to create a docker container for production, run `docker build . -t sneakprognose_api`

Server is running on port 3000. There is currently no API documentation apart from the comments in `api.ts`.

## Environment Variables
A few environment variables need to be set, if these were not replaced for development:
 - `DB_HOST`
 - `DB_USER`
 - `DB_PASSWORD`
 - `DB_NAME`
 - `SMTP_ADDR`
 - `SMTP_USER`
 - `SMTP_PW`
 - `IMDB_KEY`
 - `TMDB_KEY`

 A frontend web client can be found [here](https://github.com/Conradowatz/sneakprognose-client).