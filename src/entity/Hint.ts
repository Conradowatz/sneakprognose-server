import {Entity, PrimaryGeneratedColumn, Column, ManyToOne} from "typeorm";
import {Movie} from "./Movie";
import {Cinema} from "./Cinema";

@Entity()
export class Hint {

    @PrimaryGeneratedColumn()
    id: number;

    @Column("date")
    date: Date

    @Column({type: "int", default: 0})
    score: number

    @ManyToOne(type => Cinema, cinema => cinema.id)
    cinema: Cinema;

    @ManyToOne(type => Movie, movie => movie.imdbId)
    movie: Movie;

}