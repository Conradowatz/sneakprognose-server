import {Entity, Column, PrimaryColumn} from "typeorm";

@Entity()
export class Movie {

    @Column("varchar", { length: 12, nullable: true })
    imdbId: string;

    @PrimaryColumn()
    tmdbId: number;

    @Column()
    name: string;

    @Column("date", {nullable: true})
    releaseDate: Date;

    @Column("int")
    rating: number;

    @Column()
    genres: string
}
