import {Entity, PrimaryGeneratedColumn, Column, OneToMany} from "typeorm";
import {Cinema} from "./Cinema";

@Entity()
export class City {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @OneToMany(() => Cinema, (cinema) => cinema.city)
    cinemas: Cinema[]

}
