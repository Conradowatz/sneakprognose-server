import {DataSource} from "typeorm";

export const AppDataSource = new DataSource({
    "type": "mariadb",
    "host": "localhost",
    "port": 3306,
    "username": "sneak-user",
    "password": "pw",
    "database": "sneak-db",
    "synchronize": true,
    "logging": false,
    "entities": [
        "src/entity/**/*.ts"
    ],
    "migrations": [
        "src/migration/**/*.ts"
    ],
    "subscribers": [
        "src/subscriber/**/*.ts"
    ]
});