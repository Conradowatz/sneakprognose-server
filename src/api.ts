import {Express} from "express";
import {AppDataSource} from "./app-data-source";
import {City} from "./entity/City";
import {Hint} from "./entity/Hint";
import {Movie} from "./entity/Movie";
import {Cinema} from "./entity/Cinema";

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
        const hints = await AppDataSource.getRepository(Hint).findBy({cinema: {id: parseInt(req.params.cinemaId)}});
        res.json(hints);
    });
    // === add hint ===
    // params: imdbId, date, cinemaId
    app.post(apiEndpoint + "hint", async (req, res) => {
        // see if movie already exists
        const imdbId = extractImdbId(req.body.imdbId);
        if (imdbId == null) {
            res.status(401).send("Malformed imdb url");
            return;
        }
        let movie = await AppDataSource.getRepository(Movie).findOneBy({imdbId: imdbId});
        if (movie == null) {
            movie = await createNewMovie(imdbId);
            if (movie == null) {
                res.status(401).send("Could not create movie hint")
                return;
            }
        }
        // get cinema
        const hint = await AppDataSource.getRepository(Hint).create({
            date: new Date(req.body.date),
            cinema: {id: req.body.cinemaId},
            movie: movie
        })
        res.send("Created");
    });
    // === get sneak guesses ===
    // params: cinemaId
    app.get(apiEndpoint + "sneak", async (req, res) => {
        const guesses = await AppDataSource.getRepository(Movie).createQueryBuilder("movie")
            .innerJoin(Hint, "hint", "movie.imdbId = hint.movie")
            .select("COUNT(hint.id)", "count")
            .where("hint.cinema != :cinemaId", {cinemaId: req.params.cinemaId})
            .andWhere("movie.releaseDate > DATE(:today)", {today: Date()})
            .groupBy("movie.imdbId")
            .orderBy("count");
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

async function createNewMovie(imdbId): Promise<Movie> {
    try {
        let res = await fetch(`https://imdb-api.com/de/API/Title/${imdbApiKey}/${imdbId}`);
        if (res.status != 200) {
            console.error("Error loading movie: " + res.statusText);
            return null;
        }
        let title = res.json();
        let movie = await AppDataSource.getRepository(Movie).create({
            imdbId: imdbId,
            name: title["title"],
            releaseDate: new Date(title["releaseDate"]),
            rating: parseFloat(title["imDbRating"])*10
        });
        return movie;
    } catch (reason) {
        console.error("Could not fetch: " + reason);
        return null;
    }
}