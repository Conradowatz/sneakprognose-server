import "reflect-metadata";
import * as express from "express";
import * as bodyParser from "body-parser";
import {AppDataSource} from "./app-data-source";
import {City} from "./entity/City";
import {Cinema} from "./entity/Cinema";
import * as fs from "fs";
import {createNewMovie, registerApiRoutes} from "./api";
import {Hint} from "./entity/Hint";
import {Movie} from "./entity/Movie";
import {DateTime} from "luxon";

const app = express();
main();

AppDataSource.initialize()
    .then((dataSource) => {
        console.log("DataSource has been initialized!");
        afterInitialize();
    })
    .catch((err) => {
        console.error("Error during Data Source initialization: " + err);
    });

function main() {

    app.use(bodyParser.json());

    // set cors header
    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });


    // start express server
    app.listen(3000);
    //serve client frontend
    app.use("/static", express.static("static"));

    console.log("Express server has started on port 3000.");
    console.log(" - API at http://localhost:3000/api/city");
    console.log(" - GUI at http://localhost:3000/static");
}

/**
 * called after the database connection is initialized
 */
function afterInitialize() {
    // register api routes
    registerApiRoutes(app);

    // importCitiesAndCinemas()
    //importHints();
    //backupHintsAndMovies();
}


function importCitiesAndCinemas() {
    fs.readFile("./src/resources/cinemas.json", "utf-8", (async (err, data) => {
        if (err) {
            console.log(err);
        } else {
            const cinema_database = JSON.parse(data);
            for (let city in cinema_database) {
                let cityEntity = new City()
                cityEntity.name = city;
                await AppDataSource.manager.save(cityEntity);
                for (let cinema of cinema_database[city]) {
                    let cinemaEntity = new Cinema();
                    cinemaEntity.name = cinema;
                    cinemaEntity.city = cityEntity;
                    await AppDataSource.manager.save(cinemaEntity);
                }
            }
        }
    }));
}

function importHints() {
    fs.readFile("./src/resources/hints2.json", "utf-8", (async (err, data) => {
        if (err) {
            console.log(err);
        } else {
            const hints_database: {date: string, cinema: string, imdbId: string, start: string}[] = JSON.parse(data);
            for (let hint of hints_database) {
                let hintEntity = new Hint()
                hintEntity.date = DateTime.fromFormat(hint.date, "dd-MM-yyyy").toJSDate();
                // search cinema
                let city = hint.cinema.split(", ")[1];
                let cinemaName = hint.cinema.split(", ")[0];
                let cinemaEntity = await AppDataSource.getRepository(Cinema).createQueryBuilder("cinema")
                    .innerJoin(City, "city", "cinema.cityId = city.id")
                    .where("city.name = :city and cinema.name = :cinema", {city: city, cinema: cinemaName})
                    .getOne();
                hintEntity.cinema = cinemaEntity;
                // get movie
                let movie = await AppDataSource.getRepository(Movie).findOneBy({imdbId: hint.imdbId});
                if (movie == null) {
                    console.log("Fetching movie " + hint.imdbId);
                    movie = await createNewMovie(hint.imdbId, DateTime.fromFormat(hint.start, "dd.MM.yyyy"));
                    if (movie == null) {
                        console.error("Could not create movie hint")
                        continue;
                    }
                }
                hintEntity.movie = movie;
                //console.log(hintEntity);
                await AppDataSource.manager.save(hintEntity);
            }
        }
    }));
}

function backupHintsAndMovies() {
    /*AppDataSource.getRepository(Hint).createQueryBuilder("hint").select("*").getRawMany()
        .then((rawData) => {
            fs.watchFile("./backup/hints.json", )
        });*/
}