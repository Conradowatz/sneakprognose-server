import {Entity, Column, PrimaryColumn} from "typeorm";

@Entity()
export class Movie {

    @PrimaryColumn("varchar", { length: 12 })
    imdbId: string;

    @Column()
    name: string;

    @Column("date")
    releaseDate: Date;

    @Column("int")
    rating: number;

    @Column()
    genres: string
}
