import {Entity, PrimaryGeneratedColumn, Column, ManyToOne} from "typeorm";
import {City} from "./City";

@Entity()
export class Cinema {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @ManyToOne(() => City, city => city.id)
    city: City;

}
