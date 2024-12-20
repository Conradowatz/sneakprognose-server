import {Express} from "express";
import {AppDataSource} from "./app-data-source";
import {City} from "./entity/City";
import {Hint} from "./entity/Hint";
import {Movie} from "./entity/Movie";
import {Cinema} from "./entity/Cinema";
import {DateTime} from "luxon";
import {ConnectionIsNotSetError} from "typeorm";
import {createTransport} from "nodemailer";

export function registerApiRoutes(app: Express) {
    let apiEndpoint = "/";
    // === get cinema ===
    // params: -
    app.get(apiEndpoint + "cinema", async (req, res) => {
        if ("cinemaId" in req.query) {
            if (typeof req.query.cinemaId === "string" && !isNaN(parseInt(req.query.cinemaId))) {
                const cinema = await AppDataSource.getRepository(Cinema).createQueryBuilder("cinema")
                    .leftJoin(City, "cityTable", "cinema.city = cityTable.id")
                    .select("cinema.id", "id")
                    .addSelect("cinema.name", "name")
                    .addSelect("cityTable.name", "city")
                    .where("cinema.id = :id", {id: parseInt(req.query.cinemaId)})
                    .getRawOne();
                res.json(cinema);
            } else {
                res.status(401).send("cinemaId has wrong format");
            }
        } else { // get all cinemas
            const cinemas = await AppDataSource.getRepository(Cinema).createQueryBuilder("cinema")
                .leftJoin(City, "cityTable", "cinema.city = cityTable.id")
                .select("cinema.id", "id")
                .addSelect("cinema.name", "name")
                .addSelect("cityTable.name", "city")
                .orderBy("cinema.id")
                .getRawMany();
            res.json(cinemas);
        }
    });
    // === get hints for cinema ===
    // params: cinemaId
    app.get(apiEndpoint + "hint", async (req, res) => {
        if ("cinemaId" in req.query && typeof req.query.cinemaId === "string" && !isNaN(parseInt(req.query.cinemaId))) {
            const hints = await AppDataSource.getRepository(Hint)
                .createQueryBuilder("hint")
                .where("hint.cinema = :cinemaId ", {cinemaId: parseInt(req.query.cinemaId)})
                .andWhere("DATEDIFF(CURRENT_DATE(), hint.date) < 100")
                .innerJoinAndSelect("hint.movie", "movie")
                .orderBy("hint.date", "DESC")
                .addOrderBy("score", "DESC")
                .getMany();
            res.json(hints);
        } else {
            res.status(400).send("parameter cinemaId is required");
        }
    });
    // === add hint ===
    // params: tmdbId, sneakDate, cinemaId
    app.post(apiEndpoint + "hint", async (req, res) => {
        if ("tmdbId" in req.body && typeof req.body.tmdbId === "number" && !isNaN(parseInt(req.body.tmdbId)) &&
            "sneakDate" in req.body && typeof req.body.sneakDate === "string" &&
            "cinemaId" in req.body && typeof req.body.cinemaId === "number" && !isNaN(parseInt(req.body.cinemaId))) {

            let sneakDate = DateTime.fromISO(req.body.sneakDate);
            if (!sneakDate.isValid) {
                res.status(400).send("malformed sneakDate");
                return;
            }
            // check cinemaId
            let cinemaId = parseInt(req.body.cinemaId);
            const cinema = await AppDataSource.getRepository(Cinema).findOneBy({id: cinemaId});
            if (cinema == null) {
                res.status(400).send("wrong cinemaId");
                return;
            }
            let isMovieNew = false;
            let movie = await AppDataSource.getRepository(Movie).findOneBy({tmdbId: parseInt(req.body.tmdbId)});
            if (movie == null) {
                movie = await createNewMovieTmdb(parseInt(req.body.tmdbId));
                if (movie == null) {
                    res.status(400).send("Could not create movie hint")
                    return;
                }
                let rd = movie.releaseDate;
                if (rd != null && rd.getTime() < new Date().getTime() - 63113904000) {
                    res.json({error: "Film zu alt zum Einreichen."});
                    return;
                }
                await AppDataSource.getRepository(Movie).save(movie);
                isMovieNew = true;
            } else {
                let hint = await AppDataSource.getRepository(Hint)
                    .findOneBy({movie: {tmdbId: movie.tmdbId}, date: sneakDate.toJSDate(), cinema: {id: cinemaId}});
                if (hint != null) {
                    res.json({error: "Sneak ist bereits eingetragen."});
                    return;
                }
            }
            // was it guessed correctly?
            const qb = await AppDataSource.getRepository(Movie).createQueryBuilder("movie");
            const guesses = await qb
                .innerJoin(Hint, "hint", "movie.tmdbId = hint.movie")
                .addSelect("(COUNT(hint.id) / (POWER(DATEDIFF(movie.releaseDate, :sneakDate), 0.5) * AVG(DATEDIFF(:sneakDate, hint.date))))", "confidence")
                .andWhere("movie.releaseDate > :sneakDate", {sneakDate: sneakDate.toJSDate()})
                .andWhere("hint.score >= 0")
                .andWhere("DATEDIFF(:sneakDate, hint.date) < 100")
                .andWhere("hint.date < :sneakDate")
                .andWhere(":cinemaId NOT IN " +
                    qb.subQuery()
                        .select("hint2.cinema")
                        .from(Hint, "hint2")
                        .where("hint2.movie = movie.tmdbId")
                        .getQuery(), {cinemaId: cinemaId})
                .groupBy("movie.tmdbId")
                .orderBy("confidence", "DESC")
                .limit(10)
                .getRawMany();
            let movieIds = guesses.map(guess => guess.movie_tmdbId);
            // create hint
            const hint = await AppDataSource.getRepository(Hint).create({
                date: sneakDate.toJSDate(),
                cinema: {id: cinemaId},
                movie: movie,
                guess: isMovieNew ? -1 : movieIds.indexOf(movie.tmdbId)+1
            });
            await AppDataSource.getRepository(Hint).save(hint);
            res.json(hint);
        } else {
            res.status(400).send("parameter missing or wrong")
        }
    });
    // === vote ===
    // params: hintId, isUpvote, count
    app.post(apiEndpoint + "vote", async (req, res) => {
        if ("hintId" in req.body && typeof req.body.hintId === "number" && !isNaN(parseInt(req.body.hintId)) &&
            "isUpvote" in req.body && (req.body.isUpvote === true || req.body.isUpvote === false) &&
            "count" in req.body && (req.body.count === 1 || req.body.count === 2)) {
            let hint = await AppDataSource.getRepository(Hint).findOneBy({id: parseInt(req.body.hintId)});
            if (hint != null) {
                hint.score += req.body.isUpvote ? req.body.count : -req.body.count;
                await AppDataSource.getRepository(Hint).save(hint);
                res.json(hint);
            }
        } else {
            res.status(400).send("parameter cinemaId is required");
        }
    });
    // === get sneak guesses ===
    // params: cinemaId
    app.get(apiEndpoint + "sneak", async (req, res) => {
        if ("cinemaId" in req.query && typeof req.query.cinemaId === "string" && !isNaN(parseInt(req.query.cinemaId))) {
            const qb = await AppDataSource.getRepository(Movie).createQueryBuilder("movie");
            const guesses = await qb
                .innerJoin(Hint, "hint", "movie.tmdbId = hint.movie")
                //.addSelect("COUNT(hint.id)", "count")
                .addSelect("DATEDIFF(movie.releaseDate, CURRENT_DATE())", "daysTill")
                //.addSelect("AVG(DATEDIFF(CURRENT_DATE(), hint.date))", "sneakedMost")
                .addSelect("(COUNT(hint.id) / (POWER(DATEDIFF(movie.releaseDate, CURRENT_DATE()), 0.5) * AVG(DATEDIFF(CURRENT_DATE(), hint.date))))", "confidence")
                .andWhere("movie.releaseDate > CURRENT_DATE()")
                .andWhere("hint.score >= 0")
                .andWhere("DATEDIFF(CURRENT_DATE(), hint.date) < 100")
                .andWhere(":cinemaId NOT IN " +
                    qb.subQuery()
                        .select("hint2.cinema")
                        .from(Hint, "hint2")
                        .where("hint2.movie = movie.tmdbId")
                        .getQuery(), {cinemaId: parseInt(req.query.cinemaId)})
                .groupBy("movie.tmdbId")
                .orderBy("confidence", "DESC")
                .limit(10)
                .getRawMany();
            res.json(guesses);
        } else {
            res.status(400).send("parameter cinemaId is required");
        }
    });
    // === send cinema suggestion ===
    // params: cinemaCity, cinemaName, name?, mail?
    app.post(apiEndpoint + "suggest_cinema", async (req, res) => {
        if ("cinemaCity" in req.body && typeof req.body.cinemaCity === "string" &&
            "cinemaName" in req.body && typeof req.body.cinemaName === "string") {

            let name = req.body.name && req.body.name.trim() != "" ? req.body.name : "Anonym";
            let mail = req.body.mail && req.body.mail.trim() != "" ? req.body.mail : "suggestion@sneakprognose.de";
            try {
                let info = await transporter.sendMail({
                    from: `"${name}" <${mail}>`, // sender address
                    to: "suggestion@sneakprognose.de", // list of receivers
                    subject: `Neues Kino: ${req.body.cinemaName} ${req.body.cinemaCity}`, // Subject line
                    text: `Neuer Kinovorschlag\n\nName: ${req.body.name}\nMail: ${req.body.mail}\nStadt: ${req.body.cinemaCity}\nKino: ${req.body.cinemaName}`, // plain text body
                });
                res.json({"status": "Kino wurde eingereicht."});
            } catch (e) {
                res.json({"status": "Senden fehlgeschlagen"});
                console.log("Failed sending mail:");
                console.error(e);
            }
        } else {
            res.status(400).send("cinemaName or cinemaCity missing");
        }
    });
    // === get correct guesses ===
    app.get(apiEndpoint + "correct", async (req, res) => {
        let correct = await AppDataSource.getRepository(Hint).createQueryBuilder("hint")
            .select("hint.guess", "guess")
            .addSelect("COUNT(hint.guess)", "count")
            .where("id > 418")
            .groupBy("hint.guess")
            .getRawMany()
        res.json(correct);
    });
    // === get null date movies ===
    app.get(apiEndpoint + "no_date", async (req, res) => {
        let movies = await AppDataSource.getRepository(Movie).createQueryBuilder("movie")
            .where("ISNULL(releaseDate)")
            .getMany();
        res.json(movies);
    });
}

function extractImdbId(urlStr): string | null {
    try {
        let urlObj = new URL(urlStr);
        if (urlObj.host != "www.imdb.com") {
            return null;
        }
        // /title/tt1234567/
        let result = urlObj.pathname.match(/\/title\/(tt\d{7,10})\//);
        if (result.length!=2) {
            return null;
        } else {
            return result[1];
        }

    } catch (e) {
        return null;
    }
}

const imdbApiKey = process.env.IMDB_KEY;
// const imdbApiKey = "replace for development";
export async function createNewMovieImdb(imdbId: string, startDate: DateTime): Promise<Movie> {
    try {
        let res = await fetch(`https://imdb-api.com/de/API/Title/${imdbApiKey}/${imdbId}`);
        if (res.status != 200) {
            console.error("Error loading movie: " + res.statusText);
            return null;
        }
        let title = await res.json();
        let intReleaseDate = DateTime.fromISO(title["releaseDate"]);
        if (intReleaseDate.isValid) {
            // reject if movie is released more the 2 years ago
            if (startDate.toMillis()-intReleaseDate.toMillis() > 63113904000) {
                return null;
            }
        }
        let genres = title["genres"];
        let movie = await AppDataSource.getRepository(Movie).create({
            imdbId: imdbId,
            name: title["title"],
            releaseDate: startDate.toJSDate(),
            rating: parseFloat(title["imDbRating"])*10,
            genres: genres
        });
        await AppDataSource.getRepository(Movie).save(movie);
        return movie;
    } catch (reason) {
        console.error("Could not fetch " + imdbId + " : " + reason);
        return null;
    }
}

const tmdbApiKey = process.env.TMDB_KEY;
// const tmdbApiKey = "replace for development";
export async function createNewMovieTmdb(tmdbId: number): Promise<Movie> {
    try {
        let res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbApiKey}&language=de-DE&append_to_response=release_dates`);
        if (res.status != 200) {
            console.error("Error loading movie: " + res.statusText);
            return null;
        }
        let apiMovie = await res.json();
        // get release date
        let releaseDate = DateTime.invalid("not set");
        for (let rdResult of apiMovie["release_dates"]["results"]) {
            if (rdResult["iso_3166_1"] != "DE") continue;
            for (let rdResultDe of rdResult["release_dates"]) {
                if (rdResultDe["type"] != 2 && rdResultDe["type"] != 3) continue;
                releaseDate = DateTime.fromISO(rdResultDe["release_date"]);
                if (rdResultDe["type"] == 3) break;
            }
        }
        //get genres
        let genres = [];
        for (let genre of apiMovie["genres"]) {
            genres.push(genre["name"]);
        }
        let movie = await AppDataSource.getRepository(Movie).create({
            imdbId: apiMovie["imdb_id"],
            tmdbId: tmdbId,
            name: apiMovie["title"],
            releaseDate: releaseDate.isValid ? releaseDate.toJSDate() : null,
            rating: apiMovie["vote_average"]*10,
            genres: genres.join(", ")
        });
        return movie;
    } catch (reason) {
        console.error("Could not fetch " + tmdbId + " : " + reason);
        return null;
    }
}

let transporter = createTransport({
    host: process.env.SMTP_ADDR,
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PW
    },
});

export async function updateMovieInfos() {
    if (!AppDataSource.isInitialized) {
        return;
    }
    let movies = await AppDataSource.getRepository(Movie).createQueryBuilder("movie")
        .where("movie.releaseDate > CURRENT_DATE()")
        .orWhere("ISNULL(movie.releaseDate)")
        .getMany();
    for (let movie of movies) {
        let updatedMovie = await createNewMovieTmdb(movie.tmdbId);
        await AppDataSource.getRepository(Movie).save(updatedMovie);
    }
    console.log("Updated movie infos.");
}