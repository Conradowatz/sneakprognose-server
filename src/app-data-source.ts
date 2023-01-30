import {DataSource} from "typeorm";

export const AppDataSource = new DataSource({
    "type": "mariadb",
    //"host": "localhost",
    "host": process.env.DB_HOST,
    "port": 3306,
    //"port": 7777,
    //"username": "sneak-user",
    //"password": "pw",
    //"database": "sneak-db",
    "username": process.env.DB_USER,
    "password": process.env.DB_PASSWORD,
    "database": process.env.DB_NAME,
    "synchronize": true,
    "logging": false,
    "entities": [
        "src/entity/**/*.ts",
        "./entity/**/*.js"
    ],
    "migrations": [
        "src/migration/**/*.ts",
        "./migration/**/*.js"
    ],
    "subscribers": [
        "src/subscriber/**/*.ts",
        "./subscriber/**/*.js"
    ]
});