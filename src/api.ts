import {Express} from "express";
import {AppDataSource} from "./app-data-source";
import {City} from "./entity/City";
import {Hint} from "./entity/Hint";
import {Movie} from "./entity/Movie";
import {Cinema} from "./entity/Cinema";
import {DateTime} from "luxon";
import {ConnectionIsNotSetError} from "typeorm";

export function registerApiRoutes(app: Express) {
    let apiEndpoint = "/api/"
    // === get all cities ===
    // params: -
    app.get(apiEndpoint + "city", async (req, res) => {
        const cinemas = await AppDataSource.getRepository(City).find({relations: ["cinemas"]});
        res.json(cinemas);
    });
    // === get hints for cinema ===
    // params: cinemaId
    app.get(apiEndpoint + "hint", async (req, res) => {
        if ("cinemaId" in req.query && typeof req.query.cinemaId === "string" && !isNaN(parseInt(req.query.cinemaId))) {
            const hints = await AppDataSource.getRepository(Hint)
                .createQueryBuilder("hint")
                .where("hint.cinema = :cinemaId ", {cinemaId: parseInt(req.query.cinemaId)})
                .innerJoinAndSelect("hint.movie", "movie")
                .getMany();
            res.json(hints);
        } else {
            res.status(400).send("parameter cinemaId is required");
        }
    });
    // === add hint ===
    // params: imdbLink, sneakDate, cinemaId, startDate?
    app.post(apiEndpoint + "hint", async (req, res) => {
        if ("imdbLink" in req.body && typeof req.body.imdbLink === "string" &&
            "sneakDate" in req.body && typeof req.body.sneakDate === "string" &&
            "cinemaId" in req.body && typeof req.body.cinemaId === "number" && !isNaN(parseInt(req.body.cinemaId))) {

            // see if movie already exists
            const imdbId = extractImdbId(req.body.imdbLink);
            if (imdbId == null) {
                res.status(400).send("Malformed imdb url");
                return;
            }
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
            let movie = await AppDataSource.getRepository(Movie).findOneBy({imdbId: imdbId});
            if (movie == null) {
                if (!("startDate" in req.body && typeof req.body.startDate === "string")) {
                    res.json({"error": "Filmstart wird für diesen Film benötigt. Nutze bspw. https://www.filmstarts.de/."});
                    return;
                }
                let startDate = DateTime.fromISO(req.body.startDate);
                if (!startDate.isValid) {
                    res.status(400).send("malformed startDate");
                    return;
                }
                if (sneakDate > startDate) {
                    res.json({"error": "Sneak-Datum muss vor Filmstart liegen."});
                    return;
                }
                movie = await createNewMovie(imdbId, startDate);
                if (movie == null) {
                    res.status(400).send("Could not create movie hint")
                    return;
                }
            }
            // get cinema
            const hint = await AppDataSource.getRepository(Hint).create({
                date: sneakDate.toJSDate(),
                cinema: {id: cinemaId},
                movie: movie
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
            "isUpvote" in req.body && (req.body.isUpvote === "true" || req.body.isUpvote === "false") &&
            "count" in req.body && (req.body.count === 1 || req.body.count === 2)) {
            let hint = await AppDataSource.getRepository(Hint).findOneBy({id: parseInt(req.body.hintId)});
            if (hint != null) {
                hint.score += req.query.isUpvote === "true" ? req.body.count : -req.body.count;
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
            /*const guesses1 = await AppDataSource.getRepository(Movie).createQueryBuilder("movie")
                .innerJoin(Hint, "hint", "movie.imdbId = hint.movie")
                .addSelect("COUNT(hint.id)", "count")
                .addSelect("GROUP_CONCAT(DISTINCT hint.cinema)", "cinemas")
                .andWhere("movie.releaseDate > CURRENT_DATE()")
                .groupBy("movie.imdbId")
                .having(":cinemaId NOT IN (cinemas)", {cinemaId: parseInt(req.query.cinemaId)})
                .orderBy("count", "DESC")
                .getRawMany();*/
            const qb = await AppDataSource.getRepository(Movie).createQueryBuilder("movie");
            const guesses = await qb
                .innerJoin(Hint, "hint", "movie.imdbId = hint.movie")
                .addSelect("COUNT(hint.id)", "count")
                .addSelect("DATEDIFF(movie.releaseDate, CURRENT_DATE())", "daysTill")
                .addSelect("(POWER(COUNT(hint.id), 1.2) / DATEDIFF(movie.releaseDate, CURRENT_DATE()))", "confidence")
                .andWhere("movie.releaseDate > CURRENT_DATE()")
                .andWhere("hint.score >= 0")
                .andWhere(":cinemaId NOT IN " +
                    qb.subQuery()
                        .select("hint2.cinema")
                        .from(Hint, "hint2")
                        .where("hint2.movie = movie.imdbId")
                        .getQuery(), {cinemaId: parseInt(req.query.cinemaId)})
                .groupBy("movie.imdbId")
                .orderBy("confidence", "DESC")
                .limit(10)
                .getRawMany();
            res.json(guesses);
        } else {
            res.status(400).send("parameter cinemaId is required");
        }
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

export async function createNewMovie(imdbId: string, startDate: DateTime): Promise<Movie> {
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