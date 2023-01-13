import "reflect-metadata";
import * as express from "express";
import * as bodyParser from "body-parser";
import {AppDataSource} from "./app-data-source";
import {City} from "./entity/City";
import {Cinema} from "./entity/Cinema";
import * as fs from "fs";
import {registerApiRoutes} from "./api";
import {Hint} from "./entity/Hint";

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
    // create express app
    const app = express();
    app.use(bodyParser.json());

    // register api routes
    registerApiRoutes(app);

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
    //importCitiesAndCinemas()
    importHints();
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
    //TODO
    /*fs.readFile("./src/resources/hints.json", "utf-8", (async (err, data) => {
        if (err) {
            console.log(err);
        } else {
            const hints_database: {date: string, cinema: string, imdbId: string}[] = JSON.parse(data);
            for (let hint in hints_database) {
                let hintEntity = new Hint()
                hintEntity.date = new Date(hint.date)
                await AppDataSource.manager.save(cityEntity);
                for (let cinema of cinema_database[city]) {
                    let cinemaEntity = new Cinema();
                    cinemaEntity.name = cinema;
                    cinemaEntity.city = cityEntity;
                    await AppDataSource.manager.save(cinemaEntity);
                }
            }
        }
    }));*/
}